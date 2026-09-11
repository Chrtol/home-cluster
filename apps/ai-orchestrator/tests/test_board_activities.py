"""The board activities, driven against the real parser instead of a fake.

Everywhere else in this suite `fetch_card` and `reconcile_board` are substituted
by `conftest.build_activities`, which returns whatever handoff the test put in
`FakeWorld`. That keeps the workflow tests about the state machine, but it means
nothing exercised the step where card *text* becomes a handoff the workflow will
trust -- and that step is the only place a bad handoff can be stopped, because
both paths turn one into a Blocked card rather than an error.

These tests install a real `Context` over fake I/O and call the activities
directly.
"""

from __future__ import annotations

import pytest

from orchestrator.activities import context as activity_context
from orchestrator.activities.board import fetch_card
from orchestrator.activities.reconcile import reconcile_board
from orchestrator.board.events import dumps_handoff
from orchestrator.board.kan import KanCard, KanList
from orchestrator.contracts import Stage
from orchestrator.projects import load
from orchestrator.settings import Settings

from conftest import sample_handoff

CARD = "abcdefghijkl"
OTHER_CARD = "zyxwvutsrqpo"
BOARD = "board-1"
BOARD_NAME = "Example Project"
READY_LIST = "ready-list"

CONFIG = """
projects:
  - board: Example Project
    repository: chrtol/home-cluster
    checks:
      unit: ["python", "-m", "pytest", "-q"]
"""

SETTINGS = Settings(
    address="localhost:7233",
    namespace="ai-coding",
    task_queue="ai-coding",
    kan_base_url="",
    kan_api_key="",
    kan_webhook_secret="",
    kan_self_actor_id="",
    projects_path="/config/projects.yaml",
    jobs_namespace="ai-jobs",
    workspace_storage_class="csi-rbd-sc",
    workspace_size="5Gi",
    job_image="image:1",
    job_fail_at_step=0,
    job_fail_task_id="",
    reconcile_interval_seconds=300,
    desktop_id="primary",
    dispatcher_history_limit=500,
    task_history_limit=200,
)


def card_with(handoff, card_id: str = CARD) -> KanCard:
    """A card in 'Ready for local' whose description carries `handoff`."""
    return KanCard(
        public_id=card_id,
        title="a task",
        description="<p>" + dumps_handoff(handoff).replace("\n", "</p><p>") + "</p>",
        list_id=READY_LIST,
        list_name=Stage.READY.value,
        board_id=BOARD,
        board_name=BOARD_NAME,
    )


class FakeKan:
    def __init__(self, *cards: KanCard):
        self.cards = {c.public_id: c for c in cards}

    async def get_card(self, card_id: str) -> KanCard:
        return self.cards[card_id]

    async def resolve_board_id(self, board_name: str) -> str:
        return BOARD

    async def get_lists(self, board_id: str) -> list[KanList]:
        return [KanList(public_id=READY_LIST, name=Stage.READY.value, index=0)]

    async def get_cards_in_list(self, board_id: str, list_id: str) -> list[KanCard]:
        return list(self.cards.values())

    async def last_move_actor(self, card_id: str, to_list_id: str):
        return ("christian@example.test", "Christian")


class FakeTemporal:
    """Records the workflow starts the sweep would have issued."""

    def __init__(self):
        self.started: list[str] = []

    async def start_workflow(self, *args, **kwargs):
        self.started.append(kwargs["id"])
        return None


@pytest.fixture
def installed(tmp_path):
    """Install a Context and take it back down again.

    `context.install` writes a module global, so a test that left one behind
    would silently change what every later test in the session runs against.
    """
    path = tmp_path / "projects.yaml"
    path.write_text(CONFIG)

    def _install(kan, temporal=None):
        activity_context.install(
            activity_context.Context(
                kan=kan,
                projects=load(path),
                settings=SETTINGS,
                jobs=None,
                temporal=temporal,
            )
        )
        return temporal

    try:
        yield _install
    finally:
        activity_context._context = None


class TestFetchCardAcceptsAGoodCard:
    """The control case. Without it the rejection tests below prove nothing."""

    async def test_a_matching_handoff_is_returned(self, installed):
        installed(FakeKan(card_with(sample_handoff(CARD))))
        snapshot = await fetch_card(CARD)
        assert snapshot.handoff is not None, snapshot.handoff_error
        assert snapshot.handoff_error == ""
        assert snapshot.handoff.task_id == CARD


class TestHandoffMustNameItsOwnCard:
    """Task 1: `task_id` is the link a planning document follows to the board.

    Never a privilege question -- dispatch is built from the card id the event
    carried, so a mismatch could not have executed against another task. It is
    an audit-trail question: the record has to be true.
    """

    async def test_a_handoff_claiming_another_card_yields_no_handoff(self, installed):
        installed(FakeKan(card_with(sample_handoff(OTHER_CARD))))

        snapshot = await fetch_card(CARD)

        # No handoff means the workflow takes its existing Blocked path.
        assert snapshot.handoff is None
        assert snapshot.handoff_hash == ""

    async def test_the_error_names_both_ids(self, installed):
        """A human reading the Blocked comment has to be able to act on it."""
        installed(FakeKan(card_with(sample_handoff(OTHER_CARD))))

        snapshot = await fetch_card(CARD)

        assert OTHER_CARD in snapshot.handoff_error, snapshot.handoff_error
        assert CARD in snapshot.handoff_error, snapshot.handoff_error

    async def test_the_sweep_does_not_approve_it_either(self, installed):
        """The reconciler is a second, independent way into approval.

        It re-derives events from board state rather than reading a webhook, so
        a check that only sat in `fetch_card` would leave this path open.
        """
        temporal = installed(
            FakeKan(card_with(sample_handoff(OTHER_CARD))), FakeTemporal()
        )

        signalled = await reconcile_board(BOARD_NAME)

        assert signalled == 0
        assert temporal.started == []

    async def test_the_sweep_still_approves_a_good_card(self, installed):
        """Control: the sweep is not simply inert under this fixture."""
        temporal = installed(FakeKan(card_with(sample_handoff(CARD))), FakeTemporal())

        signalled = await reconcile_board(BOARD_NAME)

        assert signalled == 1
        assert temporal.started == [f"task-{CARD}"]
