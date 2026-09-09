"""Runtime configuration, read from the environment."""

from __future__ import annotations

import os
from dataclasses import dataclass


def _int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    return int(raw) if raw else default


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
    reconcile_interval_seconds: int

    # --- dispatcher ---
    desktop_id: str
    # Continue-As-New thresholds. Plan §7 requires bounded histories; these are
    # signal counts, not time, because an idle dispatcher writes no history.
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
            reconcile_interval_seconds=_int("RECONCILE_INTERVAL_SECONDS", 300),
            desktop_id=os.environ.get("DESKTOP_ID", "primary"),
            dispatcher_history_limit=_int("DISPATCHER_HISTORY_LIMIT", 500),
            task_history_limit=_int("TASK_HISTORY_LIMIT", 200),
        )

    @property
    def dispatcher_workflow_id(self) -> str:
        return f"desktop-dispatcher-{self.desktop_id}"


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
