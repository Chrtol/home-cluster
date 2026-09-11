"""Build the four files an attempt finds at `/context`.

Pure. Everything that needed a network -- the approved handoff, the selected
lessons -- has already been fetched by the Activity and is passed in, so the
selection and truncation rules below can be tested with literal values.

The layering the plan asks for is what the file split encodes: `policy.md` is
trusted instruction, `handoff.json` is the approved contract, `lessons.json` is
retrieved evidence, `manifest.json` says where each came from. Evidence never
sits in the same file as instruction, so nothing an attempt reads can be
mistaken for something it was told.

The load order is the manifest's item order: policy first, then the approved
handoff, then lessons, then the resume pointer.
"""

from __future__ import annotations

import json

from ..contracts import Approval, AttemptRef, Handoff
from ..memory.memini import Lesson
from .manifest import (
    KIND_CHECKPOINT,
    KIND_HANDOFF,
    KIND_LESSON,
    KIND_POLICY,
    ContextPackage,
    LessonsStatus,
    Manifest,
    ManifestItem,
    ResumeInfo,
)

# A ConfigMap may hold 1 MiB across all its keys. That ceiling is the context
# budget for now, and the headroom below it covers the manifest growing as
# lessons are added plus the object's own metadata -- the API server rejects the
# whole write if the total is over, which would fail an attempt for a reason
# nothing on the board explains.
CONTEXT_BUDGET_BYTES = 900_000

# No single lesson may crowd out the rest. Truncation is recorded per item, so
# an attempt can see it was handed an excerpt rather than the whole thing.
LESSON_MAX_BYTES = 8_000

TRUNCATION_MARKER = "\n\n[truncated by context assembly]"

# Where a resumed attempt finds the prior checkpoint. The worker writes into
# `<workspace>/attempts/<job name>/`, so the previous attempt's Job name is the
# only thing needed to address it.
#
# Relative to the workspace root, not absolute. The orchestrator knows where it
# mounts the volume today; the worker knows where the volume actually is. An
# absolute `/workspace/...` baked in here would be a second copy of that
# decision, and the copy in the immutable ConfigMap is the one that cannot be
# corrected if the mount ever moves.
CHECKPOINT_TEMPLATE = "attempts/{attempt}/checkpoint.json"


def _sized(text: str) -> int:
    return len(text.encode())


def _truncate(text: str, limit: int) -> tuple[str, bool]:
    if _sized(text) <= limit:
        return text, False
    room = limit - _sized(TRUNCATION_MARKER)
    # Cut on the encoded form and decode back leniently, so a multi-byte
    # character straddling the boundary is dropped rather than corrupted.
    clipped = text.encode()[:room].decode(errors="ignore")
    return clipped + TRUNCATION_MARKER, True


def handoff_document(handoff: Handoff) -> str:
    """Serialize the approved handoff.

    Key order is fixed and the field set is exhaustive, so the document an
    attempt reads re-hashes to the approval it was dispatched under. A test
    asserts exactly that; without it, a field quietly dropped here would hand
    the attempt a narrower contract than the one a human approved.
    """
    return json.dumps(
        {
            "task_id": handoff.task_id,
            "spec_revision": handoff.spec_revision,
            "design_revision": handoff.design_revision,
            "repository": handoff.repository,
            "base_commit": handoff.base_commit,
            "goal": handoff.goal,
            "scope": list(handoff.scope),
            "out_of_scope": list(handoff.out_of_scope),
            "allowed_paths": list(handoff.allowed_paths),
            "interfaces": list(handoff.interfaces),
            "dependencies": list(handoff.dependencies),
            "acceptance_checks": list(handoff.acceptance_checks),
            "open_questions": list(handoff.open_questions),
        },
        indent=2,
        sort_keys=True,
    )


def approved_revisions(handoff: Handoff) -> dict[str, str]:
    """Path -> SHA for the documents this task was approved against.

    Used to decide whether a lesson's source has moved on. Both fields are
    shape-validated as `path@40-hex` before a handoff is ever approved, so a
    malformed one cannot reach here -- but `rpartition` is tolerant anyway, and
    an entry that does not split simply never matches.
    """
    revisions: dict[str, str] = {}
    for revision in (handoff.spec_revision, handoff.design_revision):
        path, _, sha = revision.rpartition("@")
        if path and sha:
            revisions[path] = sha
    return revisions


def build(
    *,
    approval: Approval,
    handoff: Handoff,
    attempt: AttemptRef,
    job_image: str,
    policy_text: str,
    lessons: list[Lesson],
    lessons_status: LessonsStatus,
    previous_attempt: str,
    built_at: str,
) -> ContextPackage:
    """Assemble the package, dropping only what the budget forces.

    The handoff, its acceptance checks and the policy are never cut. If those
    alone did not fit there would be nothing safe left to drop, so the package
    is built anyway and the ConfigMap write is what fails -- loudly, as an
    infrastructure error that keeps the approval, rather than by silently
    handing an attempt a contract with pieces missing.

    Fitting is done by composing and measuring rather than by adding up
    estimated sizes as it goes. The obvious arithmetic is wrong: every lesson
    also costs a manifest entry, and the manifest is itself one of the four
    files being budgeted, so a package built to exactly the budget by
    content-size alone comes out over it. Dropping the least relevant lesson and
    recomposing makes the bound exact instead of approximate -- and the loop
    runs at most `LESSON_LIMIT` times, because that is how many lessons there
    can be.
    """
    keep = list(lessons)
    dropped = 0
    while True:
        package = _compose(
            approval=approval,
            handoff=handoff,
            attempt=attempt,
            job_image=job_image,
            policy_text=policy_text,
            lessons=keep,
            lessons_status=lessons_status,
            previous_attempt=previous_attempt,
            built_at=built_at,
            dropped_for_budget=dropped,
        )
        if package.total_bytes <= CONTEXT_BUDGET_BYTES or not keep:
            return package
        # Memini returns results ranked best-first, so the tail is the least
        # relevant thing in the package and the right thing to lose.
        keep.pop()
        dropped += 1


