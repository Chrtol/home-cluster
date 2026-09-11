"""Webhook signature, normalization and dedup-key stability.

The fixtures below are shaped exactly like kan v0.6.0's `WebhookPayload`, so a
change in kan that breaks these is a change that would have broken production.
"""

from __future__ import annotations

import hashlib
import hmac
import json

import pytest

from orchestrator.board.events import (
    HandoffInvalid,
    WebhookRejected,
    dumps_handoff,
    normalize,
    parse_handoff,
    verify_signature,
)
from orchestrator.contracts import BoardEvent, EventKind, Stage

SECRET = "s3cr3t-webhook-key"


def moved_payload(**overrides):
    payload = {
        "event": "card.moved",
        "timestamp": "2026-09-09T14:30:00.123Z",
        "data": {
            "card": {
                "id": "412",
                "publicId": "abcdefghijkl",
                "title": "Add retry to the widget poller",
                "description": "<p>handoff</p>",
                "dueDate": None,
                "listId": "list-ready-01",
                "boardId": "board-fake-01",
            },
            "board": {"id": "board-fake-01", "name": "Example Project"},
            "list": {"id": "list-ready-01", "name": "Ready for local"},
            "user": {"id": "c4b2ba64-user", "name": "Christian F. T."},
            "changes": {"listId": {"from": "list-review-01", "to": "list-ready-01"}},
        },
    }
    payload.update(overrides)
    return payload


def sign(body: bytes, secret: str = SECRET) -> str:
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


class TestSignature:
    def test_accepts_a_genuine_signature(self):
        body = json.dumps(moved_payload()).encode()
        verify_signature(body, sign(body), SECRET)

    def test_rejects_a_wrong_signature(self):
        body = json.dumps(moved_payload()).encode()
        with pytest.raises(WebhookRejected, match="mismatch"):
            verify_signature(body, sign(body, "wrong-key"), SECRET)

    def test_rejects_a_missing_signature(self):
        with pytest.raises(WebhookRejected, match="missing"):
            verify_signature(b"{}", None, SECRET)

    def test_refuses_to_run_without_a_configured_secret(self):
        # An empty secret must fail closed, not verify everything.
        with pytest.raises(WebhookRejected, match="no webhook secret"):
            verify_signature(b"{}", "anything", "")

    def test_signature_is_over_raw_bytes_not_reparsed_json(self):
        """Re-serializing the payload must not produce a matching signature.

        kan signs the exact bytes it sent. If the receiver ever hashed
        `json.dumps(json.loads(body))` instead, key order would differ and every
        delivery would fail — or worse, would pass with a canonicalization that
        an attacker could also compute.
        """
        payload = moved_payload()
        body = json.dumps(payload, sort_keys=False).encode()
        reserialized = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
        assert body != reserialized
        verify_signature(body, sign(body), SECRET)
        with pytest.raises(WebhookRejected):
            verify_signature(reserialized, sign(body), SECRET)


class TestNormalize:
    def test_extracts_destination_stage_and_actor(self):
        event = normalize(moved_payload())
        assert event.kind is EventKind.MOVED
        assert event.stage is Stage.READY
        assert event.card_id == "abcdefghijkl"
        assert event.board_id == "board-fake-01"
        assert event.board_name == "Example Project"
        assert event.actor is not None and event.actor.id == "c4b2ba64-user"
        assert event.moved_from_list_id == "list-review-01"
        assert event.changed_fields == ["listId"]

    def test_unknown_list_name_is_not_an_error(self):
        """A project board may carry columns this pipeline does not know."""
        payload = moved_payload()
        payload["data"]["list"]["name"] = "Icebox"
        assert normalize(payload).stage is Stage.UNKNOWN

    def test_rejects_an_event_kind_kan_does_not_emit(self):
        with pytest.raises(WebhookRejected, match="unsupported event"):
            normalize(moved_payload(event="card.commented"))

    def test_rejects_a_payload_with_no_card(self):
        payload = moved_payload()
        payload["data"]["card"].pop("publicId")
        with pytest.raises(WebhookRejected, match="publicId"):
            normalize(payload)

    def test_stage_matching_ignores_case_and_padding(self):
        payload = moved_payload()
        payload["data"]["list"]["name"] = "  ready FOR local "
        assert normalize(payload).stage is Stage.READY


