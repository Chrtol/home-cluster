"""Runtime configuration, read from the environment."""

from __future__ import annotations

import os
from dataclasses import dataclass


def _int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError as exc:
        # Name the variable. A bare "invalid literal for int()" from a config
        # read at import time gives whoever is reading the CrashLoop no way to
        # tell which of a dozen env vars is malformed.
        raise ValueError(f"{name}={raw!r} is not an integer") from exc


def _interval(name: str, default: int) -> int:
    """An interval in seconds, which must be positive.

    `0` is the *disabled* value for `JOB_FAIL_AT_STEP` a few fields away, so an
    operator reaching for the same symmetry here would get the opposite of off:
    `workflow.sleep(0)` between sweeps, which hammers kan continuously and rolls
    the reconciler's history over and over. Refuse rather than guess, and say
    so, because the mistake is a reasonable one to make.
    """
    seconds = _int(name, default)
    if seconds <= 0:
        raise ValueError(
            f"{name}={seconds} must be a positive number of seconds; 0 does not mean 'disabled'"
        )
    return seconds


@dataclass(frozen=True)
class Settings:
    address: str
    namespace: str
    task_queue: str

    # --- board ---
    kan_base_url: str
    kan_api_key: str
    kan_webhook_secret: str
    # Origin marker for plan §8's loop rule. Optional: the state machine is
    # already structurally loop-free (see workflows.task), so this is defence
    # in depth and is only meaningful once the orchestrator holds its own kan
    # user rather than sharing a human's API key.
    kan_self_actor_id: str

    projects_path: str

    # --- Kubernetes ---
    jobs_namespace: str
    workspace_storage_class: str
    workspace_size: str
    # Image the coding Job runs. Phase 2 points this at the orchestrator's own
    # image, whose dummy worker stands in for OpenCode until Phase 4.
    job_image: str
    # Phase 2 test affordance (plan §13): make the dummy worker fail at a chosen
    # step so the repair path and the Blocked transition can be exercised for
    # real. Settings-level on purpose — a handoff field would let untrusted board
    # text steer execution. 0 disables it.
    job_fail_at_step: int
    # Blast radius for the knob above. Empty means every attempt fails, which is
    # almost never what an operator wants on a board carrying real cards; naming
    # the one card under test keeps the rest of the board working. The operator
    # supplies this id from trusted config, so it is not the card describing
    # itself.
    job_fail_task_id: str
    reconcile_interval_seconds: int

    # --- dispatcher ---
    desktop_id: str
    # Continue-As-New thresholds. Plan §7 requires bounded histories; these are
    # signal counts, not time, because an idle dispatcher writes no history.
    #
    # INERT as of 2026-09-10, and the comment above described an intent rather
    # than the code. Both workflows hardcode their own thresholds --
    # `task.py` uses `events_handled >= 200 or history > 8000`, `dispatcher.py`
    # uses `signals_handled >= 500 or history > 8000` -- and neither reads these
    # fields. Setting them in the HelmRelease therefore does nothing at all.
    #
    # Wiring them up is not a drive-by: the threshold decides *when* a workflow
    # issues ContinueAsNew, so changing where that number comes from changes
    # which commands a replayed history expects and needs its own
    # `workflow.patched()` gate (PHASE_2 §7d/§7e). Pinned by
    # test_startup.test_the_history_limit_settings_reach_no_consumer.
    dispatcher_history_limit: int
    task_history_limit: int

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            address=os.environ.get(
                "TEMPORAL_ADDRESS", "temporal-frontend.ai.svc.cluster.local:7233"
            ),
            namespace=os.environ.get("TEMPORAL_NAMESPACE", "ai-coding"),
            task_queue=os.environ.get("TEMPORAL_TASK_QUEUE", "ai-coding"),
            kan_base_url=os.environ.get("KAN_BASE_URL", ""),
            kan_api_key=os.environ.get("KAN_API_KEY", ""),
            kan_webhook_secret=os.environ.get("KAN_WEBHOOK_SECRET", ""),
            kan_self_actor_id=os.environ.get("KAN_SELF_ACTOR_ID", ""),
            projects_path=os.environ.get("PROJECTS_PATH", "/config/projects.yaml"),
            jobs_namespace=os.environ.get("JOBS_NAMESPACE", "ai-jobs"),
            workspace_storage_class=os.environ.get("WORKSPACE_STORAGE_CLASS", "csi-rbd-sc"),
            workspace_size=os.environ.get("WORKSPACE_SIZE", "5Gi"),
            job_image=os.environ.get("JOB_IMAGE", ""),
            job_fail_at_step=_int("JOB_FAIL_AT_STEP", 0),
            job_fail_task_id=os.environ.get("JOB_FAIL_TASK_ID", ""),
            reconcile_interval_seconds=_interval("RECONCILE_INTERVAL_SECONDS", 300),
            desktop_id=os.environ.get("DESKTOP_ID", "primary"),
            dispatcher_history_limit=_int("DISPATCHER_HISTORY_LIMIT", 500),
            task_history_limit=_int("TASK_HISTORY_LIMIT", 200),
        )

    @property
    def dispatcher_workflow_id(self) -> str:
        return f"desktop-dispatcher-{self.desktop_id}"

    def fail_step_for(self, task_id: str) -> int:
        """Which step, if any, this task's dummy Job should fail at.

        Answered here rather than in the workflow so the knob takes effect on the
        next Job the worker creates. A workflow-side source — a memo, like
        `job_image` — is fixed when the card's workflow first starts, so arming
        it would silently do nothing for every card the board already knows
        about, which is exactly the set an operator would reach for to test with.
        """
        if not self.job_fail_at_step:
            return 0
        if self.job_fail_task_id and task_id != self.job_fail_task_id:
            return 0
        return self.job_fail_at_step


def task_workflow_id(card_id: str) -> str:
    """One workflow per card, for the life of the card.

    Deliberately *not* per revision. Plan §7 calls TaskWorkflow "one task
    revision", but a per-revision workflow cannot implement plan §12's "design
    changes during execution -> revoke stale approval, stop the attempt and
    return to design review": that transition spans two revisions, so a
    per-revision workflow would have to be terminated from outside to honour it.
    Keying on the card instead makes revision a piece of workflow state, and the
    revision change becomes an ordinary handled event.

    It also means the webhook receiver can address the workflow knowing only the
    card publicId, without reading the card first to discover its revision.
    """
    return f"task-{card_id}"
