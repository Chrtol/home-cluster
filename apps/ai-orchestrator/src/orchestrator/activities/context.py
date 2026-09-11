"""Process-wide handles the activities run against.

Activities are module-level functions so Temporal can address them by name, but
they need a kan client and a Kubernetes client that outlive a single call. The
worker builds one `Context` at startup and installs it here; tests install a
fake instead. Nothing in a workflow may touch this — it is I/O state.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:  # pragma: no cover - import cycle only matters to type checkers
    from temporalio.client import Client

    from ..board.kan import KanClient
    from ..memory.memini import MeminiClient
    from ..projects import Registry
    from ..settings import Settings
    from .kubernetes import JobRunner


@dataclass
class Context:
    kan: "KanClient"
    projects: "Registry"
    settings: "Settings"
    jobs: "JobRunner"
    # The reconciler starts and signals task workflows, which is a client
    # operation, not a workflow one — hence a client inside an Activity.
    temporal: "Client | None" = None
    # Read-only memory access, held by the orchestrator alone. None means
    # lesson retrieval reports itself degraded rather than failing an attempt.
    memini: "MeminiClient | None" = None


_context: Context | None = None


def install(context: Context) -> None:
    global _context
    _context = context


def current() -> Context:
    if _context is None:
        raise RuntimeError("activity context not installed; call context.install() at startup")
    return _context