def _compose(
    *,
    approval: Approval,
    handoff: Handoff,
    attempt: AttemptRef,
    job_image: str,
    policy_text: str,
    lessons: list[Lesson],
    lessons_status: LessonsStatus,
    previous_attempt: str,
    built_at: str,
    dropped_for_budget: int,
) -> ContextPackage:
    """Build one candidate package. No budget logic; `build` owns that."""
    items: list[ManifestItem] = []

    policy, policy_truncated = policy_text, False
    items.append(
        ManifestItem(
            kind=KIND_POLICY,
            ref="policy.md",
            # The policy ships in the image, so the image digest *is* its
            # version. Nothing else identifies which text an attempt was given.
            revision=job_image,
            reason="trusted operating policy, versioned by the job image",
            bytes=_sized(policy),
            truncated=policy_truncated,
        )
    )

    handoff_text = handoff_document(handoff)
    items.append(
        ManifestItem(
            kind=KIND_HANDOFF,
            ref=f"{approval.repository}#{attempt.task_id}",
            revision=approval.handoff_hash,
            reason=f"the handoff approved by {approval.actor.id} at {approval.recorded_at}",
            bytes=_sized(handoff_text),
        )
    )

    resume = ResumeInfo()
    if previous_attempt:
        checkpoint_path = CHECKPOINT_TEMPLATE.format(attempt=previous_attempt)
        resume = ResumeInfo(previous_attempt=previous_attempt, checkpoint_path=checkpoint_path)
        items.append(
            ManifestItem(
                kind=KIND_CHECKPOINT,
                ref=f"workspace checkpoint {previous_attempt}",
                revision=approval.handoff_hash,
                reason="prior attempt of this handoff; resume from its completed steps",
                # The checkpoint is read off the shared workspace volume, not
                # copied in here -- it is the previous attempt's own output and
                # putting it in an immutable object would make it a snapshot of
                # a file that is still being written.
                bytes=0,
            )
        )

    # Lessons last: they are the only thing the budget is allowed to take back.
    # Each is clipped on its own so one long memory cannot crowd out the rest;
    # whether the package as a whole fits is `build`'s question, not this one's.
    kept: list[Lesson] = []
    for lesson in lessons:
        content, truncated = _truncate(lesson.content, LESSON_MAX_BYTES)
        kept.append(
            Lesson(
                memory_id=lesson.memory_id,
                content=content,
                namespace=lesson.namespace,
                tier=lesson.tier,
                score=lesson.score,
                source_revision=lesson.source_revision,
                tags=list(lesson.tags),
                recheck=lesson.recheck,
                recheck_reason=lesson.recheck_reason,
            )
        )
        items.append(
            ManifestItem(
                kind=KIND_LESSON,
                ref=lesson.memory_id,
                revision=lesson.source_revision,
                reason=lesson.reason,
                bytes=_sized(content),
                truncated=truncated,
                recheck=lesson.recheck,
                recheck_reason=lesson.recheck_reason,
            )
        )

    lessons_text = json.dumps(
        {
            "lessons": [
                {
                    "id": lesson.memory_id,
                    "content": lesson.content,
                    "source_revision": lesson.source_revision,
                    "tier": lesson.tier,
                    "recheck": lesson.recheck,
                    "recheck_reason": lesson.recheck_reason,
                }
                for lesson in kept
            ],
            # Repeated here and not only in the manifest: an attempt reading
            # lessons.json alone must still be able to tell "no lessons apply"
            # from "retrieval was broken", because those mean opposite things.
            "status": lessons_status.status,
        },
        indent=2,
        sort_keys=True,
    )

    manifest = Manifest(
        attempt=attempt.job_name,
        attempt_number=attempt.attempt_number,
        task_id=attempt.task_id,
        board_id=attempt.board_id,
        repository=approval.repository,
        handoff_hash=approval.handoff_hash,
        spec_revision=handoff.spec_revision,
        design_revision=approval.design_revision,
        base_commit=approval.base_commit,
        job_image=job_image,
        built_at=built_at,
        lessons=LessonsStatus(
            status=lessons_status.status,
            considered=lessons_status.considered,
            selected=len(kept),
            dropped_for_budget=dropped_for_budget,
            namespace=lessons_status.namespace,
        ),
        resume=resume,
        items=items,
    )

    files = {
        "policy.md": policy,
        "handoff.json": handoff_text,
        "lessons.json": lessons_text,
        "manifest.json": json.dumps(manifest.as_dict(), indent=2, sort_keys=True),
    }
    return ContextPackage(
        files=files,
        total_bytes=sum(_sized(v) for v in files.values()),
        lessons_status=manifest.lessons.status,
        lessons_selected=manifest.lessons.selected,
        resumed_from=resume.previous_attempt,
    )
