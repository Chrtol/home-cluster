"""Replay guard: does today's workflow code still understand yesterday's history?

Nothing else in this suite can answer that. Every other test starts from an
empty history, so a change that alters *which commands* a given event issues
looks perfectly healthy here and then wedges every card in flight the moment it
is deployed -- the workflow task fails `NonDeterministicError`, queries stop
answering, and a worker restart fixes nothing (PHASE_2_Board_Lifecycle.md §7d).

Two corpora, because a replay test with only good fixtures cannot tell you it is
working:

* `histories/` must replay clean. This is the regression guard.
* `histories/nondeterministic/` must **fail**. It is a real history from the
  cluster, captured mid-incident, that the code has genuinely diverged from. If
  the replayer ever accepts it, the guard above has stopped guarding.

Neither corpus needs a Temporal server: a `Replayer` runs the workflow code
against recorded events in-process, so this is the one part of the suite that is
fast and offline.
"""

from __future__ import annotations

import json
import pathlib

import pytest
from temporalio.client import WorkflowHistory
from temporalio.contrib.pydantic import pydantic_data_converter
from temporalio.worker import Replayer
from temporalio.worker.workflow_sandbox import SandboxedWorkflowRunner
from temporalio.workflow import NondeterminismError

from orchestrator.workflows.dispatcher import DesktopDispatcherWorkflow
from orchestrator.workflows.reconcile import ReconcileWorkflow
from orchestrator.workflows.smoke import SmokeWorkflow
from orchestrator.workflows.task import TaskWorkflow

HISTORIES = pathlib.Path(__file__).parent / "histories"
DIVERGED = HISTORIES / "nondeterministic"

WORKFLOWS = [TaskWorkflow, DesktopDispatcherWorkflow, ReconcileWorkflow, SmokeWorkflow]


def _replayer() -> Replayer:
    # The same converter the deployed workers use. With the default one the
    # `Stage` fields decode to lists of characters (see contracts.py), which
    # would surface here as a decode error rather than the nondeterminism this
    # file is looking for.
    return Replayer(
        workflows=WORKFLOWS,
        data_converter=pydantic_data_converter,
        workflow_runner=SandboxedWorkflowRunner(),
    )


def _load(path: pathlib.Path) -> WorkflowHistory:
    return WorkflowHistory.from_json(path.stem, json.loads(path.read_text()))


def _cases(directory: pathlib.Path) -> list[pathlib.Path]:
    return sorted(p for p in directory.glob("*.json"))


CLEAN = _cases(HISTORIES)
BROKEN = _cases(DIVERGED)


def test_the_clean_corpus_is_not_empty():
    """A directory emptied by a bad merge would make every test below vacuous."""
    assert CLEAN, f"no histories in {HISTORIES}; run scripts/generate_histories.py"


def test_the_diverged_corpus_is_not_empty():
    assert BROKEN, f"no histories in {DIVERGED}; the guard cannot prove it detects anything"


@pytest.mark.parametrize("path", CLEAN, ids=lambda p: p.stem)
async def test_history_still_replays(path: pathlib.Path):
    """If this fails, deploying the change will wedge every card in flight.

    Regenerating the corpus is not the fix. It silences the alarm and leaves the
    board wedged. Either keep the command sequence compatible, or drain the
    board, then regenerate deliberately.
    """
    await _replayer().replay_workflow(_load(path))


@pytest.mark.parametrize("path", BROKEN, ids=lambda p: p.stem)
async def test_a_diverged_history_is_still_rejected(path: pathlib.Path):
    """Proof the guard has teeth, not a test of the application.

    Captured from `task-4zomih22b1w3` on 2026-09-09, before the §7c fix. That
    fix replaced an Activity with a signal at the same point in the sequence, so
    the replayer meets a `SignalExternalWorkflowExecutionInitiated` where the
    recorded history has an `ActivityTaskScheduled`. That is exactly the class of
    change this file exists to catch, and here it is, from production.
    """
    with pytest.raises(NondeterminismError):
        await _replayer().replay_workflow(_load(path))
