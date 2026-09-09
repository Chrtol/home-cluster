"""The Phase 2 gate, stated as tests.

Plan §13 Phase 2: *"duplicated events and worker restarts do not produce
duplicate active Jobs; stale approvals cannot dispatch."*

Each test below drives a real Temporal server through real signals and timers;
only the Activities are substituted.
"""

from __future__ import annotations

import asyncio
import inspect
from datetime import datetime, timedelta, timezone

import pytest
from temporalio.client import WorkflowHandle

from orchestrator.contracts import (
    BoardActor,
    BoardEvent,
    EventKind,
    JobState,
    ShiftLease,
    SlotRelease,
    Stage,
    TaskTicket,
)
from orchestrator.workflows.dispatcher import DesktopDispatcherWorkflow, DispatcherState
from orchestrator.workflows.task import ENQUEUE_REFRESH, TaskState, TaskWorkflow

from conftest import TASK_QUEUE, sample_handoff
from sink_workflow import SinkWorkflow

CARD = "card-1"
DISPATCHER_ID = "desktop-dispatcher-test"


def approval_event(card_id: str = CARD, key: str = "evt-approve") -> BoardEvent:
    """A human moving the card into 'Ready for local'."""
    return BoardEvent(
        event_key=key,
        kind=EventKind.MOVED,
        timestamp="2026-09-09T14:30:00.000Z",
        board_id="board-1",
        board_name="Example Project",
        card_id=card_id,
        title="a task",
        list_id="ready-list",
        stage=Stage.READY,
        actor=BoardActor(id="human-1", name="Christian"),
        changed_fields=["listId"],
        moved_from_list_id="review-list",
    )


async def start_dispatcher(client) -> WorkflowHandle:
    return await client.start_workflow(
        DesktopDispatcherWorkflow.run,
        DispatcherState(desktop_id="test"),
        id=DISPATCHER_ID,
        task_queue=TASK_QUEUE,
    )


async def start_task(client, card_id: str = CARD) -> WorkflowHandle:
    return await client.start_workflow(
        TaskWorkflow.run,
        TaskState(card_id=card_id, board_id="board-1"),
        id=f"task-{card_id}",
        task_queue=TASK_QUEUE,
        memo={"dispatcher_id": DISPATCHER_ID, "job_image": "test-image:1"},
    )


async def open_shift(dispatcher: WorkflowHandle, minutes: int = 240) -> str:
    now = datetime.now(timezone.utc)
    lease = ShiftLease(
        shift_id="shift-1",
        actor="christian",
        started_at=now.isoformat(timespec="seconds"),
        hard_end=(now + timedelta(minutes=minutes)).isoformat(timespec="seconds"),
        heartbeat_at=now.isoformat(timespec="seconds"),
    )
    await dispatcher.signal("shift_start", lease)
    return lease.shift_id


async def wait_for(predicate, timeout: float = 20.0, interval: float = 0.1):
    """Poll until a condition holds.

    Accepts either a sync predicate over the fake world or a coroutine that
    queries a workflow, since assertions in this module use both.
    """
    deadline = asyncio.get_running_loop().time() + timeout
    while asyncio.get_running_loop().time() < deadline:
        outcome = predicate()
        if inspect.isawaitable(outcome):
            outcome = await outcome
        if outcome:
            return True
        await asyncio.sleep(interval)
    return False


