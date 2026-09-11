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

import base64
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


# Patch id -> the history that recorded the *patched* side of that gate.
#
# A `workflow.patched` gate is invisible to the test above. Every history
# captured before the gate shipped answers False at it and replays clean whether
# the new branch is correct, broken or deleted -- so a corpus of only those
# proves nothing about the branch the gate was added for. The entry below exists
# so at least one fixture has actually been through it.
PATCHED_BRANCHES = {
    "delete-job-after-finish": "task-evidence-collected",
}


def _recorded_patch_ids(path: pathlib.Path) -> set[str]:
    """Patch ids a history went through.

    Temporal records these as `core_patch` marker events whose payload is
    base64-encoded JSON, so grepping the file for the id finds nothing.
    """
    ids: set[str] = set()
    for event in json.loads(path.read_text()).get("events", []):
        attrs = event.get("markerRecordedEventAttributes")
        if not attrs or attrs.get("markerName") != "core_patch":
            continue
        for detail in (attrs.get("details") or {}).values():
            for payload in detail.get("payloads") or []:
                data = payload.get("data")
                if data:
                    ids.add(json.loads(base64.b64decode(data))["id"])
    return ids


@pytest.mark.parametrize("patch_id,stem", sorted(PATCHED_BRANCHES.items()))
def test_a_patch_gate_has_a_history_that_took_it(patch_id: str, stem: str):
    """Regenerating that fixture against code without the gate must be loud.

    It would otherwise leave a file that still replays perfectly and no longer
    covers anything, which is the quietest possible way to lose a guard.
    """
    path = HISTORIES / f"{stem}.json"
    assert path in CLEAN, f"{path.name} is missing from the clean corpus"
    assert patch_id in _recorded_patch_ids(path), (
        f"{path.name} no longer records patch {patch_id!r}, so nothing exercises "
        f"the patched branch any more"
    )


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
