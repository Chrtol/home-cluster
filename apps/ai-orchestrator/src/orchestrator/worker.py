"""Temporal worker entrypoint."""

from __future__ import annotations

import asyncio
import logging

from temporalio.client import Client
from temporalio.worker import Worker

from .activities import record_step
from .settings import Settings
from .workflows import SmokeWorkflow

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("orchestrator.worker")


async def main() -> None:
    settings = Settings.from_env()
    log.info(
        "connecting address=%s namespace=%s task_queue=%s",
        settings.address,
        settings.namespace,
        settings.task_queue,
    )

    client = await Client.connect(settings.address, namespace=settings.namespace)
    worker = Worker(
        client,
        task_queue=settings.task_queue,
        workflows=[SmokeWorkflow],
        activities=[record_step],
    )
    log.info("worker running")
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
