"""Verify and normalize a kan webhook delivery.

Contract verified against kan v0.6.0 `packages/api/src/utils/webhook.ts`, which
is the deployed tag. Two properties of that source drive everything here:

* Delivery is fire-and-forget. `sendWebhooksForWorkspace` wraps the fan-out in
  `Promise.allSettled` and only *logs* a failure, so kan never retries. A
  dropped event is dropped permanently, which is why reconciliation exists.
* The payload has no event ID. `WebhookPayload` is `{event, timestamp, data}`
  and nothing more, so a dedup key has to be synthesized from the fields that
  a redelivery would reproduce byte-for-byte.
"""

from __future__ import annotations

import hashlib
import hmac
import html
import json
import re
from typing import Any

import yaml

from ..contracts import BoardActor, BoardEvent, EventKind, Handoff, Stage

SIGNATURE_HEADER = "x-webhook-signature"
EVENT_HEADER = "x-webhook-event"
TIMESTAMP_HEADER = "x-webhook-timestamp"


class WebhookRejected(Exception):
    """The delivery is not something we will act on. Never retryable."""


def verify_signature(body: bytes, provided: str | None, secret: str) -> None:
    """Constant-time check of kan's `X-Webhook-Signature`.

    kan computes `HMAC-SHA256(secret, rawBody)` hex-encoded over the exact bytes
    it sent, so the check must run on the raw request body — re-serializing the
    parsed JSON would reorder keys and never match.
    """
    if not secret:
        raise WebhookRejected("no webhook secret configured")
    if not provided:
        raise WebhookRejected("missing signature header")

    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, provided.strip()):
        raise WebhookRejected("signature mismatch")


def normalize(payload: dict[str, Any]) -> BoardEvent:
    """Turn a raw kan payload into a `BoardEvent`, or reject it."""
    kind_raw = payload.get("event")
    try:
        kind = EventKind(kind_raw)
    except ValueError as exc:
        raise WebhookRejected(f"unsupported event {kind_raw!r}") from exc

    data = payload.get("data") or {}
    card = data.get("card") or {}
    card_id = card.get("publicId")
    if not card_id:
        raise WebhookRejected("payload has no card publicId")

    # `data.board.id` is the board's publicId; `data.card.id` is kan's internal
    # numeric row id, so the card is addressed by publicId everywhere instead.
    board = data.get("board") or {}
    board_id = board.get("id") or card.get("boardId") or ""
    # kan sets `data.board.name` on every card event (see card.ts passing
    # `boardName`), so trusted config can be keyed on the name with no lookup.
    board_name = board.get("name") or ""
    timestamp = payload.get("timestamp") or ""

    changes = data.get("changes") or {}
    moved_from = None
    if isinstance(changes.get("listId"), dict):
        moved_from = changes["listId"].get("from")

    user = data.get("user") or None
    actor = BoardActor(id=user["id"], name=user.get("name")) if user and user.get("id") else None

    return BoardEvent(
        event_key=BoardEvent.make_key(kind.value, timestamp, board_id, card_id),
        kind=kind,
        timestamp=timestamp,
        board_id=board_id,
        board_name=board_name,
        card_id=card_id,
        title=card.get("title") or "",
        # On a move this is already the destination list, per kan's
        # `currentWebhookListPublicId`.
        list_id=card.get("listId") or "",
        stage=Stage.from_list_name((data.get("list") or {}).get("name")),
        actor=actor,
        description=card.get("description"),
        changed_fields=sorted(str(k) for k in changes),
        moved_from_list_id=moved_from,
    )


_TAG = re.compile(r"<[^>]+>")
_FENCE = re.compile(r"```(?:ya?ml)?\s*(.*?)```", re.DOTALL | re.IGNORECASE)


def _to_text(description: str | None) -> str:
    """Flatten kan's rich-text HTML into something YAML can parse.

    kan stores descriptions as HTML from its editor. Block tags become newlines
    first so a handoff written as separate paragraphs does not collapse into one
    line, then remaining tags are dropped and entities unescaped — `>` in a YAML
    block scalar arrives as `&gt;`.
    """
    if not description:
        return ""
    text = re.sub(r"(?i)<br\s*/?>", "\n", description)
    text = re.sub(r"(?i)</(p|div|li|h[1-6]|pre)>", "\n", text)
    text = _TAG.sub("", text)
    return html.unescape(text)


class HandoffInvalid(Exception):
    """The card does not carry a usable handoff. Not retryable."""


_REQUIRED = ("task_id", "spec_revision", "design_revision", "repository", "base_commit", "goal")
_STR_LISTS = (
    "scope",
    "out_of_scope",
    "allowed_paths",
    "interfaces",
    "dependencies",
    "acceptance_checks",
    "open_questions",
)


def parse_handoff(description: str | None) -> Handoff:
    """Extract the plan §4 handoff from a card description.

    Prefers a fenced block so the rest of the description can hold prose for
    human readers; falls back to parsing the whole description as YAML.
    `yaml.safe_load` is mandatory — this is attacker-adjacent text.
    """
    text = _to_text(description).strip()
    if not text:
        raise HandoffInvalid("card description is empty")

    fence = _FENCE.search(text)
    candidate = fence.group(1) if fence else text

    try:
        loaded = yaml.safe_load(candidate)
    except yaml.YAMLError as exc:
        raise HandoffInvalid(f"description is not valid YAML: {exc}") from exc

    if not isinstance(loaded, dict):
        raise HandoffInvalid("handoff must be a YAML mapping")

    missing = [k for k in _REQUIRED if not loaded.get(k)]
    if missing:
        raise HandoffInvalid(f"handoff missing required fields: {', '.join(missing)}")

    fields: dict[str, Any] = {k: str(loaded[k]).strip() for k in _REQUIRED}
    for key in _STR_LISTS:
        raw = loaded.get(key) or []
        if isinstance(raw, str):
            raw = [raw]
        if not isinstance(raw, list):
            raise HandoffInvalid(f"handoff field {key!r} must be a list")
        fields[key] = [str(v).strip() for v in raw if str(v).strip()]

    # `approval:` may appear in the card text. It is ignored: plan §8 takes the
    # actor from the verified board identity on the move event, never from a
    # field anything on the card could have written.
    return Handoff(**fields)


def dumps_handoff(handoff: Handoff) -> str:
    """Render a handoff back to YAML, for tests and for seeding a card."""
    body = {k: v for k, v in handoff.__dict__.items()}
    return yaml.safe_dump(body, sort_keys=True, default_flow_style=False)


def loads_payload(body: bytes) -> dict[str, Any]:
    try:
        payload = json.loads(body)
    except json.JSONDecodeError as exc:
        raise WebhookRejected(f"body is not JSON: {exc}") from exc
    if not isinstance(payload, dict):
        raise WebhookRejected("body is not a JSON object")
    return payload
