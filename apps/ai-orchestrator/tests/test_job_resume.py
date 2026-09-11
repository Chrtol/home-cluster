"""Fresh-session recovery: an attempt stopped mid-run continues from files.

The gate is "stop mid-task and resume from files without relying on an
in-memory session", so nothing here is carried between the two runs except the
workspace directory and the context package. Each attempt is a separate call
into `main()` with its own environment, which is as close as a unit test gets
to a second pod.

The `/context` directory is built by the **real assembler**, not hand-written.
That is the point: the orchestrator writes the manifest and the worker reads it,
and a test with a hand-made manifest would keep passing after one of them
renamed a key.
"""

from __future__ import annotations

import json
import time

import pytest

from orchestrator.activities import assemble as assemble_acts
from orchestrator.context import assemble
from orchestrator.context.manifest import LessonsStatus
from orchestrator.contracts import Approval, AttemptRef, BoardActor
from orchestrator.job import dummy_worker

from conftest import sample_handoff

STEPS = 6


def attempt(number: int) -> AttemptRef:
    return AttemptRef(
        task_id="card-1",
        board_id="board-1",
        handoff_hash=sample_handoff("card-1").content_hash(),
        attempt_number=number,
    )


def write_context(tmp_path, number: int, previous: str = "", handoff=None):
    """Assemble a real package and lay it out as the pod would see it."""
    card = handoff or sample_handoff("card-1")
    package = assemble.build(
        approval=Approval(
            actor=BoardActor(id="human-1"),
            handoff_hash=card.content_hash(),
            design_revision="designs/card-1.md@" + "c" * 40,
            base_commit="a" * 40,
            repository="chrtol/home-cluster",
            recorded_at="2026-09-11T12:00:00+00:00",
            event_key="evt",
        ),
        handoff=card,
        attempt=AttemptRef(
            task_id="card-1",
            board_id="board-1",
            handoff_hash=card.content_hash(),
            attempt_number=number,
        ),
        job_image="image:test",
        policy_text=assemble_acts.policy_text(),
        lessons=[],
        lessons_status=LessonsStatus(status="ok"),
        previous_attempt=previous,
        built_at="2026-09-11T12:00:00+00:00",
    )
    directory = tmp_path / f"context-a{number}"
    directory.mkdir()
    for name, body in package.files.items():
        (directory / name).write_text(body)
    return directory


def run_attempt(monkeypatch, tmp_path, number: int, *, context_dir=None, stop_after=None) -> int:
    """One pod's worth of work. Returns the exit code.

    `stop_after` fires the real SIGTERM handler partway through, which is what a
    shift ending or an operator stop does to a running attempt.
    """
    workspace = tmp_path / "workspace"
    workspace.mkdir(exist_ok=True)

    calls = {"n": 0}

    def fake_sleep(_seconds):
        calls["n"] += 1
        if stop_after is not None and calls["n"] == stop_after:
            dummy_worker._on_term(15, None)

    monkeypatch.setattr(dummy_worker.time, "sleep", fake_sleep)
    monkeypatch.setattr(dummy_worker, "_stopping", False)

    monkeypatch.setenv("WORKSPACE", str(workspace))
    monkeypatch.setenv("CONTEXT_DIR", str(context_dir or tmp_path / "no-such-context"))
    monkeypatch.setenv("ATTEMPT_ID", attempt(number).job_name)
    monkeypatch.setenv("TASK_ID", "card-1")
    monkeypatch.setenv("STEPS", str(STEPS))
    monkeypatch.setenv("FAIL_AT_STEP", "0")
    monkeypatch.setenv("STEP_SECONDS", "0")
    return dummy_worker.main()


def checkpoint(tmp_path, number: int) -> dict:
    path = tmp_path / "workspace" / "attempts" / attempt(number).job_name / "checkpoint.json"
    return json.loads(path.read_text())


class TestResumeFromFiles:
    def test_an_interrupted_attempt_records_what_it_finished(self, monkeypatch, tmp_path):
        context = write_context(tmp_path, 1)
        assert run_attempt(monkeypatch, tmp_path, 1, context_dir=context, stop_after=3) == 0

        first = checkpoint(tmp_path, 1)
        assert first["status"] == "interrupted"
        assert first["completed_steps"] == [1, 2, 3]
        assert first["remaining_steps"] == [4, 5, 6]
        assert first["terminated_cleanly"] is True
        assert first["handoff_hash"] == sample_handoff("card-1").content_hash()

    def test_the_next_attempt_starts_where_the_last_one_stopped(self, monkeypatch, tmp_path):
        """The gate. A new pod, a new attempt id, no shared memory at all."""
        first_context = write_context(tmp_path, 1)
        run_attempt(monkeypatch, tmp_path, 1, context_dir=first_context, stop_after=3)

        second_context = write_context(tmp_path, 2, previous=attempt(1).job_name)
        sleeps = _count_sleeps(monkeypatch, tmp_path, 2, second_context)

        second = checkpoint(tmp_path, 2)
        assert second["resumed_from"] == attempt(1).job_name
        assert second["completed_steps"] == [1, 2, 3, 4, 5, 6]
        assert second["status"] == "succeeded"
        # Three steps of work, not six: the completed ones were skipped rather
        # than redone. Without this the checkpoint above would look identical
        # whether the attempt resumed or started over.
        assert sleeps == 3, f"expected to run only steps 4-6, ran {sleeps} steps"

    def test_without_the_resume_pointer_it_starts_over(self, monkeypatch, tmp_path):
        """The mutation control for the test above.

        Same workspace, same completed checkpoint on disk, only the manifest's
        pointer removed -- and the work is done again from step 1. That is what
        proves the resume was driven by the package rather than by the worker
        happening to find a file.
        """
        first_context = write_context(tmp_path, 1)
        run_attempt(monkeypatch, tmp_path, 1, context_dir=first_context, stop_after=3)

        without = write_context(tmp_path, 2)  # no `previous`
        sleeps = _count_sleeps(monkeypatch, tmp_path, 2, without)

        assert checkpoint(tmp_path, 2)["resumed_from"] == ""
        assert sleeps == STEPS, "the mutation did not apply: it still skipped steps"