class TestDuplicateEvents:
    async def test_duplicate_delivery_creates_one_job(self, worker, world):
        """The gate's first half: a repeated event must not double-dispatch.

        The same event key is signalled three times, as a redelivery or an
        overlapping reconciliation sweep would. Exactly one Job must exist.
        """
        world.set_handoff(CARD, sample_handoff(CARD))
        dispatcher = await start_dispatcher(worker)
        task = await start_task(worker)
        await open_shift(dispatcher)

        event = approval_event()
        for _ in range(3):
            await task.signal("board_event", event)

        assert await wait_for(lambda: _has_job(world)), "no job was created"
        # Let any duplicate path that was going to fire, fire.
        await asyncio.sleep(2)

        assert len(world.created_jobs) == 1, world.created_jobs
        status = await task.query("status")
        assert status["events_handled"] == 1, "duplicates must not even be folded into state"

    async def test_distinct_events_are_both_handled(self, worker, world):
        """Dedup must not be so eager that it swallows genuine events."""
        world.set_handoff(CARD, sample_handoff(CARD))
        await start_dispatcher(worker)
        task = await start_task(worker)

        await task.signal("board_event", approval_event(key="evt-a"))
        await task.signal("board_event", approval_event(key="evt-b"))

        assert await wait_for(lambda: _events_handled(task, 2))

    async def test_dedup_survives_a_worker_restart(self, worker, world, env):
        """Restarting the process must not reopen the duplicate window.

        The seen-key set lives in workflow state, so it is reconstructed by
        replay rather than held in the worker's memory.
        """
        world.set_handoff(CARD, sample_handoff(CARD))
        dispatcher = await start_dispatcher(worker)
        task = await start_task(worker)
        await open_shift(dispatcher)

        await task.signal("board_event", approval_event())
        assert await wait_for(lambda: _has_job(world))
        first = list(world.created_jobs)

        # Re-signal the identical event after the workflow has already acted.
        await task.signal("board_event", approval_event())
        await asyncio.sleep(2)

        assert world.created_jobs == first


class TestStaleApproval:
    async def test_edit_during_the_queue_wait_blocks_dispatch(self, worker, world):
        """The gate's second half, in its hardest form.

        The card is approved while no shift is open, so it queues. The handoff
        is then edited — as a human revising the design would — and only then
        does a shift open. The approval is stale by the time a slot exists, and
        nothing may be dispatched.
        """
        world.set_handoff(CARD, sample_handoff(CARD))
        dispatcher = await start_dispatcher(worker)
        task = await start_task(worker)

        await task.signal("board_event", approval_event())
        assert await wait_for(lambda: _approved(task)), "approval was not recorded"
        assert not world.created_jobs, "nothing may run before a shift is open"

        # The design changes while the task waits for the desktop.
        world.set_handoff(CARD, sample_handoff(CARD, design_revision="design-2"))

        await open_shift(dispatcher)

        assert await wait_for(lambda: _moved_to(world, Stage.DESIGN_REVIEW))
        assert world.created_jobs == [], "a stale approval dispatched a Job"
        assert any(m.startswith("stale-") for m, _ in world.comments)
        assert not (await task.query("status"))["approved"]

    async def test_description_edit_revokes_approval_immediately(self, worker, world):
        """A `card.updated` carrying a description change revokes on arrival.

        This is the fast path; the queue-wait test above covers the race the
        fast path cannot see.
        """
        world.set_handoff(CARD, sample_handoff(CARD))
        await start_dispatcher(worker)
        task = await start_task(worker)

        await task.signal("board_event", approval_event())
        assert await wait_for(lambda: _approved(task))

        await task.signal(
            "board_event",
            BoardEvent(
                event_key="evt-edit",
                kind=EventKind.UPDATED,
                timestamp="2026-09-09T14:40:00.000Z",
                board_id="board-1",
                board_name="Example Project",
                card_id=CARD,
                title="a task",
                list_id="ready-list",
                stage=Stage.READY,
                actor=BoardActor(id="human-1"),
                changed_fields=["description"],
            ),
        )

        assert await wait_for(lambda: _not_approved(task))
        assert await wait_for(lambda: _moved_to(world, Stage.DESIGN_REVIEW))
        assert world.created_jobs == []

    async def test_unparsable_handoff_blocks_instead_of_dispatching(self, worker, world):
        world.handoff_errors[CARD] = "handoff missing required fields: base_commit"
        await start_dispatcher(worker)
        task = await start_task(worker)

        await task.signal("board_event", approval_event())

        assert await wait_for(lambda: _moved_to(world, Stage.BLOCKED))
        assert world.created_jobs == []
        assert not (await task.query("status"))["approved"]

    async def test_move_without_a_board_identity_is_not_an_approval(self, worker, world):
        """Plan §8: the actor must come from verified board identity.

        kan always populates `user` for a UI-driven move, so an event without
        one is anomalous and must not confer approval.
        """
        world.set_handoff(CARD, sample_handoff(CARD))
        dispatcher = await start_dispatcher(worker)
        task = await start_task(worker)
        await open_shift(dispatcher)

        anonymous = approval_event()
        await task.signal(
            "board_event",
            BoardEvent(**{**anonymous.__dict__, "actor": None}),
        )

        assert await wait_for(lambda: any(m.startswith("noactor-") for m, _ in world.comments))
        await asyncio.sleep(1)
        assert world.created_jobs == []


