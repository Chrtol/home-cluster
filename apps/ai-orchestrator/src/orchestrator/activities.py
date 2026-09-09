"""Activities. Everything non-deterministic lives here, never in a workflow."""

from __future__ import annotations

from datetime import datetime, timezone

from temporalio import activity


@activity.defn
async def record_step(step: str) -> str:
    """Trivial side effect standing in for a real board/Kubernetes call."""
    stamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
    activity.logger.info("step=%s at=%s", step, stamp)
    return f"{step}@{stamp}"