class TestDedupKey:
    def test_a_redelivery_produces_the_same_key(self):
        """kan stamps `timestamp` once when it builds the payload.

        So the same logical event re-sent (or re-derived) yields an identical
        key, which is the whole basis of the workflow's duplicate suppression.
        """
        assert normalize(moved_payload()).event_key == normalize(moved_payload()).event_key

    def test_two_genuine_events_differ(self):
        first = normalize(moved_payload())
        second = normalize(moved_payload(timestamp="2026-09-09T14:31:00.000Z"))
        assert first.event_key != second.event_key

    def test_same_moment_on_different_cards_differs(self):
        other = moved_payload()
        other["data"]["card"]["publicId"] = "zzzzzzzzzzzz"
        assert normalize(moved_payload()).event_key != normalize(other).event_key

    def test_key_is_a_pure_function_of_its_inputs(self):
        assert BoardEvent.make_key("card.moved", "t", "b", "c") == BoardEvent.make_key(
            "card.moved", "t", "b", "c"
        )


HANDOFF = {
    "task_id": "abcdefghijkl",
    "spec_revision": "specs/widget-poller.md@" + "b" * 40,
    "design_revision": "designs/widget-poller.md@" + "c" * 40,
    "repository": "chrtol/home-cluster",
    "base_commit": "a" * 40,
    "goal": "Retry the widget poller on 5xx",
    "scope": ["src/poller.py"],
    "out_of_scope": ["src/api.py"],
    "allowed_paths": ["src/**"],
    "interfaces": ["poll() keeps its signature"],
    "dependencies": [],
    "acceptance_checks": ["unit"],
    "open_questions": [],
}


class TestParseHandoff:
    def test_parses_a_plain_yaml_description(self):
        handoff = parse_handoff(dumps_handoff_dict(HANDOFF))
        assert handoff.repository == "chrtol/home-cluster"
        assert handoff.acceptance_checks == ["unit"]

    def test_parses_a_fenced_block_inside_prose(self):
        body = (
            "<p>Some notes for a human reader.</p>"
            "<pre><code>```yaml\n" + dumps_handoff_dict(HANDOFF) + "```</code></pre>"
        )
        assert parse_handoff(body).goal == HANDOFF["goal"]

    def test_unescapes_entities_from_the_rich_text_editor(self):
        """kan stores descriptions as HTML, so `>` arrives as `&gt;`."""
        yaml_text = dumps_handoff_dict({**HANDOFF, "goal": "a > b"})
        assert parse_handoff("<p>" + yaml_text.replace(">", "&gt;") + "</p>").goal == "a > b"

    def test_block_tags_become_newlines(self):
        """Paragraph-per-line handoffs must not collapse into one YAML line."""
        lines = dumps_handoff_dict(HANDOFF).strip().split("\n")
        html = "".join(f"<p>{line}</p>" for line in lines)
        assert parse_handoff(html).base_commit == HANDOFF["base_commit"]

    def test_rejects_a_missing_required_field(self):
        incomplete = {k: v for k, v in HANDOFF.items() if k != "base_commit"}
        with pytest.raises(HandoffInvalid, match="base_commit"):
            parse_handoff(dumps_handoff_dict(incomplete))

    def test_rejects_an_empty_description(self):
        with pytest.raises(HandoffInvalid, match="empty"):
            parse_handoff("<p></p>")

    def test_rejects_non_yaml(self):
        with pytest.raises(HandoffInvalid):
            parse_handoff("<p>just some prose: [unclosed</p>")

    def test_does_not_construct_arbitrary_python(self):
        """`safe_load` only. Card text is untrusted by definition."""
        with pytest.raises(HandoffInvalid):
            parse_handoff("<p>!!python/object/apply:os.system ['echo pwned']</p>")


