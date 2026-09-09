"""Runtime configuration, read from the environment."""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    address: str
    namespace: str
    task_queue: str

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            address=os.environ.get(
                "TEMPORAL_ADDRESS", "temporal-frontend.ai.svc.cluster.local:7233"
            ),
            namespace=os.environ.get("TEMPORAL_NAMESPACE", "ai-coding"),
            task_queue=os.environ.get("TEMPORAL_TASK_QUEUE", "ai-coding"),
        )
