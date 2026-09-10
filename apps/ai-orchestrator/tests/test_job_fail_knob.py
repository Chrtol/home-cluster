"""The deliberate-failure knob plan §13 Phase 2 asks for.

*"Use a dummy Job that writes checkpoints and deliberately fails when
requested."* The Job has always honoured `FAIL_AT_STEP` and `ensure_job` has
always forwarded it, but nothing set it, so the Blocked path was not merely
untested — it was unreachable.

Two properties are worth tests rather than one:

1. The knob works, and is scoped, so arming it on a board carrying real cards
   fails only the card under test.
2. The knob is **not reachable from the board**. Plan §4 forbids card text
   choosing what executes, and a failure switch is exactly the sort of thing a
   compromised or careless handoff would reach for.
"""

from __future__ import annotations

from dataclasses import dataclass, replace

import pytest

from orchestrator.activities import context as activity_context
from orchestrator.activities import kubernetes as k8s_acts
from orchestrator.contracts import AttemptRef, JobState, Stage
from orchestrator.settings import Settings

from conftest import sample_handoff
from test_task_workflow import (
    CARD,
    _has_job,
    _moved_to,
    approval_event,
    open_shift,
    start_dispatcher,
    start_task,
    wait_for,
)

BASE = Settings(
    address="localhost:7233",
    namespace="ai-coding",
    task_queue="ai-coding",
    kan_base_url="",
    kan_api_key="",
    kan_webhook_secret="",
    kan_self_actor_id="",
    projects_path="/config/projects.yaml",
    jobs_namespace="ai-jobs",
    workspace_storage_class="csi-rbd-sc",
    workspace_size="5Gi",
    job_image="image:1",
    job_fail_at_step=0,
    job_fail_task_id="",
    reconcile_interval_seconds=300,
    desktop_id="primary",
    dispatcher_history_limit=500,
    task_history_limit=200,
)


class TestScope:
    def test_disarmed_by_default(self):
        assert BASE.fail_step_for("any-card") == 0

    def test_armed_without_a_task_id_hits_every_card(self):
        settings = replace(BASE, job_fail_at_step=3)
        assert settings.fail_step_for("card-a") == 3
        assert settings.fail_step_for("card-b") == 3

    def test_a_task_id_confines_it_to_that_card(self):
        settings = replace(BASE, job_fail_at_step=3, job_fail_task_id="card-a")
        assert settings.fail_step_for("card-a") == 3
        assert settings.fail_step_for("card-b") == 0

    def test_a_task_id_alone_arms_nothing(self):
        """Naming a card without a step is a half-finished edit, not an arming."""
        settings = replace(BASE, job_fail_at_step=0, job_fail_task_id="card-a")
        assert settings.fail_step_for("card-a") == 0


@dataclass
class RecordingRunner:
    """Stands in for JobRunner, capturing the request the Activity finally sent."""

    seen: list = None  # type: ignore[assignment]

    def __post_init__(self) -> None:
        self.seen = []

    async def ensure_job(self, request) -> str:
        self.seen.append(request)
        return request.attempt.job_name


@pytest.fixture
def recording(request):
    runner = RecordingRunner()
    settings = getattr(request, "param", BASE)
    previous = activity_context._context
    activity_context.install(
        activity_context.Context(kan=None, projects=None, settings=settings, jobs=runner)
    )
    try:
        yield runner
    finally:
        activity_context._context = previous


def _request(task_id: str = "card-a") -> k8s_acts.EnsureJobRequest:
    return k8s_acts.EnsureJobRequest(
        attempt=AttemptRef(
            task_id=task_id, board_id="board-1", handoff_hash="h1", attempt_number=1
        ),
        image="image:1",
        base_commit="a" * 40,
        repository="chrtol/home-cluster",
    )


class TestActivityApplication:
    @pytest.mark.parametrize("recording", [BASE], indirect=True)
    async def test_disarmed_leaves_the_request_alone(self, recording):
        await k8s_acts.ensure_job(_request())
        assert recording.seen[0].fail_at_step == 0

    @pytest.mark.parametrize(
        "recording", [replace(BASE, job_fail_at_step=4, job_fail_task_id="card-a")], indirect=True
    )
    async def test_armed_for_this_card_rewrites_the_request(self, recording):
        await k8s_acts.ensure_job(_request("card-a"))
        assert recording.seen[0].fail_at_step == 4

    @pytest.mark.parametrize(
        "recording", [replace(BASE, job_fail_at_step=4, job_fail_task_id="card-a")], indirect=True
    )
    async def test_another_card_on_the_same_board_is_untouched(self, recording):
        await k8s_acts.ensure_job(_request("card-b"))
        assert recording.seen[0].fail_at_step == 0


class TestBoardTextCannotArmIt:
    async def test_the_workflow_always_builds_the_request_disarmed(self, worker, world):
        """Whatever a card says, the workflow's request carries no failure step.

        The handoff below stuffs plausible-looking values into every list field
        it has. If any of them could reach the Job builder, this is where it
        would show.
        """
        world.set_handoff(
            CARD,
            sample_handoff(
                CARD,
                scope=["fail_at_step: 2"],
                acceptance_checks=["unit"],
                open_questions=["FAIL_AT_STEP=2"],
            ),
        )
        dispatcher = await start_dispatcher(worker)
        task = await start_task(worker)
        await open_shift(dispatcher)
        await task.signal("board_event", approval_event())

        assert await wait_for(lambda: _has_job(world))
        assert world.job_requests[0].fail_at_step == 0

    async def test_a_failing_job_still_reaches_blocked(self, worker, world):
        """The end the knob exists to reach, driven the way a real Job reaches it.

        Exit 17 is what `dummy_worker` returns for a deliberate failure, so this
        asserts the same shape the live exercise produces.
        """
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
        assert any(m.startswith("failed-") for m, _ in world.comments)
