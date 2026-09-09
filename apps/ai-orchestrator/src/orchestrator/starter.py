"""Manual smoke run: start a SmokeWorkflow and wait for its result."""

from __future__ import annotations

import asyncio
import sys

from temporalio.client import Client
from temporalio.contrib.pydantic import pydantic_data_converter

from .settings import Settings
from .workflows import SmokeWorkflow


async def main() -> None:
    wf_id = sys.argv[1] if len(sys.argv) > 1 else "smoke"
    seconds = int(sys.argv[2]) if len(sys.argv) > 2 else 60

    settings = Settings.from_env()
    client = await Client.connect(
        settings.address,
        namespace=settings.namespace,
        data_converter=pydantic_data_converter,
    )
    handle = await client.start_workflow(
        SmokeWorkflow.run, seconds, id=wf_id, task_queue=settings.task_queue
    )
    print(f"started id={wf_id} run={handle.result_run_id} sleep={seconds}s", flush=True)
    print(f"result: {await handle.result()}", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