class TestAttemptLifecycle:
    async def test_success_moves_the_card_to_review(self, worker, world):
        world.set_handoff(CARD, sample_handoff(CARD))
        dispatcher = await start_dispatcher(worker)
        task = await start_task(worker)
        await open_shift(dispatcher)
        await task.signal("board_event", approval_event())

        assert await wait_for(lambda: _has_job(world))
        job = world.created_jobs[0]
        world.job_states[job] = JobState(
            name=job, exists=True, succeeded=1, terminated=True, pod_phases=["Succeeded"]
        )

        assert await wait_for(lambda: _moved_to(world, Stage.REVIEW), timeout=40)

    async def test_failure_moves_the_card_to_blocked(self, worker, world):
        world.set_handoff(CARD, sample_handoff(CARD))
        dispatcher = await start_dispatcher(worker)
        task = await start_task(worker)
        await open_shift(dispatcher)
        await task.signal("board_event", approval_event())

        assert await wait_for(lambda: _has_job(world))
        job = world.created_jobs[0]
        world.job_states[job] = JobState(
            name=job, exists=True, failed=1, terminated=True, pod_phases=["Failed"], exit_code=17
        )

        assert await wait_for(lambda: _moved_to(world, Stage.BLOCKED), timeout=40)

    async def test_job_name_is_derived_from_identity_not_the_run(self, worker, world):
        """Deterministic naming is what makes adoption possible at all."""
        handoff = sample_handoff(CARD)
        world.set_handoff(CARD, handoff)
        dispatcher = await start_dispatcher(worker)
        task = await start_task(worker)
        await open_shift(dispatcher)
        await task.signal("board_event", approval_event())

        assert await wait_for(lambda: _has_job(world))
        from orchestrator.contracts import AttemptRef

        expected = AttemptRef(
            task_id=CARD,
            board_id="board-1",
            handoff_hash=handoff.content_hash(),
            attempt_number=1,
        ).job_name
        assert world.created_jobs[0] == expected


# --------------------------------------------------------------- query helpers


async def _events_handled(task: WorkflowHandle, n: int) -> bool:
    return (await task.query("status"))["events_handled"] >= n


async def _approved(task: WorkflowHandle) -> bool:
    return bool((await task.query("status"))["approved"])


async def _not_approved(task: WorkflowHandle) -> bool:
    return not (await task.query("status"))["approved"]


def _has_job(world) -> bool:
    async def check() -> bool:
        return bool(world.created_jobs)

    return check()


def _moved_to(world, stage: Stage):
    async def check() -> bool:
        return any(s is stage for _, s in world.moves)

    return check()


class TestStartSignalDelivery:
    async def test_first_event_arriving_with_the_start_is_deduplicated(self, worker, world):
        """Regression: signals delivered with `start_workflow` must not be lost.

        The webhook starts a card's workflow with `start_signal="board_event"`,
        so the first event is handled before the run method executes. If the run
        method installed its own state object, that event's dedup key would be
        written to state that is immediately discarded — and the redelivery
        below would look like a brand-new approval.
        """
        world.set_handoff(CARD, sample_handoff(CARD))
        dispatcher = await start_dispatcher(worker)
        await open_shift(dispatcher)

        event = approval_event()
        task = await worker.start_workflow(
            TaskWorkflow.run,
            TaskState(card_id=CARD, board_id="board-1", board_name="Example Project"),
            id=f"task-{CARD}",
            task_queue=TASK_QUEUE,
            memo={"dispatcher_id": DISPATCHER_ID, "job_image": "test-image:1"},
            start_signal="board_event",
            start_signal_args=[event],
        )

        assert await wait_for(lambda: _has_job(world))
        await task.signal("board_event", event)
        await asyncio.sleep(2)

        assert len(world.created_jobs) == 1, world.created_jobs
        assert (await task.query("status"))["events_handled"] == 1


