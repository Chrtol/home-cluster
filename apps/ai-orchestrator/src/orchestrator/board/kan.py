"""Typed kan REST client.

Routes verified against kan v0.6.0 (the deployed tag). Two kan quirks shape this
client:

* **Rate limiting surfaces as 401, not 429.** A burst of requests gets
  `UNAUTHORIZED` back, which is indistinguishable from a bad token by status
  alone. Treating a 401 as fatal would make the reconciliation loop disable
  itself under load, so 401 is retried; a token that is genuinely wrong simply
  exhausts the retries and fails loudly.
* **Everything is addressed by a 12-character `publicId`.** The API rejects
  slugs and numeric ids outright.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Any

import httpx

log = logging.getLogger("orchestrator.board.kan")


class KanError(Exception):
    """A kan call failed after exhausting retries."""


class KanNotFound(KanError):
    """The addressed object does not exist. Never retried."""


@dataclass(frozen=True)
class KanList:
    public_id: str
    name: str
    index: int


@dataclass(frozen=True)
class KanCard:
    public_id: str
    title: str
    description: str | None
    list_id: str
    list_name: str
    board_id: str
    board_name: str = ""


class KanClient:
    """Async kan client. One instance per worker process, reused across calls."""

    def __init__(
        self,
        base_url: str,
        api_key: str,
        *,
        timeout: float = 15.0,
        max_attempts: int = 5,
    ) -> None:
        self._base = base_url.rstrip("/")
        self._max_attempts = max_attempts
        self._client = httpx.AsyncClient(
            base_url=self._base,
            timeout=timeout,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        )
        # kan serializes writes per card; concurrent writes are what triggers
        # the 401 rate limit, so calls are funnelled through one gate.
        self._gate = asyncio.Semaphore(1)

    async def aclose(self) -> None:
        await self._client.aclose()

    async def _request(self, method: str, path: str, body: Any | None = None) -> Any:
        last: Exception | None = None
        for attempt in range(1, self._max_attempts + 1):
            async with self._gate:
                try:
                    response = await self._client.request(method, path, json=body)
                except httpx.HTTPError as exc:
                    last = KanError(f"{method} {path}: {exc}")
                else:
                    if response.status_code == 404:
                        raise KanNotFound(f"{method} {path}: not found")
                    if response.status_code < 300:
                        return response.json() if response.content else None
                    # 401 is kan's rate-limit signal as well as its auth
                    # failure, so it is retried rather than treated as fatal.
                    if response.status_code in (401, 429, 500, 502, 503, 504):
                        last = KanError(f"{method} {path}: HTTP {response.status_code}")
                    else:
                        raise KanError(
                            f"{method} {path}: HTTP {response.status_code} {response.text[:200]}"
                        )

            if attempt < self._max_attempts:
                await asyncio.sleep(min(0.5 * 2 ** (attempt - 1), 8.0))
                log.warning("kan retry %d/%d %s %s", attempt, self._max_attempts, method, path)

        raise last or KanError(f"{method} {path}: exhausted retries")

    async def whoami(self) -> str:
        """The user id kan attributes this API key to.

        Used as the origin marker from plan §8: an event whose actor is this id
        was caused by the orchestrator itself and must not feed back into the
        state machine, or a move-to-Running would re-trigger its own dispatch.
        """
        me = await self._request("GET", "/users/me")
        user_id = (me or {}).get("id")
        if not user_id:
            raise KanError("/users/me returned no id")
        return str(user_id)

    async def resolve_board_id(self, board_name: str) -> str:
        """Find a board's publicId from its name, across every visible workspace.

        Only the reconciler needs this — the webhook payload already carries the
        board name, so the event path resolves a project without an API call.

        Fails closed on both edges: kan does not enforce unique board names, so
        an ambiguous name refuses rather than guessing, and a name with no match
        refuses rather than silently sweeping nothing.
        """
        wanted = board_name.strip().casefold()
        matches: list[str] = []
        for row in await self._request("GET", "/workspaces") or []:
            workspace = row.get("workspace") or row
            ws_id = workspace.get("publicId")
            if not ws_id:
                continue
            for board in await self._request("GET", f"/workspaces/{ws_id}/boards") or []:
                if (board.get("name") or "").strip().casefold() == wanted:
                    matches.append(board["publicId"])

        if not matches:
            raise KanNotFound(f"no board named {board_name!r}")
        if len(matches) > 1:
            raise KanError(
                f"board name {board_name!r} is ambiguous ({len(matches)} matches); "
                "rename one, or this binding cannot be trusted"
            )
        return matches[0]

    async def get_card(self, card_id: str) -> KanCard:
        raw = await self._request("GET", f"/cards/{card_id}")
        return _card_from(raw)

    async def get_lists(self, board_id: str) -> list[KanList]:
        raw = await self._request("GET", f"/boards/{board_id}")
        return [
            KanList(public_id=item["publicId"], name=item["name"], index=item.get("index", 0))
            for item in (raw or {}).get("lists", [])
        ]

    async def get_cards_in_list(self, board_id: str, list_id: str) -> list[KanCard]:
        """Cards currently in one list.

        `GET /boards/{id}` is the only route that returns cards, so a full board
        fetch is filtered client-side. This is the reconciliation read path.
        """
        raw = await self._request("GET", f"/boards/{board_id}")
        out: list[KanCard] = []
        for lst in (raw or {}).get("lists", []):
            if lst.get("publicId") != list_id:
                continue
            for card in lst.get("cards", []):
                out.append(
                    KanCard(
                        public_id=card["publicId"],
                        title=card.get("title", ""),
                        description=card.get("description"),
                        list_id=list_id,
                        list_name=lst.get("name", ""),
                        board_id=board_id,
                    )
                )
        return out

    async def move_card(self, card_id: str, list_id: str, index: int = 0) -> None:
        """Move a card.

        `listPublicId` and `index` must be sent together — kan returns 500 for
        an index-only update.
        """
        await self._request("PUT", f"/cards/{card_id}", {"listPublicId": list_id, "index": index})

    async def last_move_actor(self, card_id: str, to_list_id: str) -> tuple[str, str] | None:
        """Who most recently moved this card into `to_list_id`, per kan's own feed.

        The reconciler needs a verified actor for a card whose webhook never
        arrived, and plan §8 forbids inventing one. kan records every move as a
        `card.updated.list` activity with the acting user attached, so the feed
        is an authoritative second source for the same fact.

        Returns `(email, name)`. Unlike the webhook payload the feed carries no
        user *id*, which is why the caller marks the identity's provenance.
        """
        raw = await self._request("GET", f"/cards/{card_id}")
        newest: tuple[str, str] | None = None
        newest_at = ""
        for activity in (raw or {}).get("activities", []) or []:
            if activity.get("type") != "card.updated.list":
                continue
            if (activity.get("toList") or {}).get("publicId") != to_list_id:
                continue
            created = activity.get("createdAt") or ""
            if created < newest_at:
                continue
            user = activity.get("user") or {}
            email = user.get("email")
            if not email:
                continue
            newest_at, newest = created, (str(email), str(user.get("name") or ""))
        return newest

    async def comment_once(self, card_id: str, marker: str, text: str) -> bool:
        """Post a comment unless one carrying `marker` is already there.

        kan accepts no idempotency key, so the check is a read of the card's
        activity feed. Comment *text* is only reachable there — the board
        listing returns each comment as a bare `{publicId}` — so this is the
        only route that can answer "did I already say this?".

        Returns True if it posted. The read/write pair is not atomic; a retry
        that crashes between them can still duplicate, which is why the caller
        also tracks published markers in workflow state.
        """
        raw = await self._request("GET", f"/cards/{card_id}")
        for activity in (raw or {}).get("activities", []) or []:
            body = (activity.get("comment") or {}).get("comment") or ""
            if marker in body:
                return False

        await self._request("POST", f"/cards/{card_id}/comments", {"comment": f"{marker}\n{text}"})
        return True


def _card_from(raw: dict[str, Any]) -> KanCard:
    """Build a card from `GET /cards/{id}`.

    The board is reached through `list.board`, not a top-level key: kan nests
    the board inside the list on this route.
    """
    lst = raw.get("list") or {}
    board = lst.get("board") or {}
    return KanCard(
        public_id=raw["publicId"],
        title=raw.get("title", ""),
        description=raw.get("description"),
        list_id=lst.get("publicId") or "",
        list_name=lst.get("name", ""),
        board_id=board.get("publicId") or "",
        board_name=board.get("name") or "",
    )
