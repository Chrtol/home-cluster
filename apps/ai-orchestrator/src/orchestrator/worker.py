"""Temporal worker entrypoint."""

from __future__ import annotations

import asyncio
import logging

from temporalio.client import Client
from temporalio.common import WorkflowIDConflictPolicy
from temporalio.contrib.pydantic import pydantic_data_converter
from temporalio.service import RPCError
from temporalio.worker import Worker

from . import projects
from .activities import board as board_acts
from .activities import context as activity_context
from .activities import kubernetes as k8s_acts
from .activities import reconcile as reconcile_acts
from .activities.smoke import record_step
from .board.kan import KanClient
from .settings import Settings
from .workflows.dispatcher import DesktopDispatcherWorkflow, DispatcherState
from .workflows.reconcile import ReconcileWorkflow
from .workflows.smoke import SmokeWorkflow
from .workflows.task import TaskWorkflow

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("orchestrator.worker")

ACTIVITIES = [
    record_step,
    board_acts.fetch_card,
    board_acts.move_card,
    board_acts.publish_comment,
    board_acts.list_cards_awaiting_dispatch,
    board_acts.configured_board_names,
    k8s_acts.ensure_workspace,
    k8s_acts.ensure_job,
    k8s_acts.observe_job,
    k8s_acts.stop_job,
    k8s_acts.delete_job,
    k8s_acts.confirm_terminated,
    reconcile_acts.reconcile_board,
]

WORKFLOWS = [SmokeWorkflow, TaskWorkflow, DesktopDispatcherWorkflow, ReconcileWorkflow]


async def build_context(settings: Settings, client: Client) -> activity_context.Context:
    await k8s_acts.JobRunner.load_config()
    return activity_context.Context(
        kan=KanClient(settings.kan_base_url, settings.kan_api_key),
        projects=projects.load(settings.projects_path),
        settings=settings,
        jobs=k8s_acts.JobRunner(
            namespace=settings.jobs_namespace,
            storage_class=settings.workspace_storage_class,
            workspace_size=settings.workspace_size,
        ),
        temporal=client,
    )


async def ensure_singletons(settings: Settings, client: Client) -> None:
    """Start the dispatcher and the reconciler if they are not already running.

    Both are singletons keyed by workflow ID. `USE_EXISTING` makes a start
    against a running one return that run instead of raising, which is what
    makes this safe to call on every worker boot and on every replica.

    Catching the error instead would be a trap: Temporal raises
    `WorkflowAlreadyStartedError`, which is NOT an `RPCError`, so an
    `except RPCError` here silently made the worker unable to restart at all --
    it started cleanly the first time and then crash-looped on every boot
    afterwards, once the singletons existed.
    """
    for coro, name in (
        (
            client.start_workflow(
                DesktopDispatcherWorkflow.run,
                DispatcherState(desktop_id=settings.desktop_id),
                id=settings.dispatcher_workflow_id,
                task_queue=settings.task_queue,
                id_conflict_policy=WorkflowIDConflictPolicy.USE_EXISTING,
            ),
            settings.dispatcher_workflow_id,
        ),
        (
            client.start_workflow(
                ReconcileWorkflow.run,
                settings.reconcile_interval_seconds,
                id="board-reconciler",
                task_queue=settings.task_queue,
                id_conflict_policy=WorkflowIDConflictPolicy.USE_EXISTING,
            ),
            "board-reconciler",
        ),
    ):
        try:
            await coro
            log.info("singleton %s running", name)
        except RPCError as exc:
            # A genuinely unreachable server, not a duplicate start.
            log.error("could not ensure singleton %s: %s", name, exc.status.name)
            raise


async def main() -> None:
    settings = Settings.from_env()
    log.info(
        "connecting address=%s namespace=%s task_queue=%s",
        settings.address,
        settings.namespace,
        settings.task_queue,
    )

    client = await Client.connect(
        settings.address,
        namespace=settings.namespace,
        data_converter=pydantic_data_converter,
    )
    context = await build_context(settings, client)
    activity_context.install(context)

    if settings.job_fail_at_step:
        # Loud, because an armed knob left in the HelmRelease would make every
        # future attempt fail for a reason nothing on the board explains.
        log.warning(
            "JOB_FAIL_AT_STEP=%d is armed for task %s -- attempts will fail deliberately",
            settings.job_fail_at_step,
            settings.job_fail_task_id or "<every card>",
        )

    if settings.kan_self_actor_id:
        log.info("kan origin marker configured: %s", settings.kan_self_actor_id)
    else:
        log.info("no kan origin marker; relying on the structural loop guard")

    await ensure_singletons(settings, client)

    worker = Worker(
        client, task_queue=settings.task_queue, workflows=WORKFLOWS, activities=ACTIVITIES
    )
    log.info("worker running")
    try:
        await worker.run()
    finally:
        await context.kan.aclose()


if __name__ == "__main__":
    asyncio.run(main())