class TestABadCheckpointIsNotFatal:
    def test_an_unparsable_prior_checkpoint_restarts_and_says_why(self, monkeypatch, tmp_path):
        first_context = write_context(tmp_path, 1)
        run_attempt(monkeypatch, tmp_path, 1, context_dir=first_context, stop_after=3)

        path = (
            tmp_path / "workspace" / "attempts" / attempt(1).job_name / "checkpoint.json"
        )
        path.write_text("{ this is not json")

        second_context = write_context(tmp_path, 2, previous=attempt(1).job_name)
        assert run_attempt(monkeypatch, tmp_path, 2, context_dir=second_context) == 0

        second = checkpoint(tmp_path, 2)
        assert second["resume_status"].startswith("ignored: ")
        assert "unreadable" in second["resume_status"]
        assert second["completed_steps"] == [1, 2, 3, 4, 5, 6]
        assert second["resumed_from"] == "", "a discarded checkpoint is not a resume"

    def test_a_checkpoint_from_another_approved_revision_is_ignored(self, monkeypatch, tmp_path):
        """Validate the reference rather than trusting the summary.

        A checkpoint naming a different handoff describes work against a
        contract this attempt was not approved for, so its completed steps are
        not this attempt's completed steps.
        """
        first_context = write_context(tmp_path, 1)
        run_attempt(monkeypatch, tmp_path, 1, context_dir=first_context, stop_after=3)

        path = tmp_path / "workspace" / "attempts" / attempt(1).job_name / "checkpoint.json"
        prior = json.loads(path.read_text())
        prior["handoff_hash"] = "0123456789abcdef"
        path.write_text(json.dumps(prior))

        second_context = write_context(tmp_path, 2, previous=attempt(1).job_name)
        sleeps = _count_sleeps(monkeypatch, tmp_path, 2, second_context)

        second = checkpoint(tmp_path, 2)
        assert "ignored: prior checkpoint is for handoff" in second["resume_status"]
        assert sleeps == STEPS, "it resumed from a checkpoint for a different contract"

    def test_a_missing_prior_checkpoint_is_survivable(self, monkeypatch, tmp_path):
        """A first attempt that died before writing anything leaves no file."""
        context = write_context(tmp_path, 2, previous=attempt(1).job_name)
        assert run_attempt(monkeypatch, tmp_path, 2, context_dir=context) == 0
        assert checkpoint(tmp_path, 2)["resume_status"].startswith("ignored: ")


class TestWithoutAContextMount:
    def test_an_attempt_from_before_the_patch_gate_still_runs(self, monkeypatch, tmp_path):
        """A workflow that predates context assembly mounts no `/context`.

        Its Job must still work: the gate means both shapes are live at once
        until every pre-deploy card has drained.
        """
        assert run_attempt(monkeypatch, tmp_path, 1) == 0

        only = checkpoint(tmp_path, 1)
        assert only["status"] == "succeeded"
        assert only["completed_steps"] == [1, 2, 3, 4, 5, 6]
        assert only["resumed_from"] == ""

    def test_the_failure_knob_still_works_with_a_context(self, monkeypatch, tmp_path):
        context = write_context(tmp_path, 1)
        monkeypatch.setenv("FAIL_AT_STEP", "3")
        workspace = tmp_path / "workspace"
        workspace.mkdir(exist_ok=True)
        monkeypatch.setattr(dummy_worker.time, "sleep", lambda _s: None)
        monkeypatch.setattr(dummy_worker, "_stopping", False)
        monkeypatch.setenv("WORKSPACE", str(workspace))
        monkeypatch.setenv("CONTEXT_DIR", str(context))
        monkeypatch.setenv("ATTEMPT_ID", attempt(1).job_name)
        monkeypatch.setenv("TASK_ID", "card-1")
        monkeypatch.setenv("STEPS", str(STEPS))
        monkeypatch.setenv("STEP_SECONDS", "0")

        assert dummy_worker.main() == 17
        failed = checkpoint(tmp_path, 1)
        assert failed["status"] == "failed"
        assert failed["failed_step"] == 3
        assert failed["completed_steps"] == [1, 2]


def _count_sleeps(monkeypatch, tmp_path, number: int, context_dir) -> int:
    """Run an attempt and report how many steps actually did work.

    The step loop sleeps once per step it runs and skips completed ones without
    sleeping, so this counts work done rather than work claimed.
    """
    counted = {"n": 0}
    real_setattr = monkeypatch.setattr

    def counting_sleep(_seconds):
        counted["n"] += 1

    workspace = tmp_path / "workspace"
    workspace.mkdir(exist_ok=True)
    real_setattr(dummy_worker.time, "sleep", counting_sleep)
    real_setattr(dummy_worker, "_stopping", False)
    monkeypatch.setenv("WORKSPACE", str(workspace))
    monkeypatch.setenv("CONTEXT_DIR", str(context_dir))
    monkeypatch.setenv("ATTEMPT_ID", attempt(number).job_name)
    monkeypatch.setenv("TASK_ID", "card-1")
    monkeypatch.setenv("STEPS", str(STEPS))
    monkeypatch.setenv("FAIL_AT_STEP", "0")
    monkeypatch.setenv("STEP_SECONDS", "0")
    dummy_worker.main()
    return counted["n"]
