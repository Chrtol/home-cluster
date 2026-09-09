"""DesktopDispatcherWorkflow — one persistent workflow per desktop.

It exists to serialize a single execution slot. Plan §7 is explicit that an
in-memory semaphore in the API is not sufficient: an API pod restart would
forget the reservation and admit a second writer. Holding the slot as workflow
state makes it durable, and makes "who holds the slot" a question with one
answer that survives every process in the system dying.

The slot is released on one condition only: a `release` signal whose `fenced`
flag is True. An unfenced release — the task could not prove its pod stopped —
leaves the slot held. That is deliberately a liveness cost paid for a safety
guarantee, and it shows up in `status()` as `awaiting_fence`.
"""

from __future__ import annotations

import asyncio
from contextlib import suppress
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from temporalio import workflow

with workflow.unsafe.imports_passed_through():
    from ..contracts import ShiftLease, SlotGrant, SlotRelease, TaskTicket

# A shift whose heartbeat has gone quiet for this long is treated as lost, even
# if its authorized end time has not arrived: the desktop may have slept.
HEARTBEAT_GRACE = timedelta(minutes=10)
TICK = timedelta(seconds=30)


@dataclass
class DispatcherState:
    desktop_id: str
    queue: list[TaskTicket] = field(default_factory=list)
    active: SlotGrant | None = None
    # False while the previous attempt has not been confirmed stopped.
    awaiting_fence: bool = False
    shift: ShiftLease | None = None
    # task_id -> attempts already granted, so a repair gets attempt 2, not 1.
    attempts: dict[str, int] = field(default_factory=dict)
    signals_handled: int = 0
    granted_total: int = 0


