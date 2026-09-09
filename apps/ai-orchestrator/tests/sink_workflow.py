"""A stand-in for a TaskWorkflow, used by the dispatcher tests.

In its own module rather than in `conftest.py` on purpose: the workflow sandbox
re-imports the module a workflow is defined in, and conftest pulls in pytest and
its plugins, which the sandbox rejects. Keeping the definition here means the
sandbox only ever sees temporalio and the contracts.
"""

from __future__ import annotations

from temporalio import workflow

with workflow.unsafe.imports_passed_through():
    from orchestrator.contracts import SlotGrant


@workflow.defn
class SinkWorkflow:
    """Records what the dispatcher signalled it, and otherwise waits.

    The dispatcher signals whichever workflow asked for a slot, and signalling
    one that does not exist makes it drop the ticket — correct behaviour, but
    not what the dispatcher tests are exercising, so they point tickets here.
    """

    def __init__(self) -> None:
        self._grants: list[str] = []
        self._stops: list[str] = []

    @workflow.signal
    def slot_granted(self, grant: SlotGrant) -> None:
        self._grants.append(f"{grant.task_id}#{grant.attempt_number}")

    @workflow.signal
    def stop(self, reason: str = "") -> None:
        self._stops.append(reason)

    @workflow.query
    def received(self) -> dict[str, list[str]]:
        return {"grants": self._grants, "stops": self._stops}

    @workflow.run
    async def run(self) -> None:
        await workflow.wait_condition(lambda: False)
