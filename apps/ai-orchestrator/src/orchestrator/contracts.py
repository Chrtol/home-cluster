"""Typed payloads crossing a Temporal or HTTP boundary.

Everything here is a plain dataclass, not a pydantic model: Temporal's default
JSON converter encodes dataclasses natively and decodes them from the type hints
on the activity/workflow signature, so a dataclass survives replay of a history
written by an older process as long as new fields carry defaults. Pydantic is
used only at the untrusted-input edge (see `board.handoff`), and its output is
converted to these before it is handed to Temporal.

Adding a field here is safe. Removing or renaming one breaks replay of every
in-flight history that carries it.

**These types require the pydantic data converter**, which every `Client.connect`
in this application passes. Temporal's *default* converter silently corrupts a
`class X(str, Enum)` field: it encodes correctly as `"Ready for local"` and then
decodes to `['R', 'e', 'a', 'd', 'y', ...]`, because its `value_to_type` asks
"is this a sequence?" before "is this an enum" and `str` is a sequence. A plain
`Enum` fails loudly instead ("not JSON serializable"). Only the pydantic
converter round-trips either one, so dropping it re-introduces a corruption that
no type checker will catch.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from enum import Enum


class Stage(str, Enum):
    """Pipeline column from plan §4.

    Resolved from the *name* of the kan list, never its publicId: every project
    gets its own board, so publicIds differ per board while the names are the
    contract. `UNKNOWN` covers any list a project board adds for its own use.
    """

    SPEC = "Spec"
    DESIGN = "Design"
    DESIGN_REVIEW = "Design review"
    READY = "Ready for local"
    RUNNING = "Running"
    REVIEW = "Review"
    DONE = "Done"
    BLOCKED = "Blocked"
    UNKNOWN = "Unknown"

    @classmethod
    def from_list_name(cls, name: str | None) -> "Stage":
        if not name:
            return cls.UNKNOWN
        folded = name.strip().casefold()
        for stage in cls:
            if stage is not cls.UNKNOWN and stage.value.casefold() == folded:
                return stage
        return cls.UNKNOWN


class EventKind(str, Enum):
    """The four events kan actually emits. There are no others."""

    CREATED = "card.created"
    UPDATED = "card.updated"
    MOVED = "card.moved"
    DELETED = "card.deleted"


@dataclass(frozen=True)
class BoardActor:
    """A human identity as the *board* reported it.

    Plan §8 requires the approval actor come from verified board identity rather
    than free text. kan populates this from its own session, so it cannot be set
    by anything a card contains.
    """

    id: str
    name: str | None = None
    # Where the identity came from. A webhook delivery carries kan's user *id*;
    # the activity feed the reconciler reads carries only name and email, so a
    # reconciled approval is attributed by email and says so rather than
    # pretending to the same provenance.
    source: str = "webhook"


@dataclass(frozen=True)
class BoardEvent:
    """A kan webhook delivery, normalized and already signature-verified.

    `event_key` is synthesized, not received: kan's payload carries no event ID
    and no delivery counter. A redelivery of the same event reproduces the same
    key because kan stamps `timestamp` once when it builds the payload, so the
    key is stable per logical event and distinct between two genuine events on
    the same card.
    """

    event_key: str
    kind: EventKind
    timestamp: str
    board_id: str
    # The board's *name*, which is what trusted config keys on. kan puts it in
    # every card event, so the read path never has to resolve an opaque id.
    board_name: str
    card_id: str
    title: str
    list_id: str
    stage: Stage
    actor: BoardActor | None = None
    description: str | None = None
    # Present on card.moved / card.updated. Values are stringified: kan sends
    # arbitrary JSON here and the workflow only ever compares them.
    changed_fields: list[str] = field(default_factory=list)
    moved_from_list_id: str | None = None

    @staticmethod
    def make_key(kind: str, timestamp: str, board_id: str, card_id: str) -> str:
        digest = hashlib.sha256(f"{kind}|{timestamp}|{board_id}|{card_id}".encode())
        return digest.hexdigest()[:16]


@dataclass(frozen=True)
class Handoff:
    """The plan §4 design handoff, parsed out of the card description.

    Untrusted: every field originates in board text a human or a model wrote.
    `acceptance_checks` are check *IDs* resolved against trusted project config,
    never shell commands, and `repository` is matched against the allowlist
    before it is used for anything.
    """

    task_id: str
    spec_revision: str
    design_revision: str
    repository: str
    base_commit: str
    goal: str
    scope: list[str] = field(default_factory=list)
    out_of_scope: list[str] = field(default_factory=list)
    allowed_paths: list[str] = field(default_factory=list)
    interfaces: list[str] = field(default_factory=list)
    dependencies: list[str] = field(default_factory=list)
    acceptance_checks: list[str] = field(default_factory=list)
    open_questions: list[str] = field(default_factory=list)

    def content_hash(self) -> str:
        """Stable digest of everything approval binds to.

        Covers every field, because plan §4 returns a changed contract *or
        scope* to design review — so any edit to the handoff invalidates
        approval. Only ordering is normalized, so a list reordered by an editor
        does not read as a material change.
        """
        parts = [
            self.task_id,
            self.spec_revision,
            self.design_revision,
            self.repository,
            self.base_commit,
            self.goal,
            "\x1f".join(sorted(self.scope)),
            "\x1f".join(sorted(self.out_of_scope)),
            "\x1f".join(sorted(self.allowed_paths)),
            "\x1f".join(sorted(self.interfaces)),
            "\x1f".join(sorted(self.dependencies)),
            "\x1f".join(sorted(self.acceptance_checks)),
            "\x1f".join(sorted(self.open_questions)),
        ]
        return hashlib.sha256("\x1e".join(parts).encode()).hexdigest()[:16]


@dataclass(frozen=True)
class CardSnapshot:
    """A fresh read of a card, as the workflow sees it.

    `handoff_error` carries a parse or allowlist failure as *data* rather than
    an exception: an unparsable card is a normal board state that should move
    the card to Blocked with an explanation, not an activity failure that
    Temporal retries forever.
    """

    card_id: str
    board_id: str
    board_name: str
    stage: Stage
    title: str
    handoff: Handoff | None = None
    handoff_hash: str = ""
    handoff_error: str = ""


@dataclass(frozen=True)
class Approval:
    """Binds a human's move-to-Ready to one exact handoff revision.

    `handoff_hash` is what makes an approval go stale: it is compared again
    immediately before dispatch, so an edit landing in the gap between approval
    and a free execution slot cannot ride the old approval into a Job.
    """

    actor: BoardActor
    handoff_hash: str
    design_revision: str
    base_commit: str
    repository: str
    recorded_at: str
    event_key: str


@dataclass(frozen=True)
class AttemptRef:
    """Immutable identity of one execution attempt.

    Separate from the Temporal run ID on purpose (plan §8): Continue-As-New
    mints a new run ID, and if Job names were derived from it the same attempt
    would be created twice under two names.
    """

    task_id: str
    board_id: str
    handoff_hash: str
    attempt_number: int

    @property
    def slug(self) -> str:
        """Bounded, DNS-safe stem shared by the Job and its workspace PVC."""
        digest = hashlib.sha256(f"{self.board_id}:{self.task_id}:{self.handoff_hash}".encode())
        return digest.hexdigest()[:10]

    @property
    def job_name(self) -> str:
        return f"ai-{self.slug}-a{self.attempt_number}"

    @property
    def workspace_name(self) -> str:
        """One workspace per task, reused across attempts of the same handoff.

        Attempts are repairs of the same approved scope, so they share a tree;
        a new handoff hash yields a new slug and therefore a fresh workspace.
        """
        return f"ws-{self.slug}"

    @property
    def context_name(self) -> str:
        """The attempt's context ConfigMap. Per *attempt*, unlike the workspace.

        A repair is assembled fresh -- it carries a different prior checkpoint
        and may select different lessons -- so the package cannot be shared the
        way the workspace tree is.
        """
        return f"ctx-{self.slug}-a{self.attempt_number}"


class AttemptOutcome(str, Enum):
    """How one attempt ended, from the orchestrator's point of view.

    `INTERRUPTED` and `ABANDONED` are deliberately distinct even though both
    mean "no verdict". Interrupted is a stop the orchestrator *asked for*, so
    the approval survives and the work resumes on the next shift. Abandoned is
    an attempt whose outcome nobody ever read -- the approval is consumed and a
    human has to look, because resuming would re-run work that may already have
    failed. See PHASE_2_Board_Lifecycle.md §6.7.
    """

    SUCCEEDED = "succeeded"
    FAILED = "failed"
    INTERRUPTED = "interrupted"
    ABANDONED = "abandoned"
    TIMED_OUT = "timed_out"


@dataclass(frozen=True)
class AttemptResult:
    outcome: AttemptOutcome
    job_name: str
    reason: str = ""
    checkpoints: int = 0
    exit_code: int | None = None


@dataclass(frozen=True)
class JobState:
    """What a single observation of a Kubernetes Job saw."""

    name: str
    exists: bool
    active: int = 0
    succeeded: int = 0
    failed: int = 0
    # True only when no pod of this Job can still be writing. A Job that is
    # merely "failed" is not enough: plan §8 forbids a replacement writer until
    # the previous one is confirmed stopped.
    terminated: bool = False
    pod_phases: list[str] = field(default_factory=list)
    exit_code: int | None = None


@dataclass(frozen=True)
class ShiftLease:
    """A manually authorized desktop GPU window (plan §9).

    Phase 2 only needs the dispatcher to *honour* a lease; Phase 3 builds the
    PowerShell launcher that creates one. `hard_end` is the authorized end time
    and a heartbeat can never push past it.
    """

    shift_id: str
    actor: str
    started_at: str
    hard_end: str
    heartbeat_at: str


@dataclass(frozen=True)
class TaskTicket:
    """What a TaskWorkflow hands the dispatcher when it wants a slot."""

    task_id: str
    board_id: str
    handoff_hash: str
    repository: str
    workflow_id: str
    enqueued_at: str


@dataclass(frozen=True)
class SlotGrant:
    """Dispatcher's reply, signalled back to the task's own workflow."""

    task_id: str
    handoff_hash: str
    attempt_number: int
    shift_id: str
    granted_at: str


@dataclass(frozen=True)
class SlotRelease:
    """Task telling the dispatcher its attempt is over.

    `fenced` is the load-bearing field. The dispatcher will not hand the slot to
    another task while it is False, because an unfenced attempt may still have a
    pod writing to the workspace.
    """

    task_id: str
    handoff_hash: str
    attempt_number: int
    fenced: bool
    outcome: str
