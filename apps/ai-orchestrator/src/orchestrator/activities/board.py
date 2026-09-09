"""Board-facing activities: read card state, publish status, reconcile.

Everything that talks to kan lives here. Workflows call these; they never import
`httpx` themselves, because a workflow must be replayable and a network call is
not.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from temporalio import activity
from temporalio.exceptions import ApplicationError

from ..board.events import HandoffInvalid, parse_handoff
from ..board.kan import KanNotFound
from ..contracts import CardSnapshot, Stage
from ..projects import CheckNotAllowed, ProjectUnknown, RepositoryNotAllowed
from . import context

log = logging.getLogger("orchestrator.activities.board")


@activity.defn
async def fetch_card(card_id: str) -> CardSnapshot:
    """Read a card fresh and parse its handoff.

    This is the read that makes a stale approval detectable: the workflow calls
    it again immediately before dispatch and compares the hash against the one
    approval was recorded on, so an edit landing in the queue wait is caught.
    """
    ctx = context.current()
    try:
        card = await ctx.kan.get_card(card_id)
    except KanNotFound as exc:
        # A deleted card is terminal, not a transient fault.
        raise ApplicationError(str(exc), type="CardNotFound", non_retryable=True) from exc

    snapshot = CardSnapshot(
        card_id=card.public_id,
        board_id=card.board_id,
        board_name=card.board_name,
        stage=Stage.from_list_name(card.list_name),
        title=card.title,
    )

    try:
        handoff = parse_handoff(card.description)
        project = ctx.projects.assert_repository(card.board_name, handoff.repository)
        project.resolve_checks(handoff.acceptance_checks)
    except (HandoffInvalid, ProjectUnknown, RepositoryNotAllowed, CheckNotAllowed) as exc:
        # Returned as data: the workflow turns this into a Blocked card with a
        # comment, which is a better outcome than an activity retrying forever
        # against text only a human can fix.
        return CardSnapshot(**{**snapshot.__dict__, "handoff_error": str(exc)})

    return CardSnapshot(
        **{**snapshot.__dict__, "handoff": handoff, "handoff_hash": handoff.content_hash()}
    )


@dataclass(frozen=True)
class MoveRequest:
    card_id: str
    board_id: str
    stage: Stage


@activity.defn
async def move_card(request: MoveRequest) -> bool:
    """Move a card to the list whose name matches `stage`.

    Resolves the list by *name* per board, because each project has its own
    board and therefore its own list publicIds. Returns False when the board has
    no such column, which is a configuration problem on that board rather than a
    failure of this task.
    """
    ctx = context.current()
    lists = await ctx.kan.get_lists(request.board_id)
    target = next((l for l in lists if Stage.from_list_name(l.name) is request.stage), None)
    if target is None:
        log.warning("board %s has no %s column", request.board_id, request.stage.value)
        return False

    await ctx.kan.move_card(request.card_id, target.public_id, index=0)
    return True


@dataclass(frozen=True)
class CommentRequest:
    card_id: str
    # Stable per logical message, so a redelivery or a workflow replay that
    # reaches the same point does not stack duplicate comments on the card.
    marker: str
    text: str


@activity.defn
async def publish_comment(request: CommentRequest) -> bool:
    """Post a comment unless one bearing the same marker already exists."""
    ctx = context.current()
    return await ctx.kan.comment_once(request.card_id, f"[orchestrator:{request.marker}]",
                                      request.text)


@activity.defn
async def list_cards_awaiting_dispatch(board_id: str) -> list[str]:
    """Card IDs currently sitting in 'Ready for local' on one board.

    The recovery path for kan's fire-and-forget webhooks: `sendWebhooksForWorkspace`
    logs a delivery failure and moves on, so a card can be approved without the
    orchestrator ever hearing about it. Polling this list closes that hole.
    """
    ctx = context.current()
    lists = await ctx.kan.get_lists(board_id)
    ready = next((l for l in lists if Stage.from_list_name(l.name) is Stage.READY), None)
    if ready is None:
        return []
    cards = await ctx.kan.get_cards_in_list(board_id, ready.public_id)
    return [c.public_id for c in cards]


@activity.defn
async def configured_board_names() -> list[str]:
    """Boards the reconciler should sweep, from trusted project config."""
    return context.current().projects.board_names
