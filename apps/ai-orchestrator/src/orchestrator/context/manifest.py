"""The provenance record that ships beside the package.

The plan asks for a reproducible manifest naming every source's revision and
the reason it was selected. That is not documentation: it is what makes an
attempt auditable after the fact, and it is where a truncation decision becomes
visible instead of silent.

Plain dataclasses with defaults on every added field, for the same reason as
`contracts.py` -- these cross a Temporal activity boundary, so a history written
by an older worker has to keep decoding.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field

# What a `kind` may be. Open on purpose -- a later phase adds repository
# excerpts and architecture decisions -- but named here so a typo in one of the
# builders is visible next to the set it was meant to join.
KIND_POLICY = "policy"
KIND_HANDOFF = "handoff"
KIND_LESSON = "lesson"
KIND_CHECKPOINT = "checkpoint"


@dataclass(frozen=True)
class ManifestItem:
    """One thing the attempt was given, and why."""

    kind: str
    # `path@sha` for a document, a Memini memory id for a lesson, the previous
    # attempt's Job name for a checkpoint.
    ref: str
    revision: str
    reason: str
    bytes: int
    truncated: bool = False
    # The lesson names a source revision that no longer matches the revision
    # this attempt was approved against. It is still included -- the plan says a
    # changed source prompts rechecking, not discarding -- but the attempt is
    # told not to trust it blindly.
    recheck: bool = False
    # Why `recheck` is set, in plain words, so the flag is actionable.
    recheck_reason: str = ""


@dataclass(frozen=True)
class LessonsStatus:
    """How lesson retrieval went.

    `status` is `"ok"` or `"degraded: <reason>"`. Degraded is a normal outcome,
    not an error: the plan is explicit that unavailable optional lessons are
    recorded rather than invented, and never block execution.
    """

    status: str = "ok"
    considered: int = 0
    selected: int = 0
    # Selected, then dropped again to fit the budget.
    dropped_for_budget: int = 0
    namespace: str = ""


@dataclass(frozen=True)
class ResumeInfo:
    """Where a repair picks up from.

    `previous_attempt` is the prior attempt's Job name, which is also the
    directory it checkpointed into on the shared workspace volume. Empty on a
    first attempt, and the worker reads that as "start at step 1".
    """

    previous_attempt: str = ""
    checkpoint_path: str = ""
    # Set by the *worker* in its own checkpoint, not here: the orchestrator
    # cannot see whether the prior checkpoint parsed. Kept in the model so the
    # shape is one thing rather than two.
    status: str = ""


@dataclass(frozen=True)
class Manifest:
    attempt: str
    attempt_number: int
    task_id: str
    board_id: str
    repository: str
    handoff_hash: str
    spec_revision: str
    design_revision: str
    base_commit: str
    job_image: str
    built_at: str
    lessons: LessonsStatus = field(default_factory=LessonsStatus)
    resume: ResumeInfo = field(default_factory=ResumeInfo)
    items: list[ManifestItem] = field(default_factory=list)

    def as_dict(self) -> dict:
        return asdict(self)


@dataclass(frozen=True)
class ContextPackage:
    """The bytes an attempt gets, keyed by their filename under `/context`.

    **Deliberately flat.** This is the one type here that crosses a Temporal
    activity boundary, and a nested dataclass does not survive the trip: the
    pydantic converter resolves a field annotation against its class's module
    namespace, and inside the workflow sandbox that lookup fails, so a package
    carrying a `Manifest` field decodes as "TypeAdapter is not fully defined"
    and wedges the workflow task. The models above stay structured, are
    serialized into `files["manifest.json"]` by the assembler, and never travel
    as objects.

    Nothing is lost by that: the manifest's only consumers are the ConfigMap and
    whoever reads it afterwards, both of which want the JSON. The few scalars
    the workflow and the logs actually use are lifted out here instead.
    """

    files: dict[str, str] = field(default_factory=dict)
    total_bytes: int = 0
    # Lifted from the manifest so a caller can log or assert on them without
    # reparsing the JSON it just built.
    lessons_status: str = ""
    lessons_selected: int = 0
    resumed_from: str = ""
