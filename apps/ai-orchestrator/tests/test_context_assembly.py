"""Context assembly: what an attempt is given, and what it must never be given.

The four gates the plan asks for live here. Three of them are about *absence* --
an unreviewed lesson, another project's knowledge, a secret -- and absence is
the easiest thing in the world to prove by accident. So every one of them is
paired with a mutation that makes the thing appear: if the positive control does
not flip, the negative assertion was measuring nothing.

Payload shapes are copied from the live Memini v0.7.24 API rather than invented.
"""

from __future__ import annotations

import json
import os

import pytest

from orchestrator.activities import assemble as assemble_acts
from orchestrator.activities import context as activity_context
from orchestrator.context import assemble
from orchestrator.context.manifest import KIND_CHECKPOINT, KIND_LESSON, LessonsStatus
from orchestrator.contracts import Approval, AttemptRef, BoardActor, Handoff
from orchestrator.memory.memini import Lesson, MeminiClient, MeminiUnavailable, select
from orchestrator.projects import Project, Registry
from orchestrator.settings import Settings

from conftest import sample_handoff

NAMESPACE = "home-cluster"
OTHER_NAMESPACE = "some-other-project"

SPEC_PATH = "specs/card-1.md"
DESIGN_PATH = "designs/card-1.md"
SPEC_SHA = "b" * 40
DESIGN_SHA = "c" * 40


def handoff() -> Handoff:
    return sample_handoff("card-1")


def approval(handoff_hash: str) -> Approval:
    return Approval(
        actor=BoardActor(id="human-1", name="Christian"),
        handoff_hash=handoff_hash,
        design_revision=f"{DESIGN_PATH}@{DESIGN_SHA}",
        base_commit="a" * 40,
        repository="chrtol/home-cluster",
        recorded_at="2026-09-11T12:00:00+00:00",
        event_key="evt-approve",
    )


def attempt(number: int = 1) -> AttemptRef:
    return AttemptRef(
        task_id="card-1",
        board_id="board-1",
        handoff_hash=handoff().content_hash(),
        attempt_number=number,
    )


def build(*, lessons=None, previous="", number=1, status=None):
    card = handoff()
    return assemble.build(
        approval=approval(card.content_hash()),
        handoff=card,
        attempt=attempt(number),
        job_image="ghcr.io/chrtol/ai-orchestrator:test@sha256:" + "d" * 64,
        policy_text=assemble_acts.policy_text(),
        lessons=list(lessons or []),
        lessons_status=status or LessonsStatus(status="ok", namespace=NAMESPACE),
        previous_attempt=previous,
        built_at="2026-09-11T12:00:00+00:00",
    )


def manifest_of(package) -> dict:
    return json.loads(package.files["manifest.json"])


def memory(
    *,
    memory_id="mem-1",
    content="Prefer the OCI chart; the classic index lags a release.",
    tags=("reviewed",),
    tier="semantic",
    namespace=NAMESPACE,
    metadata=None,
    score=0.9,
) -> dict:
    """One `/v1/search` result, shaped as the live API returns it."""
    return {
        "memory": {
            "id": memory_id,
            "content": content,
            "namespace": namespace,
            "tags": list(tags),
            "tier": tier,
            "level": "explicit",
            "metadata": metadata if metadata is not None else {},
            "content_hash": "0" * 16,
        },
        "score": score,
    }


def selected(results, **overrides) -> list[Lesson]:
    body = dict(approved_revisions=assemble.approved_revisions(handoff()), namespace=NAMESPACE, limit=8)
    body.update(overrides)
    return select(results, **body)


# ------------------------------------------------------------------- the package


class TestThePackage:
    def test_every_file_the_job_looks_for_is_present(self):
        package = build()
        assert set(package.files) == {
            "policy.md",
            "handoff.json",
            "lessons.json",
            "manifest.json",
        }

    def test_the_handoff_rehashes_to_the_approval_it_was_dispatched_under(self):
        """The load-bearing property of the whole package.

        An attempt is judged against the handoff a human approved. If this
        document is not that document -- a field dropped, a list reordered into
        something else -- then the contract the attempt reads and the contract
        the approval binds to have silently diverged, and every downstream
        guarantee is about the wrong text.
        """
        card = handoff()
        package = build()
        rebuilt = Handoff(**json.loads(package.files["handoff.json"]))
        assert rebuilt.content_hash() == card.content_hash()
        assert manifest_of(package)["handoff_hash"] == card.content_hash()

    def test_a_dropped_field_would_break_that(self):
        """The control for the test above.

        `content_hash` covers every field, so this passes only because the
        serializer is exhaustive. Proving that means removing a field and
        watching the hash move.
        """
        document = json.loads(build().files["handoff.json"])
        document["out_of_scope"] = ["something the human did not approve"]
        assert Handoff(**document).content_hash() != handoff().content_hash()

    def test_the_manifest_gives_every_item_a_source_and_a_reason(self):
        package = build(lessons=selected([memory()]))
        items = manifest_of(package)["items"]
        assert items, "a package with no recorded sources is not auditable"
        for item in items:
            assert item["ref"], item
            assert item["reason"], item
            assert item["kind"]

    def test_the_policy_is_versioned_by_the_image_that_shipped_it(self):
        """Nothing else identifies which policy text an attempt was handed."""
        package = build()
        policy = next(i for i in manifest_of(package)["items"] if i["kind"] == "policy")
        assert policy["revision"] == manifest_of(package)["job_image"]
        assert "sha256:" in policy["revision"]