class TestRevisionReferences:
    """Task 2: `spec_revision` and `design_revision` must be content-addressed.

    The traceability design leans on one property: editing the design changes
    the field, which changes `content_hash()`, which revokes the approval bound
    to the old hash. A mutable reference -- a branch name, `HEAD`, a tag -- keeps
    pointing at "whatever that means now", so the field never changes and the
    approval silently survives the edit that was supposed to revoke it.

    Shape only, on purpose. Resolving the reference would need a read credential
    for a private repo and egress the default-deny NetworkPolicy blocks, and it
    would buy existence-checking rather than integrity -- a human at Design
    review already looked at the thing.
    """

    @pytest.mark.parametrize("field", ["spec_revision", "design_revision"])
    @pytest.mark.parametrize(
        "value",
        [
            "main",
            "HEAD",
            "v1.2.0",
            "design-1",
            # Right idea, no path to say which object it is.
            "a" * 40,
            # A path, but the ref is not a full commit sha.
            "designs/thing.md@abc1234",
            "designs/thing.md@HEAD",
            # Uppercase: git writes object names in lowercase hex, and allowing
            # both would make two spellings of one commit hash differently.
            "designs/thing.md@" + "A" * 40,
            "designs/thing.md@" + "a" * 39,
            "designs/thing.md@" + "a" * 41,
            # Not hex at all, but the right length.
            "designs/thing.md@" + "z" * 40,
            "designs/thing @" + "a" * 40,
        ],
    )
    def test_a_mutable_or_malformed_reference_is_rejected(self, field, value):
        with pytest.raises(HandoffInvalid, match=field):
            parse_handoff(dumps_handoff_dict({**HANDOFF, field: value}))

    @pytest.mark.parametrize("field", ["spec_revision", "design_revision"])
    def test_a_content_addressed_reference_is_accepted(self, field):
        """Control. Without it the rejections above could be rejecting anything."""
        value = "planning/designs/thing.md@" + "0123456789abcdef" * 2 + "01234567"
        assert len(value.split("@")[1]) == 40
        handoff = parse_handoff(dumps_handoff_dict({**HANDOFF, field: value}))
        assert getattr(handoff, field) == value

    def test_the_error_says_what_the_shape_should_be(self):
        """The message is the only instruction the person editing the card gets."""
        with pytest.raises(HandoffInvalid, match="40-hex-commit-sha"):
            parse_handoff(dumps_handoff_dict({**HANDOFF, "design_revision": "main"}))


class TestHandoffHash:
    def test_reordering_a_list_is_not_a_material_change(self):
        a = parse_handoff(dumps_handoff_dict({**HANDOFF, "scope": ["x.py", "y.py"]}))
        b = parse_handoff(dumps_handoff_dict({**HANDOFF, "scope": ["y.py", "x.py"]}))
        assert a.content_hash() == b.content_hash()

    @pytest.mark.parametrize(
        "field,value",
        [
            ("base_commit", "b" * 40),
            ("design_revision", "designs/widget-poller.md@" + "d" * 40),
            ("goal", "something else entirely"),
            ("allowed_paths", ["tests/**"]),
            ("acceptance_checks", ["unit", "integration"]),
            ("out_of_scope", []),
        ],
    )
    def test_any_substantive_edit_changes_the_hash(self, field, value):
        """Each of these must invalidate an existing approval."""
        baseline = parse_handoff(dumps_handoff_dict(HANDOFF)).content_hash()
        edited = parse_handoff(dumps_handoff_dict({**HANDOFF, field: value})).content_hash()
        assert edited != baseline

    def test_round_trips_through_the_serializer(self):
        handoff = parse_handoff(dumps_handoff_dict(HANDOFF))
        assert parse_handoff(dumps_handoff(handoff)).content_hash() == handoff.content_hash()


def dumps_handoff_dict(body: dict) -> str:
    import yaml

    return yaml.safe_dump(body, sort_keys=True)
