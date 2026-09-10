"""The worker must be able to restart.

A worker that only starts cleanly once is not a worker. This exercises the real
`ensure_singletons` against a real server, twice, because the failure mode it
guards is invisible on a first boot: the singletons do not exist yet, so the
duplicate-start path is never taken until a restart.
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


async def test_the_singletons_come_back_after_an_operator_terminates_one(bare_env):
    """PHASE_2 §9's documented recovery, as a test.

    §9 tells an operator to terminate a wedged workflow. Both singletons are
    started with `USE_EXISTING`, which governs a *running* workflow — a
    terminated one is closed, so the next boot has to start a fresh run rather
    than adopt the corpse or refuse. Nothing had ever exercised that: the
    existing restart test only ever sees them Running.
    """
    settings = Settings.from_env()
    await ensure_singletons(settings, bare_env.client)

    handle = bare_env.client.get_workflow_handle(settings.dispatcher_workflow_id)
    before = (await handle.describe()).run_id
    await handle.terminate("simulating the §9 operator recovery")

    # §6.6: the assertion below is only meaningful if the state really changed.
    assert (await handle.describe()).status.name == "TERMINATED"

    await ensure_singletons(settings, bare_env.client)

    after = await bare_env.client.get_workflow_handle(settings.dispatcher_workflow_id).describe()
    assert after.status.name == "RUNNING"
    assert after.run_id != before, "adopted the terminated run instead of starting a new one"


async def test_a_worker_that_cannot_reach_temporal_refuses_to_start(bare_env, monkeypatch):
    """The catch must re-raise, not log and continue.

    A swallowed failure here is worse than a crash: the worker comes up, polls
    happily, and every approved card enqueues to a dispatcher that does not
    exist. That is §6.3's deadlock — a task waiting forever on a slot nothing
    can grant — reached silently instead of loudly.
    """
    settings = Settings.from_env()

    async def unreachable(*_args, **_kwargs):
        raise RPCError("frontend is down", RPCStatusCode.UNAVAILABLE, b"")

    monkeypatch.setattr(bare_env.client, "start_workflow", unreachable)

    with pytest.raises(RPCError):
        await ensure_singletons(settings, bare_env.client)


async def test_an_error_that_is_not_an_rpc_error_is_not_swallowed_either(bare_env, monkeypatch):
    """§6.4 was `except RPCError` being too narrow. This pins the shape.

    `WorkflowAlreadyStartedError` is not an `RPCError`, which is exactly why
    the original catch missed it and the worker crash-looped on every boot
    after the first. The catch is still narrow — that is now correct, because
    `USE_EXISTING` removes the duplicate-start case at the source rather than
    by catching it — so what matters is that anything else propagates rather
    than being mistaken for success.
    """
    settings = Settings.from_env()

    async def surprising(*_args, **_kwargs):
        raise TypeError("data converter cannot encode this argument")

    monkeypatch.setattr(bare_env.client, "start_workflow", surprising)

    with pytest.raises(TypeError):
        await ensure_singletons(settings, bare_env.client)


async def test_both_singletons_are_started_not_just_the_first(bare_env):
    """§6.5's counterweight to the two tests above.

    `ensure_singletons` builds both coroutines eagerly in the loop's tuple, so
    a failure on the first leaves the second never awaited. That is fine while
    the handler re-raises — but it means "the first one worked" and "both
    worked" are different claims, and only the second is the one the worker
    depends on.
    """
    settings = Settings.from_env()
    await ensure_singletons(settings, bare_env.client)

    for workflow_id in (settings.dispatcher_workflow_id, "board-reconciler"):
        desc = await bare_env.client.get_workflow_handle(workflow_id).describe()
        assert desc.status.name == "RUNNING", workflow_id