@workflow.defn
class DesktopDispatcherWorkflow:
    @workflow.init
    def __init__(self, state: DispatcherState) -> None:
        """Adopt the run argument here, not in `run`.

        Temporal delivers signals that arrived with the start request *before*
        the run method executes. Assigning `self._state = state` inside `run`
        would therefore throw away anything those handlers had already recorded
        — an enqueue delivered by `start_workflow(start_signal=...)` would
        vanish. `@workflow.init` receives the same arguments and runs first, so
        the handlers mutate the state the run method goes on to use.
        """
        self._state = state
        self._wake = False

    # ------------------------------------------------------------------ signals

    @workflow.signal
    def enqueue(self, ticket: TaskTicket) -> None:
        """Queue a task for the slot.

        Deduplicated on (task_id, handoff_hash): a TaskWorkflow that replays or
        continues-as-new can legitimately re-send its ticket, and that must not
        put the same work in the queue twice.
        """
        self._state.signals_handled += 1
        key = (ticket.task_id, ticket.handoff_hash)
        if any((t.task_id, t.handoff_hash) == key for t in self._state.queue):
            workflow.logger.info("duplicate enqueue for %s ignored", ticket.task_id)
            return
        if self._state.active is not None and (
            self._state.active.task_id,
            self._state.active.handoff_hash,
        ) == key:
            workflow.logger.info("task %s already holds the slot", ticket.task_id)
            return

        self._state.queue.append(ticket)
        self._wake = True

    @workflow.signal
    def withdraw(self, ticket: TaskTicket) -> None:
        """Remove a queued ticket whose task no longer wants the slot.

        Without this, a task whose approval is revoked while queued would still
        be granted a slot it will never use or release, and the desktop would be
        blocked indefinitely by work that no longer exists.
        """
        self._state.signals_handled += 1
        key = (ticket.task_id, ticket.handoff_hash)
        before = len(self._state.queue)
        self._state.queue = [t for t in self._state.queue if (t.task_id, t.handoff_hash) != key]
        if len(self._state.queue) != before:
            workflow.logger.info("withdrew queued ticket for %s", ticket.task_id)

    @workflow.signal
    def release(self, release: SlotRelease) -> None:
        self._state.signals_handled += 1
        active = self._state.active
        if active is None:
            return
        if (active.task_id, active.attempt_number) != (release.task_id, release.attempt_number):
            workflow.logger.warning("release from %s does not hold the slot", release.task_id)
            return

        if not release.fenced:
            # The task could not confirm its pod stopped. Keep the slot.
            self._state.awaiting_fence = True
            workflow.logger.warning("unfenced release from %s; holding slot", release.task_id)
            return

        self._state.active = None
        self._state.awaiting_fence = False
        self._wake = True

    @workflow.signal
    def shift_start(self, lease: ShiftLease) -> None:
        self._state.signals_handled += 1
        self._state.shift = lease
        self._wake = True

    @workflow.signal
    def shift_heartbeat(self, shift_id: str, at: str) -> None:
        self._state.signals_handled += 1
        shift = self._state.shift
        if shift is None or shift.shift_id != shift_id:
            return
        # A heartbeat proves liveness; it can never extend the authorized end.
        self._state.shift = ShiftLease(
            shift_id=shift.shift_id,
            actor=shift.actor,
            started_at=shift.started_at,
            hard_end=shift.hard_end,
            heartbeat_at=at,
        )

    @workflow.signal
    def shift_stop(self, shift_id: str) -> None:
        self._state.signals_handled += 1
        if self._state.shift is not None and self._state.shift.shift_id == shift_id:
            self._state.shift = None
            self._wake = True

    # ------------------------------------------------------------------ queries

    @workflow.query
    def status(self) -> dict[str, object]:
        shift = self._state.shift
        return {
            "desktop_id": self._state.desktop_id,
            "queued": [t.task_id for t in self._state.queue],
            "active": self._state.active.task_id if self._state.active else "",
            "active_attempt": self._state.active.attempt_number if self._state.active else 0,
            "awaiting_fence": self._state.awaiting_fence,
            "shift_id": shift.shift_id if shift else "",
            "shift_valid": self._shift_valid(),
            "granted_total": self._state.granted_total,
        }

    # --------------------------------------------------------------------- run

    @workflow.run
    async def run(self, state: DispatcherState) -> DispatcherState:
        # `state` is already installed by `__init__`; re-assigning it here would
        # discard signals delivered with the start request.
        while True:
            # A tick as well as a condition, because shift expiry is the
            # passage of time and nothing signals it. Expiry is therefore the
            # normal path here — and `wait_condition` *raises* on timeout rather
            # than returning, so it has to be suppressed or the dispatcher dies
            # on its first quiet tick.
            with suppress(asyncio.TimeoutError):
                await workflow.wait_condition(
                    lambda: self._wake or self._can_grant(), timeout=TICK
                )
            self._wake = False

            await self._expire_shift_if_needed()

            if self._can_grant():
                await self._grant()

            if self._state.signals_handled >= 500 or (
                workflow.info().get_current_history_length() > 8000
            ):
                # Safe at any point: the slot, queue and shift are all in state.
                workflow.continue_as_new(self._state)

    # ---------------------------------------------------------------- internals

    def _shift_valid(self) -> bool:
        shift = self._state.shift
        if shift is None:
            return False
        now = workflow.now()
        if now >= _parse(shift.hard_end):
            return False
        return now - _parse(shift.heartbeat_at) < HEARTBEAT_GRACE

    def _can_grant(self) -> bool:
        return (
            self._state.active is None
            and not self._state.awaiting_fence
            and bool(self._state.queue)
            and self._shift_valid()
        )

    async def _grant(self) -> None:
        ticket = self._state.queue.pop(0)
        shift = self._state.shift
        assert shift is not None

        attempts = self._state.attempts.get(ticket.task_id, 0) + 1
        self._state.attempts[ticket.task_id] = attempts

        grant = SlotGrant(
            task_id=ticket.task_id,
            handoff_hash=ticket.handoff_hash,
            attempt_number=attempts,
            shift_id=shift.shift_id,
            granted_at=workflow.now().isoformat(timespec="seconds"),
        )
        self._state.active = grant
        self._state.granted_total += 1

        handle = workflow.get_external_workflow_handle(ticket.workflow_id)
        try:
            await handle.signal("slot_granted", grant)
        except Exception as exc:  # noqa: BLE001
            # The task's workflow is gone — terminated, or aged out of
            # retention. Nothing will ever release this slot, so give it back
            # rather than blocking the desktop forever on work that no longer
            # exists. An unreachable task cannot be holding a writer either, so
            # this is not the fencing case.
            self._state.active = None
            workflow.logger.warning(
                "dropping %s: cannot signal %s (%s)", ticket.task_id, ticket.workflow_id, exc
            )
            return

        workflow.logger.info("granted slot to %s attempt %d", ticket.task_id, attempts)

    async def _expire_shift_if_needed(self) -> None:
        """Stop the active attempt when the shift is no longer valid.

        Plan §9: expiry must prevent new tasks *and* stop existing work. New
        dispatch stops on its own because `_can_grant` consults the shift; the
        running attempt has to be told.
        """
        if self._shift_valid() or self._state.active is None:
            return

        active = self._state.active
        workflow.logger.info("shift ended; stopping active task %s", active.task_id)
        handle = workflow.get_external_workflow_handle(_task_workflow_id(active.task_id))
        await handle.signal("stop", "shift ended")
        # The slot stays held until that task fences and releases it.


def _parse(value: str) -> datetime:
    return datetime.fromisoformat(value)


def _task_workflow_id(card_id: str) -> str:
    # Mirrors settings.task_workflow_id. Duplicated rather than imported so the
    # workflow sandbox does not pull the environment-reading settings module in.
    return f"task-{card_id}"
