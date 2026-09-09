"""Phase 2's stand-in for the real coding harness.

Plan §13 Phase 2 calls for "a dummy Job that writes checkpoints and deliberately
fails when requested". This is that Job. It runs inside the same isolated pod
the real attempt will use, so the containment, workspace and fencing paths are
exercised for real even though nothing is being coded yet.

It mimics three behaviours of the eventual OpenCode wrapper:

* an attempt manifest written once at start,
* a checkpoint written after each completed step, atomically,
* a bounded shutdown on SIGTERM, so a stop request produces a final checkpoint
  rather than a truncated one.

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

    Plan §11 wants a bounded shutdown path rather than a promise of lossless
    recovery: the current step is abandoned, the last completed checkpoint
    stands.
    """
    global _stopping
    _stopping = True
    print(f"signal {signum} received; finishing current step then stopping", flush=True)


def _write_atomic(path: Path, payload: dict[str, object]) -> None:
    """Write JSON so a reader never sees a half-written checkpoint.

    The temp file is created in the same directory so the rename is a same
    filesystem operation and therefore atomic.
    """
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2, sort_keys=True))
    os.replace(tmp, path)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def main() -> int:
    signal.signal(signal.SIGTERM, _on_term)
    signal.signal(signal.SIGINT, _on_term)

    workspace = Path(os.environ.get("WORKSPACE", "/workspace"))
    attempt_id = os.environ.get("ATTEMPT_ID", "unknown")
    steps = int(os.environ.get("STEPS", "6"))
    fail_at = int(os.environ.get("FAIL_AT_STEP", "0"))
    step_seconds = float(os.environ.get("STEP_SECONDS", "10"))

    attempt_dir = workspace / "attempts" / attempt_id
    attempt_dir.mkdir(parents=True, exist_ok=True)

    _write_atomic(
        attempt_dir / "manifest.json",
        {
            "attempt_id": attempt_id,
            "task_id": os.environ.get("TASK_ID", ""),
            "repository": os.environ.get("REPOSITORY", ""),
            "base_commit": os.environ.get("BASE_COMMIT", ""),
            "steps_planned": steps,
            "fail_at_step": fail_at,
            "started_at": _now(),
        },
    )
    print(f"attempt {attempt_id} started, {steps} steps, workspace {workspace}", flush=True)

    completed: list[int] = []
    for step in range(1, steps + 1):
        if _stopping:
            print("stopping before step", step, flush=True)
            return 0

        time.sleep(step_seconds)

        if fail_at and step == fail_at:
            _write_atomic(
                attempt_dir / "checkpoint.json",
                {
                    "attempt_id": attempt_id,
                    "completed_steps": completed,
                    "failed_step": step,
                    "remaining_steps": list(range(step, steps + 1)),
                    "status": "failed",
                    "updated_at": _now(),
                },
            )
            print(f"step {step} failed deliberately (FAIL_AT_STEP)", file=sys.stderr, flush=True)
            return 17

        completed.append(step)
        _write_atomic(
            attempt_dir / "checkpoint.json",
            {
                "attempt_id": attempt_id,
                "completed_steps": completed,
                "remaining_steps": list(range(step + 1, steps + 1)),
                "status": "running",
                "updated_at": _now(),
            },
        )
        print(f"step {step}/{steps} complete", flush=True)

    _write_atomic(
        attempt_dir / "checkpoint.json",
        {
            "attempt_id": attempt_id,
            "completed_steps": completed,
            "remaining_steps": [],
            "status": "succeeded",
            "updated_at": _now(),
        },
    )
    print(f"attempt {attempt_id} complete", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
