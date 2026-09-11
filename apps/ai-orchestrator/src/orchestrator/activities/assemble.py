"""The Activity that gathers a context package.

Deliberately not in `activities/context.py`: that module is the process-wide
handle registry, imported by every other activity module, and it already owns
the name `Context`. A second, unrelated meaning of "context" in the same file
would make `context.current()` and `context.assemble_context` neighbours.

This is the only place that talks to Memini. The coding Job gets no memory
credential -- it gets the bytes this returns.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from importlib import resources

from temporalio import activity

from ..context import assemble
from ..context.manifest import LessonsStatus
from ..contracts import Approval, AttemptRef, Handoff
from ..memory.memini import MeminiUnavailable, select
from ..projects import ProjectUnknown
from . import context

log = logging.getLogger("orchestrator.activities.assemble")

# How many lessons to ask for. A bounded selection, per the plan -- the point is
# the applicable few, not the corpus.
LESSON_LIMIT = 8


@dataclass(frozen=True)
class AssembleRequest:
    approval: Approval
    handoff: Handoff
    attempt: AttemptRef
    board_name: str
    job_image: str
    # Empty on a first attempt. The prior attempt's Job name, which is also the
    # directory it checkpointed into on the shared workspace volume.
    previous_attempt: str = ""


def policy_text() -> str:
    """The trusted operating policy, as shipped in this image."""
    return (resources.files("orchestrator.context") / "policy.md").read_text(encoding="utf-8")


def _query(handoff: Handoff) -> str:
    """What to ask the memory store.

    The goal plus the scope: a lesson is applicable to *this* task or it is
    noise, and the handoff's own words are the only description of the task that
    exists before any code is read.
    """
    return " ".join([handoff.goal, *handoff.scope[:5]]).strip()


async def _lessons(request: AssembleRequest) -> tuple[list, LessonsStatus]:
    """Retrieve and judge. Never raises: lessons are optional by design.

    Every failure path returns `degraded: <reason>` rather than an exception or
    an empty-and-silent result. The plan is explicit that unavailable optional
    lessons are recorded, never invented and never blocking -- and "no lessons
    applied" has to stay distinguishable from "retrieval was broken".
    """
    ctx = context.current()

    try:
        project = ctx.projects.for_board(request.board_name)
    except ProjectUnknown as exc:
        return [], LessonsStatus(status=f"degraded: {exc}")

    namespace = project.memory_namespace
    if not namespace:
        # Falling back to the API key's default namespace would quietly query
        # whatever that happens to be, which is precisely the cross-project
        # leak the isolation gate exists to prevent. Better to retrieve nothing
        # and say so.
        return [], LessonsStatus(
            status=(
                f"degraded: board {project.board!r} has no memory_namespace "
                f"configured, so no lessons were retrieved"
            )
        )

    if ctx.memini is None or not ctx.memini.configured:
        return [], LessonsStatus(
            status="degraded: no Memini credential configured", namespace=namespace
        )

    try:
        results = await ctx.memini.search(
            query=_query(request.handoff), namespace=namespace, limit=LESSON_LIMIT
        )
    except MeminiUnavailable as exc:
        log.warning("lesson retrieval degraded for %s: %s", request.attempt.job_name, exc)
        return [], LessonsStatus(status=f"degraded: {exc}", namespace=namespace)

    lessons = select(
        results,
        approved_revisions=assemble.approved_revisions(request.handoff),
        namespace=namespace,
        limit=LESSON_LIMIT,
    )
    return lessons, LessonsStatus(
        status="ok", considered=len(results), selected=len(lessons), namespace=namespace
    )


@activity.defn
async def assemble_context(request: AssembleRequest) -> assemble.ContextPackage:
    """Build the read-only package for one attempt.

    The handoff comes in from the workflow, which read it under the same
    approval it is dispatching -- it is not re-fetched here. Re-reading the card
    would open a window in which the document an attempt receives is newer than
    the one a human approved, which is the exact gap the staleness check closes
    a few lines earlier in the workflow.
    """
    lessons, status = await _lessons(request)

    package = assemble.build(
        approval=request.approval,
        handoff=request.handoff,
        attempt=request.attempt,
        job_image=request.job_image,
        policy_text=policy_text(),
        lessons=lessons,
        lessons_status=status,
        previous_attempt=request.previous_attempt,
        built_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
    )
    log.info(
        "assembled context for %s: %d bytes, %d lessons, lessons=%s, resume=%s",
        request.attempt.job_name,
        package.total_bytes,
        package.lessons_selected,
        package.lessons_status,
        package.resumed_from or "<fresh>",
    )
    return package
