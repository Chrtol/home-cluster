"""Phase 2's stand-in for the real coding harness.

The plan calls for "a dummy Job that writes checkpoints and deliberately fails
when requested". This is that Job. It runs inside the same isolated pod the real
attempt will use, so the containment, workspace, context and fencing paths are
exercised for real even though nothing is being coded yet.

It mimics four behaviours of the eventual OpenCode wrapper:

* an attempt manifest written once at start,
* the read-only context package at `/context` read before any work,
* a checkpoint written after each completed step, atomically,
* a bounded shutdown on SIGTERM, so a stop request produces a final checkpoint
  rather than a truncated one.

**Resume is the point of the checkpoint.** A pod can vanish at any moment -- a
shift expires, a node reboots, a human stops it -- and nothing survives except
what was written to the workspace volume. Every attempt after the first is
handed the previous attempt's identity in the context manifest and continues
from its completed steps, in a fresh pod, with no in-memory session carried
over. That is the whole recovery story; there is no other half.

`FAIL_AT_STEP` makes failure reproducible on demand, which is what the repair
path and the Blocked transition need in order to be testable at all.
"""

from __future__ import annotations

import json
import os
import signal
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from types import FrameType

_stopping = False


def _on_term(signum: int, _frame: FrameType | None) -> None:
    """Trap termination and let the step loop exit cleanly.

    The plan wants a bounded shutdown path rather than a promise of lossless
    recovery: the current step is abandoned, the last completed checkpoint
    stands, and the next attempt starts from it.
    """
    global _stopping
    _stopping = True
    print(f"signal {signum} received; finishing current step then stopping", flush=True)


def _write_atomic(path: Path, payload: dict[str, object]) -> None:
    """Write JSON so a reader never sees a half-written checkpoint.

    The temp file is created in the same directory so the rename is a same
    filesystem operation and therefore atomic. This is what makes a checkpoint
    safe to read from a *later* pod: the previous one may have been killed
    mid-write, and a torn file would be indistinguishable from a valid one.
    """
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2, sort_keys=True))
    os.replace(tmp, path)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _read_context(context_dir: Path) -> dict:
    """The manifest the orchestrator wrote, or an empty dict.

    Absent is normal, not an error: an attempt dispatched by a workflow that
    predates the context patch gate has no `/context` mount at all, and it must
    still run.
    """
    try:
        return json.loads((context_dir / "manifest.json").read_text())
    except (OSError, ValueError) as exc:
        print(f"no usable context manifest ({exc}); running without one", flush=True)
        return {}


def _resume_from(context: dict, workspace: Path) -> tuple[list[int], str, str]:
    """Load the prior attempt's checkpoint.

    Returns `(completed_steps, resumed_from, status)`. A prior checkpoint that
    is missing, unparsable, or describes a different approved revision is **not
    fatal**: the plan says a compaction summary is fallible and its references
    must be validated rather than trusted, so a bad one is discarded, the work
    restarts from step 1, and the reason is recorded in this attempt's own
    checkpoint where a human will see it.
    """
    resume = context.get("resume") or {}
    previous = str(resume.get("previous_attempt") or "")
    if not previous:
        return [], "", ""

    # The manifest's path is relative to the workspace root, which is the mount
    # this process was actually given. The fallback reconstructs it from the
    # attempt name, which is the same rule the orchestrator used to build it.
    declared = str(resume.get("checkpoint_path") or "")
    path = workspace / (declared or f"attempts/{previous}/checkpoint.json")
    try:
        prior = json.loads(path.read_text())
    except (OSError, ValueError) as exc:
        return [], "", f"ignored: prior checkpoint unreadable ({exc})"

    expected = str(context.get("handoff_hash") or "")
    found = str(prior.get("handoff_hash") or "")
    if expected and found and found != expected:
        # The previous attempt worked to a different approved contract. Its
        # completed steps are not this task's completed steps.
        return [], "", f"ignored: prior checkpoint is for handoff {found}, this attempt is {expected}"

    completed = prior.get("completed_steps")
    if not isinstance(completed, list) or not all(isinstance(s, int) for s in completed):
        return [], "", "ignored: prior checkpoint has no usable completed_steps"

    return sorted(set(completed)), previous, f"resumed from {previous}"


