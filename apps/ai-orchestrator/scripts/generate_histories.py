"""Regenerate the clean replay corpus in `tests/histories/`.

    python scripts/generate_histories.py

Each scenario is driven through a real Temporal test server exactly as the
tests drive it, and the resulting history is written out. `tests/test_replay.py`
then asserts that today's workflow code can still replay every one.

**Regenerating is not a way to make a failing replay test pass.** A history in
that directory records which commands a given sequence of events produced. If
your change makes the replayer reject it, the change will equally wedge every
card in flight the moment it is deployed -- the workflow task fails with
`NonDeterministicError`, and no worker restart fixes it (see
PHASE_2_Board_Lifecycle.md §7d). Regenerate only once you have decided that is
acceptable, and then drain the board first.

The corpus captured from the live cluster is deliberately *not* produced here.
Those files cannot be regenerated, which is what makes them worth keeping.
"""

from __future__ import annotations

import asyncio
import json
import pathlib
import sys
from datetime import datetime, timedelta, timezone

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "tests"))

from temporalio.client import WorkflowHandle  # noqa: E402
from temporalio.contrib.pydantic import pydantic_data_converter  # noqa: E402
from temporalio.testing import WorkflowEnvironment  # noqa: E402
from temporalio.worker import Worker  # noqa: E402

from conftest import FakeWorld, build_activities, sample_handoff  # noqa: E402
from orchestrator.contracts import JobState, ShiftLease, Stage  # noqa: E402
from orchestrator.workflows.dispatcher import (  # noqa: E402
    DesktopDispatcherWorkflow,
    DispatcherState,
)
from orchestrator.workflows.task import TaskState, TaskWorkflow  # noqa: E402
from test_task_workflow import (  # noqa: E402
    CARD,
    DISPATCHER_ID,
    _has_job,
    _moved_to,
    approval_event,
    wait_for,
)

OUT = ROOT / "tests" / "histories"
TASK_QUEUE = "generate-queue"


async def _open_shift(dispatcher: WorkflowHandle) -> None:
    now = datetime.now(timezone.utc)
    await dispatcher.signal(
        "shift_start",
        ShiftLease(
            shift_id="shift-1",
            actor="christian",
            started_at=now.isoformat(timespec="seconds"),
            hard_end=(now + timedelta(minutes=240)).isoformat(timespec="seconds"),
            heartbeat_at=now.isoformat(timespec="seconds"),
        ),
    )


async def _start(client, world: FakeWorld) -> tuple[WorkflowHandle, WorkflowHandle]:
    dispatcher = await client.start_workflow(
        DesktopDispatcherWorkflow.run,
        DispatcherState(desktop_id="test"),
        id=DISPATCHER_ID,
        task_queue=TASK_QUEUE,
    )
    task = await client.start_workflow(
        TaskWorkflow.run,
        TaskState(card_id=CARD, board_id="board-1"),
        id=f"task-{CARD}",
        task_queue=TASK_QUEUE,
        memo={"dispatcher_id": DISPATCHER_ID, "job_image": "test-image:1"},
    )
    return dispatcher, task


async def happy_path(client, world: FakeWorld) -> dict[str, WorkflowHandle]:
    """Approval through to Review: the sequence every card follows."""
    world.set_handoff(CARD, sample_handoff(CARD))
    dispatcher, task = await _start(client, world)
    await _open_shift(dispatcher)
    await task.signal("board_event", approval_event())

    assert await wait_for(lambda: _has_job(world)), "no job was created"
    job = world.created_jobs[0]
    world.job_states[job] = JobState(
        name=job, exists=True, succeeded=1, terminated=True, pod_phases=["Succeeded"]
    )
    assert await wait_for(lambda: _moved_to(world, Stage.REVIEW), timeout=40), "never reached Review"
    return {"task-happy-path": task, "dispatcher-grant-and-release": dispatcher}


