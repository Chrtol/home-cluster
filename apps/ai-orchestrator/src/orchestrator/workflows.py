"""Workflow definitions.

Workflow code must be deterministic and replayable: no clocks, no I/O, no
randomness. Anything else belongs in an Activity.
"""

from __future__ import annotations

from datetime import timedelta

from temporalio import workflow

with workflow.unsafe.imports_passed_through():
    from .activities import record_step


@workflow.defn
class SmokeWorkflow:
    """Phase 1 gate: proves a history survives losing the worker mid-run.

    The durable timer between the two activities is the point. Kill the worker
    while it is sleeping and start it again: the timer is server-side, so the
    workflow resumes and completes rather than restarting or failing.
    """

    def __init__(self) -> None:
        self._steps: list[str] = []

    @workflow.run
    async def run(self, sleep_seconds: int = 60) -> dict[str, object]:
        opts = {
            "start_to_close_timeout": timedelta(seconds=30),
        }

        self._steps.append(await workflow.execute_activity(record_step, "started", **opts))

        # Durable timer, held by the server rather than this process.
        await workflow.sleep(timedelta(seconds=sleep_seconds))

        self._steps.append(await workflow.execute_activity(record_step, "resumed", **opts))

        return {"steps": self._steps, "slept_seconds": sleep_seconds}

    @workflow.query
    def steps(self) -> list[str]:
        """Read-only status, answerable while the workflow is still running."""
        return self._steps
