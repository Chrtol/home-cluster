"""The worker must be able to restart.

Exercises ensure_singletons against a real server, twice: the failure it guards
is invisible on a first boot, because the singletons do not exist yet.
"""

from __future__ import annotations

import pytest
import pytest_asyncio
from temporalio.contrib.pydantic import pydantic_data_converter
from temporalio.service import RPCError, RPCStatusCode
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
    """Regression: the second call used to raise WorkflowAlreadyStartedError."""
    settings = Settings.from_env()

    await ensure_singletons(settings, bare_env.client)
    # The call that used to kill the worker.
    await ensure_singletons(settings, bare_env.client)

    for workflow_id in (settings.dispatcher_workflow_id, "board-reconciler"):
        desc = await bare_env.client.get_workflow_handle(workflow_id).describe()
        assert desc.status.name == "RUNNING", workflow_id


async def test_the_singletons_come_back_after_an_operator_terminates_one(bare_env):
    """The documented recovery for a wedged singleton: terminate it."""
    settings = Settings.from_env()
    await ensure_singletons(settings, bare_env.client)

    handle = bare_env.client.get_workflow_handle(settings.dispatcher_workflow_id)
    before = (await handle.describe()).run_id
    await handle.terminate("simulating an operator recovery")

    # The assertion below is only meaningful if the state really changed.
    assert (await handle.describe()).status.name == "TERMINATED"

    await ensure_singletons(settings, bare_env.client)

    after = await bare_env.client.get_workflow_handle(settings.dispatcher_workflow_id).describe()
    assert after.status.name == "RUNNING"
    assert after.run_id != before, "adopted the terminated run instead of starting a new one"


async def test_a_worker_that_cannot_reach_temporal_refuses_to_start(bare_env, monkeypatch):
    """The catch must re-raise, not log and continue."""
    settings = Settings.from_env()

    async def unreachable(*_args, **_kwargs):
        raise RPCError("frontend is down", RPCStatusCode.UNAVAILABLE, b"")

    monkeypatch.setattr(bare_env.client, "start_workflow", unreachable)

    with pytest.raises(RPCError):
        await ensure_singletons(settings, bare_env.client)


async def test_an_error_that_is_not_an_rpc_error_is_not_swallowed_either(bare_env, monkeypatch):
    """The catch is narrow; anything it does not name must still propagate."""
    settings = Settings.from_env()

    async def surprising(*_args, **_kwargs):
        raise TypeError("data converter cannot encode this argument")

    monkeypatch.setattr(bare_env.client, "start_workflow", surprising)

    with pytest.raises(TypeError):
        await ensure_singletons(settings, bare_env.client)


async def test_both_singletons_are_started_not_just_the_first(bare_env):
    """Counterweight: "the first one worked" is not "both worked"."""
    settings = Settings.from_env()
    await ensure_singletons(settings, bare_env.client)

    for workflow_id in (settings.dispatcher_workflow_id, "board-reconciler"):
        desc = await bare_env.client.get_workflow_handle(workflow_id).describe()
        assert desc.status.name == "RUNNING", workflow_id
