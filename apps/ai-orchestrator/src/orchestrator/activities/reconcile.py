"""Periodic board sweep — the recovery path for kan's undelivered webhooks.

kan v0.6.0 sends webhooks with `Promise.allSettled` and only logs failures. It
has no retry, no delivery queue and no redelivery endpoint, so a webhook lost to
a rolling restart of this orchestrator is lost for good. Plan §8 therefore makes
reconciliation mandatory rather than a nicety.

The sweep re-derives the same events from board state. Two things keep it from
double-dispatching work the webhook already delivered:

* The synthesized `event_key` is a pure function of (card, board, handoff hash)
  and carries no timestamp, so every sweep of an unchanged card produces the
  identical key and the TaskWorkflow's dedup drops it.
* Identity is read from kan's activity feed, not invented, so a reconciled
  approval is as verifiable as a webhook-delivered one.
"""

from __future__ import annotations

import hashlib
import logging

from temporalio import activity

from ..board.events import parse_handoff
from ..contracts import BoardActor, BoardEvent, EventKind, Stage
from . import context

log = logging.getLogger("orchestrator.activities.reconcile")


@activity.defn
async def reconcile_board(board_name: str) -> int:
    """Re-raise approvals for cards sitting in 'Ready for local'.

    Returns the number of cards signalled — including ones the target workflow
    then deduplicates, because from here they are indistinguishable.
    """
    ctx = context.current()
    from ..settings import task_workflow_id
    from ..workflows.task import TaskState, TaskWorkflow

    # The one place a name has to become an id: a sweep is not triggered by an
    # event, so there is no payload to read the board id from.
    board_id = await ctx.kan.resolve_board_id(board_name)
    lists = await ctx.kan.get_lists(board_id)
    ready = next((l for l in lists if Stage.from_list_name(l.name) is Stage.READY), None)
    if ready is None:
        return 0

    cards = await ctx.kan.get_cards_in_list(board_id, ready.public_id)
    signalled = 0

    for card in cards:
        try:
            handoff = parse_handoff(card.description)
        except Exception as exc:  # noqa: BLE001 - a bad card must not stop the sweep
            log.info("reconcile: skipping %s, %s", card.public_id, exc)
            continue

        actor_row = await ctx.kan.last_move_actor(card.public_id, ready.public_id)
        if actor_row is None:
            log.info("reconcile: %s has no recorded move into Ready", card.public_id)
            continue
        email, name = actor_row

        handoff_hash = handoff.content_hash()
        # Timestamp-free on purpose: a repeated sweep of an unchanged card must
        # reproduce the same key so the workflow drops it as a duplicate.
        key = hashlib.sha256(
            f"reconcile|{board_id}|{card.public_id}|{handoff_hash}".encode()
        ).hexdigest()[:16]

        event = BoardEvent(
            event_key=key,
            kind=EventKind.MOVED,
            timestamp="",
            board_id=board_id,
            board_name=board_name,
            card_id=card.public_id,
            title=card.title,
            list_id=ready.public_id,
            stage=Stage.READY,
            actor=BoardActor(id=email, name=name, source="activity"),
            description=card.description,
            changed_fields=["listId"],
        )

        await ctx.temporal.start_workflow(
            TaskWorkflow.run,
            TaskState(card_id=card.public_id, board_id=board_id, board_name=board_name),
            id=task_workflow_id(card.public_id),
            task_queue=ctx.settings.task_queue,
            memo={
                "dispatcher_id": ctx.settings.dispatcher_workflow_id,
                "job_image": ctx.settings.job_image,
            },
            start_signal="board_event",
            start_signal_args=[event],
        )
        signalled += 1

    return signalled