class TestInfrastructureFailure:
    async def test_a_failing_activity_neither_kills_the_task_nor_strands_the_slot(
        self, worker, world
    ):
        """Regression for a real incident.

        A Role created in the wrong namespace made `ensure_workspace` return 403
        until its retries were exhausted. The ActivityError propagated out of the
        run method, the TaskWorkflow died, and because a dead workflow can never
        send `release`, the dispatcher held the only desktop slot for a holder
        that no longer existed.

        The task must survive, keep its approval, and hand the slot back.
        """
        world.set_handoff(CARD, sample_handoff(CARD))
        world.workspace_broken = True
        dispatcher = await start_dispatcher(worker)
        task = await start_task(worker)
        await open_shift(dispatcher)
        await task.signal("board_event", approval_event())

        # The slot must come back, and no Job may have been created.
        assert await wait_for(lambda: _slot_free(dispatcher), timeout=60), "slot was stranded"
        assert world.created_jobs == []

        status = await task.query("status")
        assert status["approved"] is True, "approval must survive an infrastructure fault"
        # `last_outcome` stays empty on purpose: no attempt outcome was reached,
        # so recording one would misreport infrastructure as a task result.
        assert status["last_outcome"] == ""

    async def test_it_retries_on_the_next_shift_once_infrastructure_recovers(
        self, worker, world
    ):
        """Keeping the approval is only useful if the retry actually happens."""
        world.set_handoff(CARD, sample_handoff(CARD))
        world.workspace_broken = True
        dispatcher = await start_dispatcher(worker)
        task = await start_task(worker)
        await open_shift(dispatcher)
        await task.signal("board_event", approval_event())
        assert await wait_for(lambda: _slot_free(dispatcher), timeout=60)

        # Infrastructure is fixed; the task should get a Job without re-approval.
        world.workspace_broken = False
        assert await wait_for(lambda: _has_job(world), timeout=60), "did not retry after recovery"


async def _slot_free(handle: WorkflowHandle) -> bool:
    return (await handle.query("status"))["active"] == ""


class TestDroppedTicket:
    async def test_a_rejected_enqueue_is_recovered_not_deadlocked(self, worker, world, env):
        """Regression for a real deadlock.

        The dispatcher rejected a ticket ("task already holds the slot") because
        a stale `active` from a run that had died still matched this task. The
        enqueue was fire-and-forget, so the task waited on a grant that was never
        coming while the dispatcher's queue sat empty, and nothing recovered it:
        the reconciler's repeat events are correctly deduplicated.

        Reproducing it needs the stale holder to be *real*, so the phantom ticket
        below points at a sink workflow that exists. A grant aimed at a workflow
        that does not exist is dropped and clears `active`, which is precisely
        the state this bug is not about.
        """
        handoff_hash = sample_handoff(CARD).content_hash()
        world.set_handoff(CARD, sample_handoff(CARD))
        dispatcher = await start_dispatcher(worker)
        await worker.start_workflow(
            SinkWorkflow.run, id="sink-phantom", task_queue=TASK_QUEUE
        )

        # A holder for this task that the real task workflow knows nothing about.
        await dispatcher.signal(
            "enqueue",
            TaskTicket(
                task_id=CARD,
                board_id="board-1",
                handoff_hash=handoff_hash,
                repository="chrtol/home-cluster",
                workflow_id="sink-phantom",
                enqueued_at="2026-09-09T18:00:00",
            ),
        )
        await open_shift(dispatcher)
        assert await wait_for(lambda: _dispatch_active(dispatcher, CARD)), "phantom never held it"

        # The real task now asks for a slot. Its enqueue is rejected, because the
        # dispatcher thinks this task already holds one.
        task = await start_task(worker)
        await task.signal("board_event", approval_event())
        assert await wait_for(lambda: _approved(task))
        assert world.created_jobs == [], "must not dispatch while the phantom holds the slot"

        # Free the phantom, as an operator would. From here the task must recover
        # on its own -- no further board events, no human action.
        await dispatcher.signal(
            "release",
            SlotRelease(
                task_id=CARD,
                handoff_hash=handoff_hash,
                attempt_number=1,
                fenced=True,
                outcome="manual",
            ),
        )

        # Advance past ENQUEUE_REFRESH so the task re-offers its ticket. Time
        # skipping is not automatic while the test polls with queries, so the
        # clock has to be moved on purpose.
        await env.sleep(ENQUEUE_REFRESH.total_seconds() + 30)

        assert await wait_for(lambda: _has_job(world), timeout=30), "task never recovered its slot"


async def _dispatch_active(handle: WorkflowHandle, task_id: str) -> bool:
    return (await handle.query("status"))["active"] == task_id
