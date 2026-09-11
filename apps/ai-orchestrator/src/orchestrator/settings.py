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
        # Named, because this is read at import time and the CrashLoop message
        # is the only clue as to which variable is malformed.
        raise ValueError(f"{name}={raw!r} is not an integer") from exc


def _interval(name: str, default: int) -> int:
    """Seconds, must be positive.

    0 means *disabled* for JOB_FAIL_AT_STEP nearby, but here it would mean
    `workflow.sleep(0)` between sweeps — a continuous loop, not off.
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
    # Defence in depth against a webhook loop; the state machine in
    # workflows.task is already structurally loop-free. Only meaningful once
    # the orchestrator has its own kan user.
    kan_self_actor_id: str

    projects_path: str

    # --- Kubernetes ---
    jobs_namespace: str
    workspace_storage_class: str
    workspace_size: str
    # Image the coding Job runs; currently the orchestrator's own, whose dummy
    # worker stands in for OpenCode.
    job_image: str
    # Makes the dummy worker fail at a chosen step, to exercise the Blocked
    # path. 0 disables. Settings-level, not a handoff field: board text must
    # not be able to steer execution.
    job_fail_at_step: int
    # Blast radius for the knob above. Empty means EVERY attempt on every
    # board fails.
    job_fail_task_id: str
    reconcile_interval_seconds: int

    # --- dispatcher ---
    desktop_id: str
    # INERT: both workflows hardcode their Continue-As-New thresholds, so
    # setting these does nothing. Wiring them up changes when ContinueAsNew is
    # issued, which breaks replay of in-flight workflows without a
    # workflow.patched() gate.
    dispatcher_history_limit: int
    task_history_limit: int

    # --- memory ---
    # Read-only retrieval for context assembly. An empty key disables it: the
    # manifest then records lessons as degraded and the attempt runs anyway,
    # because optional lessons must never block execution.
    #
    # Last, and the only fields here carrying defaults, because every other one
    # is passed positionally by callers that predate them. A field added in the
    # middle without a default breaks all of them at once.
    memini_base_url: str = "http://memini.ai.svc.cluster.local:8080"
    memini_api_key: str = ""

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
            memini_base_url=os.environ.get(
                "MEMINI_BASE_URL", "http://memini.ai.svc.cluster.local:8080"
            ),
            memini_api_key=os.environ.get("MEMINI_API_KEY", ""),
            desktop_id=os.environ.get("DESKTOP_ID", "primary"),
            dispatcher_history_limit=_int("DISPATCHER_HISTORY_LIMIT", 500),
            task_history_limit=_int("TASK_HISTORY_LIMIT", 200),
        )

    @property
    def dispatcher_workflow_id(self) -> str:
        return f"desktop-dispatcher-{self.desktop_id}"

    def fail_step_for(self, task_id: str) -> int:
        """Which step, if any, this task's dummy Job should fail at.

        Read here, not in the workflow, so arming it affects the next Job
        created — including for cards whose workflow already exists. A memo
        would be fixed at workflow-start and silently do nothing for those.
        """
        if not self.job_fail_at_step:
            return 0
        if self.job_fail_task_id and task_id != self.job_fail_task_id:
            return 0
        return self.job_fail_at_step


def task_workflow_id(card_id: str) -> str:
    """One workflow per card, for the life of the card.

    Deliberately not per revision: revoking an approval when a design changes
    mid-execution spans two revisions, so a per-revision workflow could only
    honour it by being terminated from outside. It also lets the webhook
    address the workflow knowing only the card publicId.
    """
    return f"task-{card_id}"