def main() -> int:
    signal.signal(signal.SIGTERM, _on_term)
    signal.signal(signal.SIGINT, _on_term)

    workspace = Path(os.environ.get("WORKSPACE", "/workspace"))
    context_dir = Path(os.environ.get("CONTEXT_DIR", "/context"))
    attempt_id = os.environ.get("ATTEMPT_ID", "unknown")
    steps = int(os.environ.get("STEPS", "6"))
    fail_at = int(os.environ.get("FAIL_AT_STEP", "0"))
    step_seconds = float(os.environ.get("STEP_SECONDS", "10"))

    context = _read_context(context_dir)
    completed, resumed_from, resume_status = _resume_from(context, workspace)

    attempt_dir = workspace / "attempts" / attempt_id
    attempt_dir.mkdir(parents=True, exist_ok=True)
    checkpoint_path = attempt_dir / "checkpoint.json"

    # Identity carried from the context package rather than the environment
    # where both exist: the package is what a human approved, and an env var is
    # what the orchestrator happened to set. They agree today; if they ever
    # diverge the approved one is the honest record.
    handoff_hash = str(context.get("handoff_hash") or "")
    base_commit = str(context.get("base_commit") or os.environ.get("BASE_COMMIT", ""))
    job_image = str(context.get("job_image") or "")

    def checkpoint(status: str, *, failed_step: int = 0, terminated_cleanly: bool = False) -> None:
        _write_atomic(
            checkpoint_path,
            {
                "attempt_id": attempt_id,
                "task_id": os.environ.get("TASK_ID", ""),
                "handoff_hash": handoff_hash,
                "base_commit": base_commit,
                "job_image": job_image,
                "steps_planned": steps,
                "completed_steps": completed,
                "remaining_steps": [s for s in range(1, steps + 1) if s not in completed],
                "failed_step": failed_step,
                "status": status,
                "resumed_from": resumed_from,
                "resume_status": resume_status,
                "terminated_cleanly": terminated_cleanly,
                "updated_at": _now(),
            },
        )

    _write_atomic(
        attempt_dir / "manifest.json",
        {
            "attempt_id": attempt_id,
            "task_id": os.environ.get("TASK_ID", ""),
            "repository": os.environ.get("REPOSITORY", ""),
            "base_commit": base_commit,
            "handoff_hash": handoff_hash,
            "steps_planned": steps,
            "fail_at_step": fail_at,
            "resumed_from": resumed_from,
            "resume_status": resume_status,
            "context_items": len(context.get("items") or []),
            "lessons_status": ((context.get("lessons") or {}).get("status") or ""),
            "started_at": _now(),
        },
    )
    if resume_status:
        print(f"resume: {resume_status}; completed so far {completed}", flush=True)
    print(f"attempt {attempt_id} started, {steps} steps, workspace {workspace}", flush=True)

    for step in range(1, steps + 1):
        if step in completed:
            continue
        if _stopping:
            print("stopping before step", step, flush=True)
            # The interrupted attempt writes its own final checkpoint, so the
            # next one resumes from a file that says what actually happened
            # rather than from the last mid-run write.
            checkpoint("interrupted", terminated_cleanly=True)
            return 0

        time.sleep(step_seconds)

        if fail_at and step == fail_at:
            checkpoint("failed", failed_step=step)
            print(f"step {step} failed deliberately (FAIL_AT_STEP)", file=sys.stderr, flush=True)
            return 17

        completed.append(step)
        checkpoint("running")
        print(f"step {step}/{steps} complete", flush=True)

    checkpoint("succeeded", terminated_cleanly=True)
    print(f"attempt {attempt_id} complete", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
