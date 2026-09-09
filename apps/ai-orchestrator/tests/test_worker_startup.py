"""The worker must be able to restart.

A worker that only starts cleanly once is not a worker. This exercises the real
`ensure_singletons` against a real server, twice, because the failure mode it
guards is invisible on a first boot: the singletons do not exist yet, so the
duplicate-start path is never taken until a restart.
"""

from __future__ import annotations

import pytest_asyncio
from temporalio.contrib.pydantic import pydantic_data_converter
from temporalio.testing import WorkflowEnvironment

from orchestrator.settings import Settings
from orchestrator.worker import ensure_singletons


@pytest_asyncio.fixture
async def bare_env():
    environment = await WorkflowEnvironment.start_time_skipping(
        data_converter=pydantic_data_converter
    )
    try:
        yield environment
    finally:
        await environment.shutdown()


async def test_ensure_singletons_is_safe_to_call_twice(bare_env):
    """Regression: the second call used to raise WorkflowAlreadyStartedError.

    That is not an RPCError, so the `except RPCError` around it never caught it
    and the worker crash-looped on every boot after the first.
    """
    settings = Settings.from_env()

    await ensure_singletons(settings, bare_env.client)
    # The call that used to kill the worker.
    await ensure_singletons(settings, bare_env.client)

    for workflow_id in (settings.dispatcher_workflow_id, "board-reconciler"):
        desc = await bare_env.client.get_workflow_handle(workflow_id).describe()
        assert desc.status.name == "RUNNING", workflow_id
