"""Memini retrieval, and the rules that decide what an attempt may be told.

Two halves on purpose. `select` is pure and holds every judgement -- reviewed,
superseded, source-still-current -- so the rules can be tested against literal
API payloads with no server. `MeminiClient` only speaks HTTP.

What the API actually looks like, verified against v0.7.24 in the cluster:

* `POST /v1/search` takes `{query, limit, namespaces, tiers, tags, levels}` and
  returns `{"results": [{"memory": {...}, "score": N}]}`.
* It **rejects unknown top-level fields with a 400** rather than ignoring them,
  which is why a field name typo here fails loudly instead of quietly widening
  a query. `namespaces` is a list; there is no singular `namespace`.
* A memory carries `id`, `content`, `namespace`, `tags`, `tier`, `level`,
  `metadata`, `content_hash`, `created_at`, `updated_at`.

Nothing in Memini marks a memory superseded on its own, so that is a metadata
convention this module defines and the constants below name.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

import httpx

log = logging.getLogger("orchestrator.memory.memini")

# A lesson has to be durable knowledge, not a working note. A naive Memini write
# lands in `working` and expires in three days; those are exactly the
# unreviewed hypotheses the plan says must not become instructions.
DURABLE_TIERS = frozenset({"semantic", "procedural"})

# Review marker. WS2 built the stack without defining one, so this is chosen
# here: a plain tag, because it is the only field a human can set from every
# client that writes to this store.
REVIEWED_TAG = "reviewed"

# Metadata conventions this module defines.
#   superseded_by   -- non-empty means a newer memory replaced this one.
#   source_revision -- `path@sha` the lesson was learned from.
META_SUPERSEDED = "superseded_by"
META_SOURCE_REVISION = "source_revision"


@dataclass(frozen=True)
class Lesson:
    """One reviewed lesson, already judged fit to hand to an attempt."""

    memory_id: str
    content: str
    namespace: str
    tier: str
    score: float
    source_revision: str = ""
    tags: list[str] = field(default_factory=list)
    recheck: bool = False
    recheck_reason: str = ""

    @property
    def reason(self) -> str:
        """The one-line selection reason the manifest records."""
        base = f"reviewed {self.tier} lesson, relevance {self.score:.2f}"
        if self.recheck:
            return f"{base}; {self.recheck_reason}"
        return base


def _revision_parts(revision: str) -> tuple[str, str]:
    """Split `path@sha`. Returns empty strings for anything else.

    Deliberately tolerant: a lesson with no source revision, or one in some
    older format, is not an error -- it just cannot be checked for staleness,
    and an unbounded refusal to include those would make the whole feature
    depend on a convention nothing enforces yet.
    """
    path, _, sha = revision.rpartition("@")
    if not path or not sha:
        return "", ""
    return path, sha


def select(
    results: list[dict[str, Any]],
    *,
    approved_revisions: dict[str, str],
    namespace: str,
    limit: int,
) -> list[Lesson]:
    """Turn raw search results into the lessons an attempt may be given.

    `approved_revisions` maps a document path to the SHA this attempt was
    approved against, taken from the handoff. A lesson naming the same path at a
    different SHA is kept and flagged `recheck` -- the plan wants a changed
    source to prompt rechecking, not to erase the lesson.

    The staleness check is deliberately local. Resolving a lesson's reference
    against the planning repository would need a read credential and network
    egress for what buys existence-checking rather than integrity, and the same
    argument already settled the identical question for handoff references.
    """
    chosen: list[Lesson] = []
    for entry in results:
        memory = entry.get("memory") or {}
        memory_id = str(memory.get("id") or "")
        if not memory_id:
            continue

        found_namespace = str(memory.get("namespace") or "")
        if found_namespace and found_namespace != namespace:
            # Belt and braces: the query is already namespace-scoped, so this
            # only fires if the server ever widened a scope on its own. An
            # attempt reading another project's knowledge is the exact failure
            # the context-isolation gate exists to catch, so it is checked twice
            # rather than trusted once.
            log.warning(
                "dropping memory %s from namespace %r, expected %r",
                memory_id,
                found_namespace,
                namespace,
            )
            continue

        tier = str(memory.get("tier") or "")
        if tier not in DURABLE_TIERS:
            continue

        tags = [str(t) for t in (memory.get("tags") or [])]
        if REVIEWED_TAG not in tags:
            continue

        metadata = memory.get("metadata") or {}
        if str(metadata.get(META_SUPERSEDED) or ""):
            continue

        source_revision = str(metadata.get(META_SOURCE_REVISION) or "")
        recheck, recheck_reason = False, ""
        path, sha = _revision_parts(source_revision)
        approved_sha = approved_revisions.get(path) if path else None
        if approved_sha and approved_sha != sha:
            recheck = True
            recheck_reason = (
                f"learned from {path} at {sha[:12]}, this task is approved "
                f"against {approved_sha[:12]}"
            )

        chosen.append(
            Lesson(
                memory_id=memory_id,
                content=str(memory.get("content") or ""),
                namespace=found_namespace or namespace,
                tier=tier,
                score=float(entry.get("score") or 0.0),
                source_revision=source_revision,
                tags=tags,
                recheck=recheck,
                recheck_reason=recheck_reason,
            )
        )
        if len(chosen) >= limit:
            break

    return chosen


class MeminiUnavailable(Exception):
    """Retrieval failed. Never fatal: lessons are optional by design."""


class MeminiClient:
    """Read-only access to the memory store, for the orchestrator alone.

    There is no write path here. An attempt proposes knowledge as an artifact in
    its result and a human accepts it; handing the orchestrator a write method
    would make it one refactor away from writing on an attempt's behalf.
    """

    def __init__(self, base_url: str, api_key: str, timeout_seconds: float = 10.0) -> None:
        self.base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._timeout = timeout_seconds

    @property
    def configured(self) -> bool:
        return bool(self.base_url and self._api_key)

    async def search(
        self,
        *,
        query: str,
        namespace: str,
        limit: int,
    ) -> list[dict[str, Any]]:
        if not self.configured:
            raise MeminiUnavailable("no Memini endpoint or API key configured")

        body = {
            "query": query,
            "limit": limit,
            # Scoping happens server-side as well as in `select`. The API key
            # carries a default namespace, so omitting this would silently
            # query whatever that default happens to be rather than the
            # project's own.
            "namespaces": [namespace],
            "tiers": sorted(DURABLE_TIERS),
            "tags": [REVIEWED_TAG],
        }
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as http:
                response = await http.post(
                    f"{self.base_url}/v1/search",
                    json=body,
                    headers={"Authorization": f"Bearer {self._api_key}"},
                )
                response.raise_for_status()
                payload = response.json()
        except httpx.HTTPStatusError as exc:
            raise MeminiUnavailable(
                f"search returned {exc.response.status_code}: {exc.response.text[:200]}"
            ) from exc
        except Exception as exc:  # noqa: BLE001 - httpx raises a wide family
            raise MeminiUnavailable(f"search failed: {exc}") from exc

        results = payload.get("results")
        if not isinstance(results, list):
            raise MeminiUnavailable("search response had no results list")
        return results