async def blocked(client, world: FakeWorld) -> dict[str, WorkflowHandle]:
    """A failed attempt, which is what the FAIL_AT_STEP knob produces."""
    world.set_handoff(CARD, sample_handoff(CARD))
    dispatcher, task = await _start(client, world)
    await _open_shift(dispatcher)
    await task.signal("board_event", approval_event())

    assert await wait_for(lambda: _has_job(world)), "no job was created"
    job = world.created_jobs[0]
    world.job_states[job] = JobState(
        name=job, exists=True, failed=1, terminated=True, pod_phases=["Failed"], exit_code=17
    )
    assert await wait_for(lambda: _moved_to(world, Stage.BLOCKED), timeout=40), "never Blocked"
    return {"task-failed-to-blocked": task}


async def stale_approval(client, world: FakeWorld) -> dict[str, WorkflowHandle]:
    """§2.2: the handoff changes while the card waits for a shift.

    The richest command sequence in the app -- the enqueue-refresh loop, a
    grant, the post-grant re-read, a comment, a move and a release -- so it is
    the fixture most likely to catch a change that reorders any of them.
    """
    world.set_handoff(CARD, sample_handoff(CARD))
    dispatcher, task = await _start(client, world)
    await task.signal("board_event", approval_event())
    assert await wait_for(lambda: _approved(task)), "approval was never recorded"

    world.set_handoff(CARD, sample_handoff(CARD, design_revision="design-2"))
    await _open_shift(dispatcher)

    assert await wait_for(
        lambda: _moved_to(world, Stage.DESIGN_REVIEW), timeout=40
    ), "never returned to Design review"
    return {"task-stale-approval": task, "dispatcher-stale-release": dispatcher}


async def queued_awaiting_shift(client, world: FakeWorld) -> dict[str, WorkflowHandle]:
    """Approved, no shift: the state a card is most likely to be in mid-rollout.

    Captured while still running, on purpose. A finished workflow cannot be
    wedged by a bad deploy; this one can, so it is the fixture that matters.
    """
    world.set_handoff(CARD, sample_handoff(CARD))
    dispatcher, task = await _start(client, world)
    await task.signal("board_event", approval_event())
    assert await wait_for(lambda: _approved(task)), "approval was never recorded"
    # Let the enqueue-refresh loop turn over at least once so the timer and the
    # repeat signal are both in the history rather than only the first pass.
    assert await wait_for(
        lambda: _queue_depth(dispatcher), timeout=40
    ), "the ticket never reached the dispatcher"
    return {"task-queued-awaiting-shift": task, "dispatcher-holding-a-ticket": dispatcher}


def _approved(task: WorkflowHandle):
    async def check() -> bool:
        return bool((await task.query("status"))["approved"])

    return check()


def _queue_depth(dispatcher: WorkflowHandle):
    async def check() -> bool:
        return bool((await dispatcher.query("status"))["queued"])

    return check()


async def infrastructure_abort(client, world: FakeWorld) -> dict[str, WorkflowHandle]:
    """§6.2: the workspace Activity exhausts its retries and the slot is handed back."""
    world.set_handoff(CARD, sample_handoff(CARD))
    world.workspace_broken = True
    dispatcher, task = await _start(client, world)
    await _open_shift(dispatcher)
    await task.signal("board_event", approval_event())

    # Roughly 90s of real time: the workflow is blocked on an Activity's retry
    # backoff, and the test server only skips time for *timers*, so this one
    # scenario cannot be hurried.
    assert await wait_for(
        lambda: any(m.startswith("infra-") for m, _ in world.comments), timeout=180
    ), "the abort never produced its comment"
    return {"task-infrastructure-abort": task}


SCENARIOS = (happy_path, blocked, stale_approval, queued_awaiting_shift, infrastructure_abort)


async def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    written = []
    for scenario in SCENARIOS:
        env = await WorkflowEnvironment.start_time_skipping(
            data_converter=pydantic_data_converter
        )
        world = FakeWorld()
        try:
            async with Worker(
                env.client,
                task_queue=TASK_QUEUE,
                workflows=[TaskWorkflow, DesktopDispatcherWorkflow],
                activities=build_activities(world),
            ):
                handles = await scenario(env.client, world)
                for name, handle in handles.items():
                    history = await handle.fetch_history()
                    path = OUT / f"{name}.json"
                    path.write_text(json.dumps(history.to_json_dict(), indent=2) + "\n")
                    written.append((name, len(history.events)))
        finally:
            await env.shutdown()

    for name, count in written:
        print(f"{name}: {count} events")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
