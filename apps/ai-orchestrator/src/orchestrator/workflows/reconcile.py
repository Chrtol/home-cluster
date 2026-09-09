"""ReconcileWorkflow — sweeps every configured board on a timer.

A workflow rather than a background asyncio task in the worker, because the
sweep must keep happening across pod restarts and must not run twice when two
worker replicas are up. A single workflow ID gives both properties for free.
"""

from __future__ import annotations

from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    from ..activities import board as board_acts
    from ..activities import reconcile as reconcile_acts

_OPTS = dict(
    start_to_close_timeout=timedelta(minutes=5),
    retry_policy=RetryPolicy(maximum_attempts=3, maximum_interval=timedelta(seconds=30)),
)


@workflow.defn
class ReconcileWorkflow:
    def __init__(self) -> None:
        self._sweeps = 0
        self._last_signalled = 0

    @workflow.query
    def status(self) -> dict[str, object]:
        return {"sweeps": self._sweeps, "last_signalled": self._last_signalled}

    @workflow.run
    async def run(self, interval_seconds: int) -> None:
        while True:
            boards = await workflow.execute_activity(board_acts.configured_board_names, **_OPTS)

            signalled = 0
            for board_name in boards:
                # A board that fails to sweep must not stop the others; the
                # activity's own retry policy has already had its say by here.
                try:
                    signalled += await workflow.execute_activity(
                        reconcile_acts.reconcile_board, board_name, **_OPTS
                    )
                except Exception as exc:  # noqa: BLE001
                    workflow.logger.warning("reconcile failed for %s: %s", board_name, exc)

            self._sweeps += 1
            self._last_signalled = signalled

            await workflow.sleep(timedelta(seconds=interval_seconds))

            # The sweep is stateless, so the history can roll on any iteration.
            if workflow.info().get_current_history_length() > 4000:
                workflow.continue_as_new(interval_seconds)