class TestFreshVersusResumed:
    def test_a_first_attempt_has_no_resume_pointer(self):
        resume = manifest_of(build())["resume"]
        assert resume["previous_attempt"] == ""
        assert not [i for i in manifest_of(build())["items"] if i["kind"] == KIND_CHECKPOINT]

    def test_a_resumed_attempt_names_the_attempt_it_continues(self):
        previous = attempt(1).job_name
        package = build(previous=previous, number=2)
        resume = manifest_of(package)["resume"]

        assert resume["previous_attempt"] == previous
        # Relative to the workspace root the worker was given, not absolute.
        assert resume["checkpoint_path"] == f"attempts/{previous}/checkpoint.json"
        assert package.resumed_from == previous

        item = next(i for i in manifest_of(package)["items"] if i["kind"] == KIND_CHECKPOINT)
        assert item["ref"] == f"workspace checkpoint {previous}"

    def test_both_attempts_share_one_workspace_but_not_one_context(self):
        """Resume depends on the first half; isolation on the second."""
        assert attempt(1).workspace_name == attempt(2).workspace_name
        assert attempt(1).context_name != attempt(2).context_name


class TestTruncation:
    def test_an_oversized_lesson_is_clipped_and_says_so(self):
        big = Lesson(
            memory_id="mem-big",
            content="x" * (assemble.LESSON_MAX_BYTES * 2),
            namespace=NAMESPACE,
            tier="semantic",
            score=0.9,
        )
        package = build(lessons=[big])
        item = next(i for i in manifest_of(package)["items"] if i["ref"] == "mem-big")

        assert item["truncated"] is True
        assert item["bytes"] <= assemble.LESSON_MAX_BYTES
        assert assemble.TRUNCATION_MARKER in json.loads(package.files["lessons.json"])["lessons"][0]["content"]

    def test_a_normal_lesson_is_not_marked_truncated(self):
        """Control: `truncated` tracks the content, not the code path."""
        package = build(lessons=selected([memory()]))
        item = next(i for i in manifest_of(package)["items"] if i["kind"] == KIND_LESSON)
        assert item["truncated"] is False

    def test_lessons_are_dropped_before_the_budget_is_breached_and_the_count_is_recorded(self):
        # Each lesson is clipped to LESSON_MAX_BYTES, so enough of them exceed
        # the budget while no single one does.
        many = [
            Lesson(
                memory_id=f"mem-{i}",
                content="y" * assemble.LESSON_MAX_BYTES,
                namespace=NAMESPACE,
                tier="semantic",
                score=1.0 - i / 1000,
            )
            for i in range(assemble.CONTEXT_BUDGET_BYTES // assemble.LESSON_MAX_BYTES + 20)
        ]
        package = build(lessons=many)
        lessons = manifest_of(package)["lessons"]

        assert lessons["dropped_for_budget"] > 0
        assert lessons["selected"] < len(many)
        assert package.total_bytes <= assemble.CONTEXT_BUDGET_BYTES

    def test_the_handoff_and_policy_are_never_the_thing_that_gets_cut(self):
        """They are the approval; dropping them to fit would be a lie of omission."""
        many = [
            Lesson(
                memory_id=f"mem-{i}",
                content="y" * assemble.LESSON_MAX_BYTES,
                namespace=NAMESPACE,
                tier="semantic",
                score=0.5,
            )
            for i in range(400)
        ]
        package = build(lessons=many)
        rebuilt = Handoff(**json.loads(package.files["handoff.json"]))

        assert rebuilt.content_hash() == handoff().content_hash()
        assert rebuilt.acceptance_checks == handoff().acceptance_checks
        assert package.files["policy.md"] == assemble_acts.policy_text()


# ---------------------------------------------------------------------- gate 1


class TestMemoryPersistence:
    def test_a_reviewed_lesson_reaches_the_package_with_its_source(self):
        source = f"{DESIGN_PATH}@{DESIGN_SHA}"
        lessons = selected([memory(metadata={"source_revision": source})])
        package = build(lessons=lessons)
        item = next(i for i in manifest_of(package)["items"] if i["kind"] == KIND_LESSON)

        assert item["ref"] == "mem-1"
        assert item["revision"] == source
        assert item["recheck"] is False
        assert json.loads(package.files["lessons.json"])["lessons"][0]["id"] == "mem-1"

    def test_an_unreviewed_hypothesis_does_not_become_an_instruction(self):
        assert selected([memory(tags=("gotcha",))]) == []

    def test_a_working_tier_note_is_not_a_lesson(self):
        """A naive Memini write lands in `working` and expires in three days.

        That is the shape of an unreviewed hypothesis, so tier is checked as
        well as the tag rather than trusting one marker to carry both.
        """
        assert selected([memory(tier="working")]) == []

    def test_the_review_marker_is_what_makes_the_difference(self):
        """Control for the two above: same memory, tag added, now selected."""
        assert [lesson.memory_id for lesson in selected([memory()])] == ["mem-1"]


# ---------------------------------------------------------------------- gate 2


class TestInvalidation:
    def test_a_superseded_lesson_is_excluded(self):
        assert selected([memory(metadata={"superseded_by": "mem-9"})]) == []

    def test_the_same_lesson_without_that_marker_is_included(self):
        """Control: supersession is doing the excluding, not something else."""
        assert len(selected([memory(metadata={"author": "claude-code"})])) == 1

    def test_a_lesson_whose_source_moved_on_is_kept_but_flagged(self):
        stale = f"{DESIGN_PATH}@{'9' * 40}"
        lessons = selected([memory(metadata={"source_revision": stale})])

        assert len(lessons) == 1, "a changed source prompts rechecking, it does not erase"
        assert lessons[0].recheck is True
        assert DESIGN_SHA[:12] in lessons[0].recheck_reason

        item = next(
            i for i in manifest_of(build(lessons=lessons))["items"] if i["kind"] == KIND_LESSON
        )
        assert item["recheck"] is True
        assert item["recheck_reason"]

    def test_a_lesson_at_the_approved_revision_is_not_flagged(self):
        """Control: the flag tracks the SHA, not merely having a source at all."""
        current = f"{DESIGN_PATH}@{DESIGN_SHA}"
        assert selected([memory(metadata={"source_revision": current})])[0].recheck is False

    def test_a_lesson_about_an_unrelated_document_is_not_flagged(self):
        other = f"docs/something-else.md@{'9' * 40}"
        assert selected([memory(metadata={"source_revision": other})])[0].recheck is False

    def test_the_approved_revisions_come_from_the_handoff(self):
        assert assemble.approved_revisions(handoff()) == {
            SPEC_PATH: SPEC_SHA,
            DESIGN_PATH: DESIGN_SHA,
        }


# ---------------------------------------------------------------------- gate 3


class RecordingHttp:
    """Stands in for httpx.AsyncClient and keeps the request body."""

    bodies: list[dict] = []

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def post(self, url, json=None, headers=None):
        RecordingHttp.bodies.append({"url": url, "json": json, "headers": headers})
        return _Response({"results": [memory()]})


class _Response:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


@pytest.fixture
def recorded(monkeypatch):
    RecordingHttp.bodies = []
    monkeypatch.setattr("orchestrator.memory.memini.httpx.AsyncClient", RecordingHttp)
    return RecordingHttp.bodies


class TestContextIsolation:
    async def test_the_query_is_scoped_to_this_project_namespace(self, recorded):
        client = MeminiClient("http://memini.test:8080", "a-key")
        await client.search(query="anything", namespace=NAMESPACE, limit=8)

        body = recorded[0]["json"]
        assert body["namespaces"] == [NAMESPACE]
        assert OTHER_NAMESPACE not in json.dumps(body)

    async def test_omitting_the_namespace_is_not_possible(self, recorded):
        """The field is always sent, so the API key's default can never decide.

        Memini rejects an unknown top-level field with a 400, so this name is
        also verified against the real server rather than only against a fake.
        """
        client = MeminiClient("http://memini.test:8080", "a-key")
        await client.search(query="anything", namespace=OTHER_NAMESPACE, limit=8)
        assert recorded[0]["json"]["namespaces"] == [OTHER_NAMESPACE]

    def test_a_result_from_another_namespace_is_dropped_even_if_returned(self):
        """Defence in depth: the server is scoped, and the answer is checked."""
        assert selected([memory(namespace=OTHER_NAMESPACE)]) == []

    def test_the_same_memory_in_this_namespace_is_kept(self):
        """Control: namespace is what excluded it above."""
        assert len(selected([memory(namespace=NAMESPACE)])) == 1

    def test_no_orchestrator_environment_value_reaches_the_package(self, monkeypatch):
        """A canary in the environment the assembler runs in.

        The assembler takes every input as an argument and reads no settings, so
        this holds by construction -- which is exactly the kind of property that
        stops holding the first time someone reaches for `os.environ` to fill in
        a default.
        """
        canary = "canary-env-value-8f3a2b"
        monkeypatch.setenv("KAN_API_KEY", canary)
        monkeypatch.setenv("MEMINI_API_KEY", canary)
        monkeypatch.setenv("SOME_FUTURE_CREDENTIAL", canary)

        blob = json.dumps(build(lessons=selected([memory()])).files)
        assert canary not in blob
        assert os.environ["KAN_API_KEY"] == canary, "the canary must actually be set"

    def test_no_secret_the_orchestrator_holds_reaches_the_package(self):
        """The same question asked of the credentials it holds as objects."""
        canary = "canary-secret-value-4d91cc"
        settings = Settings(
            address="temporal:7233",
            namespace="ai-coding",
            task_queue="ai-coding",
            kan_base_url="https://board.invalid/api/v1",
            kan_api_key=canary,
            kan_webhook_secret=canary,
            kan_self_actor_id="",
            projects_path="/config/projects.yaml",
            jobs_namespace="ai-jobs",
            workspace_storage_class="csi-rbd-sc",
            workspace_size="5Gi",
            job_image="image:test",
            job_fail_at_step=0,
            job_fail_task_id="",
            reconcile_interval_seconds=300,
            desktop_id="primary",
            dispatcher_history_limit=500,
            task_history_limit=200,
            memini_api_key=canary,
        )
        blob = json.dumps(build(lessons=selected([memory()])).files)

        assert settings.kan_api_key == canary, "the canary must actually be set"
        assert canary not in blob


# ------------------------------------------------------- degraded, not blocking


class FakeMemini:
    def __init__(self, *, results=None, error=None):
        self.results = results or []
        self.error = error
        self.calls: list[dict] = []
        self.configured = True

    async def search(self, *, query, namespace, limit):
        self.calls.append({"query": query, "namespace": namespace, "limit": limit})
        if self.error:
            raise self.error
        return self.results


def install_context(memini, *, memory_namespace=NAMESPACE, board="AI Test"):
    registry = Registry(
        projects={
            board.casefold(): Project(
                board=board,
                repository="chrtol/home-cluster",
                memory_namespace=memory_namespace,
            )
        }
    )
    activity_context.install(
        activity_context.Context(
            kan=None, projects=registry, settings=None, jobs=None, memini=memini
        )
    )


def assemble_request(number=1, previous="", board="AI Test"):
    card = handoff()
    return assemble_acts.AssembleRequest(
        approval=approval(card.content_hash()),
        handoff=card,
        attempt=attempt(number),
        board_name=board,
        job_image="image:test",
        previous_attempt=previous,
    )


class TestRetrievalFailureIsRecordedNotInvented:
    async def test_an_unreachable_store_still_produces_a_package(self):
        install_context(FakeMemini(error=MeminiUnavailable("connection refused")))
        package = await assemble_acts.assemble_context(assemble_request())

        assert package.lessons_status.startswith("degraded: ")
        assert "connection refused" in package.lessons_status
        assert json.loads(package.files["lessons.json"])["lessons"] == []
        # The attempt is still fully specified; only the optional part is gone.
        assert Handoff(**json.loads(package.files["handoff.json"])).goal == handoff().goal

    async def test_a_project_with_no_memory_namespace_queries_nothing_at_all(self):
        memini = FakeMemini(results=[memory()])
        install_context(memini, memory_namespace="")
        package = await assemble_acts.assemble_context(assemble_request())

        assert memini.calls == [], "an unconfigured namespace must not fall back to a default"
        assert "no memory_namespace" in package.lessons_status

    async def test_a_working_store_reports_ok_and_queries_its_own_namespace(self):
        """Control for both tests above."""
        memini = FakeMemini(results=[memory()])
        install_context(memini)
        package = await assemble_acts.assemble_context(assemble_request())

        assert package.lessons_status == "ok"
        assert package.lessons_selected == 1
        assert [call["namespace"] for call in memini.calls] == [NAMESPACE]

    async def test_the_query_describes_this_task_and_nothing_else(self):
        memini = FakeMemini(results=[])
        install_context(memini)
        await assemble_acts.assemble_context(assemble_request())

        query = memini.calls[0]["query"]
        assert handoff().goal in query
        assert handoff().scope[0] in query
