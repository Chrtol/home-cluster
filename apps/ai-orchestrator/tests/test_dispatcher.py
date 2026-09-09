"""DesktopDispatcherWorkflow: one slot, honoured shifts, and fencing.

These drive the dispatcher directly with signals rather than through a
TaskWorkflow, so each guarantee is tested in isolation from the task state
machine that normally produces those signals.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

from temporalio.client import WorkflowHandle

from orchestrator.contracts import ShiftLease, SlotRelease, TaskTicket
from orchestrator.workflows.dispatcher import DesktopDispatcherWorkflow, DispatcherState

from conftest import TASK_QUEUE
from sink_workflow import SinkWorkflow
from test_task_workflow import wait_for

DISPATCHER_ID = "desktop-dispatcher-unit"


def ticket(task_id: str, handoff_hash: str = "hash-1", suffix: str = "") -> TaskTicket:
    return TaskTicket(
        task_id=task_id,
        board_id="board-1",
        handoff_hash=handoff_hash,
        repository="chrtol/home-cluster",
        workflow_id=f"sink-{task_id}{suffix}",
        enqueued_at="2026-09-09T14:00:00",
    )


async def sink(client, task_id: str, suffix: str = "") -> WorkflowHandle:
    """Start the workflow a granted ticket will be signalled.

    The dispatcher signals the requesting workflow, and signalling one that does
    not exist makes it drop the ticket — correct behaviour, but not what these
    tests are exercising, so every ticket gets a real target.
    """
    return await client.start_workflow(
        SinkWorkflow.run, id=f"sink-{task_id}{suffix}", task_queue=TASK_QUEUE
    )


def lease(minutes: int = 240, heartbeat_age_minutes: int = 0) -> ShiftLease:
    now = datetime.now(timezone.utc)
    return ShiftLease(
        shift_id="shift-1",
        actor="christian",
        started_at=now.isoformat(timespec="seconds"),
        hard_end=(now + timedelta(minutes=minutes)).isoformat(timespec="seconds"),
        heartbeat_at=(now - timedelta(minutes=heartbeat_age_minutes)).isoformat(
            timespec="seconds"
        ),
    )


async def start(client, suffix: str = "") -> WorkflowHandle:
    """Start a dispatcher plus the sink workflows its tickets will name.

    `suffix` keeps ids unique: all tests in a module share one Temporal server,
    and a workflow id can only be reused once the previous run has closed.
    """
    for task_id in ("card-a", "card-b", "card-z"):
        await sink(client, task_id, suffix)
    return await client.start_workflow(
        DesktopDispatcherWorkflow.run,
        DispatcherState(desktop_id="unit"),
        id=DISPATCHER_ID + suffix,
        task_queue=TASK_QUEUE,
    )


async def status(handle: WorkflowHandle) -> dict:
    return await handle.query("status")


class TestSingleSlot:
    async def test_only_one_task_holds_the_slot(self, worker):
        """Two queued tasks, one open shift: the second must wait."""
        dispatcher = await start(worker, "-a")
        SUFFIX = "-a"
        await dispatcher.signal("shift_start", lease())
        await dispatcher.signal("enqueue", ticket("card-a", suffix=SUFFIX))
        await dispatcher.signal("enqueue", ticket("card-b", suffix=SUFFIX))

        assert await wait_for(lambda: _active_is(dispatcher, "card-a"))
        state = await status(dispatcher)
        assert state["queued"] == ["card-b"], state
        assert state["granted_total"] == 1

    async def test_release_admits_the_next_task(self, worker):
        dispatcher = await start(worker, "-b")
        SUFFIX = "-b"
        await dispatcher.signal("shift_start", lease())
        await dispatcher.signal("enqueue", ticket("card-a", suffix=SUFFIX))
        await dispatcher.signal("enqueue", ticket("card-b", suffix=SUFFIX))
        assert await wait_for(lambda: _active_is(dispatcher, "card-a"))

        await dispatcher.signal(
            "release",
            SlotRelease(
                task_id="card-a",
                handoff_hash="hash-1",
                attempt_number=1,
                fenced=True,
                outcome="succeeded",
            ),
        )

        assert await wait_for(lambda: _active_is(dispatcher, "card-b"))

    async def test_duplicate_enqueue_is_ignored(self, worker):
        """A task that replays or continues-as-new re-sends its ticket."""
        dispatcher = await start(worker, "-c")
        SUFFIX = "-c"
        await dispatcher.signal("enqueue", ticket("card-a", suffix=SUFFIX))
        await dispatcher.signal("enqueue", ticket("card-a", suffix=SUFFIX))
        await dispatcher.signal("enqueue", ticket("card-a", suffix=SUFFIX))
        await asyncio.sleep(1)

        assert (await status(dispatcher))["queued"] == ["card-a"]

    async def test_withdraw_removes_a_queued_ticket(self, worker):
        dispatcher = await start(worker, "-d")
        SUFFIX = "-d"
        await dispatcher.signal("enqueue", ticket("card-a", suffix=SUFFIX))
        await dispatcher.signal("enqueue", ticket("card-b", suffix=SUFFIX))
        await wait_for(lambda: _queued(dispatcher, ["card-a", "card-b"]))

        await dispatcher.signal("withdraw", ticket("card-a", suffix=SUFFIX))

        assert await wait_for(lambda: _queued(dispatcher, ["card-b"]))

    async def test_attempt_numbers_increment_per_task(self, worker):
        """A repair is attempt 2, so its Job gets a distinct name."""
        dispatcher = await start(worker, "-e")
        SUFFIX = "-e"
        await dispatcher.signal("shift_start", lease())
        await dispatcher.signal("enqueue", ticket("card-a", suffix=SUFFIX))
        assert await wait_for(lambda: _active_is(dispatcher, "card-a"))
        assert (await status(dispatcher))["active_attempt"] == 1

        await dispatcher.signal(
            "release",
            SlotRelease(
                task_id="card-a",
                handoff_hash="hash-1",
                attempt_number=1,
                fenced=True,
                outcome="failed",
            ),
        )
        await dispatcher.signal("enqueue", ticket("card-a", suffix=SUFFIX))

        assert await wait_for(lambda: _attempt_is(dispatcher, 2))


class TestFencing:
    async def test_unfenced_release_holds_the_slot(self, worker):
        """The safety property from plan §8.

        A task that cannot prove its pod stopped — a partitioned node, say —
        releases with `fenced=False`. The dispatcher must keep the slot held
        rather than admit a second writer to the same workspace, even though a
        task is queued and the shift is valid.
        """
        dispatcher = await start(worker, "-f")
        SUFFIX = "-f"
        await dispatcher.signal("shift_start", lease())
        await dispatcher.signal("enqueue", ticket("card-a", suffix=SUFFIX))
        assert await wait_for(lambda: _active_is(dispatcher, "card-a"))

        await dispatcher.signal("enqueue", ticket("card-b", suffix=SUFFIX))
        await dispatcher.signal(
            "release",
            SlotRelease(
                task_id="card-a",
                handoff_hash="hash-1",
                attempt_number=1,
                fenced=False,
                outcome="interrupted",
            ),
        )
        await asyncio.sleep(2)

        state = await status(dispatcher)
        assert state["active"] == "card-a", "slot was released without a fence"
        assert state["awaiting_fence"] is True
        assert state["queued"] == ["card-b"], "card-b must not have been admitted"

    async def test_a_later_fenced_release_frees_the_slot(self, worker):
        """The hold is not permanent: it lifts when the fence is confirmed."""
        dispatcher = await start(worker, "-g")
        SUFFIX = "-g"
        await dispatcher.signal("shift_start", lease())
        await dispatcher.signal("enqueue", ticket("card-a", suffix=SUFFIX))
        assert await wait_for(lambda: _active_is(dispatcher, "card-a"))
        await dispatcher.signal("enqueue", ticket("card-b", suffix=SUFFIX))

        unfenced = SlotRelease(
            task_id="card-a",
            handoff_hash="hash-1",
            attempt_number=1,
            fenced=False,
            outcome="interrupted",
        )
        await dispatcher.signal("release", unfenced)
        await wait_for(lambda: _awaiting_fence(dispatcher))

        await dispatcher.signal(
            "release", SlotRelease(**{**unfenced.__dict__, "fenced": True})
        )

        assert await wait_for(lambda: _active_is(dispatcher, "card-b"))

    async def test_release_from_a_task_that_does_not_hold_the_slot_is_ignored(self, worker):
        dispatcher = await start(worker, "-h")
        SUFFIX = "-h"
        await dispatcher.signal("shift_start", lease())
        await dispatcher.signal("enqueue", ticket("card-a", suffix=SUFFIX))
        assert await wait_for(lambda: _active_is(dispatcher, "card-a"))

        await dispatcher.signal(
            "release",
            SlotRelease(
                task_id="card-z",
                handoff_hash="hash-9",
                attempt_number=1,
                fenced=True,
                outcome="succeeded",
            ),
        )
        await asyncio.sleep(1)

        assert (await status(dispatcher))["active"] == "card-a"


class TestShiftControl:
    async def test_no_dispatch_without_a_shift(self, worker):
        """Plan §9: only a manual start enables dispatch."""
        dispatcher = await start(worker, "-i")
        SUFFIX = "-i"
        await dispatcher.signal("enqueue", ticket("card-a", suffix=SUFFIX))
        await asyncio.sleep(2)

        state = await status(dispatcher)
        assert state["active"] == ""
        assert state["queued"] == ["card-a"]
        assert state["shift_valid"] is False

    async def test_stopping_a_shift_prevents_new_dispatch(self, worker):
        dispatcher = await start(worker, "-j")
        SUFFIX = "-j"
        await dispatcher.signal("shift_start", lease())
        await dispatcher.signal("enqueue", ticket("card-a", suffix=SUFFIX))
        assert await wait_for(lambda: _active_is(dispatcher, "card-a"))

        await dispatcher.signal("shift_stop", "shift-1")
        await dispatcher.signal(
            "release",
            SlotRelease(
                task_id="card-a",
                handoff_hash="hash-1",
                attempt_number=1,
                fenced=True,
                outcome="succeeded",
            ),
        )
        await dispatcher.signal("enqueue", ticket("card-b", suffix=SUFFIX))
        await asyncio.sleep(2)

        state = await status(dispatcher)
        assert state["active"] == "", "dispatched with no valid shift"
        assert state["queued"] == ["card-b"]

    async def test_a_stale_heartbeat_invalidates_the_shift(self, worker):
        """A sleeping desktop stops being a valid execution target.

        The authorized end time has not arrived, but the heartbeat has been
        quiet past the grace period, so the shift is not valid.
        """
        dispatcher = await start(worker, "-k")
        SUFFIX = "-k"
        await dispatcher.signal("shift_start", lease(minutes=240, heartbeat_age_minutes=30))
        await dispatcher.signal("enqueue", ticket("card-a", suffix=SUFFIX))
        await asyncio.sleep(2)

        state = await status(dispatcher)
        assert state["shift_valid"] is False
        assert state["active"] == ""

    async def test_heartbeat_cannot_extend_the_authorized_end(self, worker):
        """Liveness is not authorization.

        A heartbeat refreshes `heartbeat_at` only; `hard_end` is whatever the
        human authorized, and a shift past it stays invalid however lively the
        desktop is.
        """
        dispatcher = await start(worker, "-l")
        SUFFIX = "-l"
        expired = ShiftLease(
            shift_id="shift-1",
            actor="christian",
            started_at="2026-09-09T10:00:00+00:00",
            hard_end="2026-09-09T10:30:00+00:00",
            heartbeat_at="2026-09-09T10:29:00+00:00",
        )
        await dispatcher.signal("shift_start", expired)
        await dispatcher.signal(
            "shift_heartbeat",
            args=["shift-1", datetime.now(timezone.utc).isoformat(timespec="seconds")],
        )
        await dispatcher.signal("enqueue", ticket("card-a", suffix=SUFFIX))
        await asyncio.sleep(2)

        state = await status(dispatcher)
        assert state["shift_valid"] is False, "a heartbeat extended an expired shift"
        assert state["active"] == ""


# --------------------------------------------------------------- query helpers


async def _active_is(handle: WorkflowHandle, task_id: str) -> bool:
    return (await status(handle))["active"] == task_id


async def _attempt_is(handle: WorkflowHandle, n: int) -> bool:
    return (await status(handle))["active_attempt"] == n


async def _queued(handle: WorkflowHandle, expected: list[str]) -> bool:
    return (await status(handle))["queued"] == expected


async def _awaiting_fence(handle: WorkflowHandle) -> bool:
    return bool((await status(handle))["awaiting_fence"])
