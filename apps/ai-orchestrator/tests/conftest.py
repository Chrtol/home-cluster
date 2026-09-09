"""Shared fixtures: a Temporal test environment and a fake activity set.

The workflows under test are exercised against substitute Activities with the
same names as the real ones. That keeps the tests about the state machine —
which is what the Phase 2 gate is about — while still driving the genuine
signal, timer and Continue-As-New machinery through a real Temporal server.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import pytest_asyncio
from temporalio import activity
from temporalio.contrib.pydantic import pydantic_data_converter
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import Worker

from orchestrator.activities import board as board_acts
from orchestrator.activities import kubernetes as k8s_acts
from orchestrator.contracts import AttemptRef, CardSnapshot, Handoff, JobState, Stage

TASK_QUEUE = "test-queue"


@dataclass
class FakeWorld:
    """Mutable stand-in for kan and Kubernetes, inspected by assertions."""

    # card_id -> the handoff currently on the card. Mutate mid-test to simulate
    # a human editing a card after approving it.
    handoffs: dict[str, Handoff] = field(default_factory=dict)
    stages: dict[str, Stage] = field(default_factory=dict)
    handoff_errors: dict[str, str] = field(default_factory=dict)

    moves: list[tuple[str, Stage]] = field(default_factory=list)
    comments: list[tuple[str, str]] = field(default_factory=list)

    # job name -> how many times ensure_job was asked to create it. The Phase 2
    # gate is that this never exceeds one entry per attempt.
    created_jobs: list[str] = field(default_factory=list)
    job_states: dict[str, JobState] = field(default_factory=dict)
    stopped_jobs: list[str] = field(default_factory=list)
    workspaces: list[str] = field(default_factory=list)
    # Set False to simulate a node partition: the job cannot be proven stopped.
    fenceable: bool = True
    # Set True to make ensure_workspace fail every time, as a missing RBAC Role
    # does -- an infrastructure fault, not a task fault.
    workspace_broken: bool = False

    def set_handoff(self, card_id: str, handoff: Handoff) -> None:
        self.handoffs[card_id] = handoff

    @property
    def distinct_jobs(self) -> set[str]:
        return set(self.created_jobs)


def build_activities(world: FakeWorld):
    @activity.defn(name="fetch_card")
    async def fetch_card(card_id: str) -> CardSnapshot:
        if card_id in world.handoff_errors:
            return CardSnapshot(
                card_id=card_id,
                board_id="board-1",
                board_name="Example Project",
                stage=world.stages.get(card_id, Stage.READY),
                title="fake",
                handoff_error=world.handoff_errors[card_id],
            )
        handoff = world.handoffs[card_id]
        return CardSnapshot(
            card_id=card_id,
            board_id="board-1",
            board_name="Example Project",
            stage=world.stages.get(card_id, Stage.READY),
            title="fake",
            handoff=handoff,
            handoff_hash=handoff.content_hash(),
        )

    @activity.defn(name="move_card")
    async def move_card(request: board_acts.MoveRequest) -> bool:
        world.moves.append((request.card_id, request.stage))
        world.stages[request.card_id] = request.stage
        return True

    @activity.defn(name="publish_comment")
    async def publish_comment(request: board_acts.CommentRequest) -> bool:
        world.comments.append((request.marker, request.text))
        return True

    @activity.defn(name="ensure_workspace")
    async def ensure_workspace(attempt: AttemptRef) -> str:
        if world.workspace_broken:
            raise RuntimeError("persistentvolumeclaims is forbidden (simulated 403)")
        world.workspaces.append(attempt.workspace_name)
        return attempt.workspace_name

    @activity.defn(name="ensure_job")
    async def ensure_job(request: k8s_acts.EnsureJobRequest) -> str:
        name = request.attempt.job_name
        world.created_jobs.append(name)
        # A real Job runs; the test drives completion by setting job_states.
        world.job_states.setdefault(name, JobState(name=name, exists=True, active=1))
        return name

    @activity.defn(name="observe_job")
    async def observe_job(name: str) -> JobState:
        return world.job_states.get(name, JobState(name=name, exists=False, terminated=True))

    @activity.defn(name="stop_job")
    async def stop_job(name: str) -> None:
        world.stopped_jobs.append(name)
        world.job_states[name] = JobState(
            name=name, exists=True, failed=1, terminated=True, pod_phases=["Failed"]
        )

    @activity.defn(name="confirm_terminated")
    async def confirm_terminated(name: str) -> bool:
        return world.fenceable

    @activity.defn(name="configured_board_ids")
    async def configured_board_ids() -> list[str]:
        return ["board-1"]

    @activity.defn(name="reconcile_board")
    async def reconcile_board(board_id: str) -> int:
        return 0

    return [
        fetch_card,
        move_card,
        publish_comment,
        ensure_workspace,
        ensure_job,
        observe_job,
        stop_job,
        confirm_terminated,
        configured_board_ids,
        reconcile_board,
    ]


@pytest_asyncio.fixture
async def env():
    # Same converter as production, or the tests would exercise a wire format
    # the deployed workers never use.
    environment = await WorkflowEnvironment.start_time_skipping(
        data_converter=pydantic_data_converter
    )
    try:
        yield environment
    finally:
        await environment.shutdown()


@pytest_asyncio.fixture
def world() -> FakeWorld:
    return FakeWorld()


@pytest_asyncio.fixture
async def worker(env, world):
    from orchestrator.workflows.dispatcher import DesktopDispatcherWorkflow
    from orchestrator.workflows.task import TaskWorkflow

    from sink_workflow import SinkWorkflow

    async with Worker(
        env.client,
        task_queue=TASK_QUEUE,
        workflows=[TaskWorkflow, DesktopDispatcherWorkflow, SinkWorkflow],
        activities=build_activities(world),
    ):
        yield env.client


def sample_handoff(card_id: str = "card-1", **overrides) -> Handoff:
    body = dict(
        task_id=card_id,
        spec_revision="spec-1",
        design_revision="design-1",
        repository="chrtol/home-cluster",
        base_commit="a" * 40,
        goal="do the thing",
        scope=["src/thing.py"],
        out_of_scope=[],
        allowed_paths=["src/**"],
        interfaces=[],
        dependencies=[],
        acceptance_checks=["unit"],
        open_questions=[],
    )
    body.update(overrides)
    return Handoff(**body)
