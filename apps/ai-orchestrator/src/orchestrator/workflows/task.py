"""TaskWorkflow — one kan card's lifecycle through the plan §4 columns.

Deterministic by construction: no clocks except `workflow.now()`, no I/O, no
randomness. Every external effect is an Activity.

Three invariants carry the Phase 2 gate:

1. **Duplicate events change nothing.** `board_event` drops any event whose key
   it has already seen, before touching state. The key set survives
   Continue-As-New, so the guarantee is not reset by a history roll.
2. **A stale approval cannot dispatch.** Approval records the handoff hash it
   was granted against. The hash is read again *after* the execution slot is
   granted, so an edit that lands while the task sits in the queue is caught at
   the last possible moment rather than at approval time.
3. **The slot is released only after fencing.** The release signal carries
   `fenced`, and the workflow will not set it True until an Activity has
   confirmed no pod of the attempt can still be writing.
"""

from __future__ import annotations

import asyncio
from collections import deque
from contextlib import suppress
from dataclasses import dataclass, field
from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    from ..activities import board as board_acts
    from ..activities import kubernetes as k8s_acts
    from ..contracts import (
        Approval,
        AttemptOutcome,
        AttemptRef,
        AttemptResult,
        BoardEvent,
        CardSnapshot,
        EventKind,
        SlotGrant,
        SlotRelease,
        Stage,
        TaskTicket,
    )

# How many event keys to remember. Bounded so a long-lived card cannot grow its
# history without limit; far larger than any plausible burst or redelivery window.
SEEN_LIMIT = 256

_SHORT = dict(
    start_to_close_timeout=timedelta(seconds=30),
    retry_policy=RetryPolicy(maximum_attempts=5, maximum_interval=timedelta(seconds=10)),
)
_WRITE = dict(
    start_to_close_timeout=timedelta(seconds=60),
    retry_policy=RetryPolicy(maximum_attempts=8, maximum_interval=timedelta(seconds=30)),
)
# Janitorial work, run after the outcome is already on the card. It gets its own
# short policy because the workflow is *blocked* while an Activity retries: under
# `_WRITE` a Job that cannot be deleted would keep this workflow busy for minutes,
# deaf to every board event, over cleanup nobody is waiting on.
_CLEANUP = dict(
    start_to_close_timeout=timedelta(seconds=30),
    retry_policy=RetryPolicy(maximum_attempts=3, maximum_interval=timedelta(seconds=5)),
)

POLL_INTERVAL = timedelta(seconds=15)
# How often a queued task re-sends its ticket to the dispatcher. `enqueue` is
# deduplicated on (task_id, handoff_hash), so re-sending is free -- and it is
# what makes a *dropped* ticket recoverable. A single fire-and-forget signal is
# not enough: the dispatcher can legitimately reject one (a stale `active` from
# a run that died still matched this task), after which the task would wait for
# a grant that was never going to come.
ENQUEUE_REFRESH = timedelta(minutes=5)

# Patch gate for the §6.7 fix. A history recorded before this shipped has no
# marker for it, so `workflow.patched` answers False on replay and that run
# keeps the behaviour it was written with -- which is the only way to change a
# branch a live workflow may already have taken without wedging it (§7d, §7e).
# Safe to retire with `workflow.deprecate_patch` once no TaskWorkflow started
# before the deploy is still running.
PATCH_VANISHED_JOB = "vanished-job-is-not-resumable"

# Patch gate for plan §12's other half, retaining evidence. This one adds a
# command *after* a point live workflows have already run through -- an attempt
# that finished last week reached `_finish` and issued nothing more -- so
# replaying it against unpatched code must still issue nothing. Same retirement
# rule as above.
PATCH_DELETE_JOB_AFTER_FINISH = "delete-job-after-finish"


@dataclass
class TaskState:
    """Everything carried across Continue-As-New.

    Anything not listed here is lost when the history rolls, so the dedup keys
    and the approval both live in this struct rather than in loose attributes.
    """

    card_id: str
    board_id: str = ""
    board_name: str = ""
    seen: list[str] = field(default_factory=list)
    stage: str = Stage.UNKNOWN.value
    approval: Approval | None = None
    attempt_number: int = 0
    active_job: str = ""
    published: list[str] = field(default_factory=list)
    events_handled: int = 0
    last_outcome: str = ""
    # Did any observation of the current attempt's Job see it present? It
    # separates "deleted while running" from "finished, then collected before
    # anyone read the verdict", which is the difference the human reading the
    # card needs. Reset per attempt, not per workflow.
    job_seen_alive: bool = False


@workflow.defn
class TaskWorkflow:
    @workflow.init
    def __init__(self, state: TaskState) -> None:
        """Adopt the run argument before any signal handler runs.

        The webhook starts this workflow with `start_signal="board_event"`, so
        the very first event is delivered *before* the run method executes. If
        `run` assigned `self._state` itself, that first event's dedup key would
        be written to a state object that is then thrown away — and a
        redelivery of the card's first event would be treated as new.
        """
        self._state = state
        self._pending: deque[BoardEvent] = deque()
        self._slot: SlotGrant | None = None
        self._revoked = False
        self._stop_requested = False
        self._busy = False

    # ------------------------------------------------------------------ signals

    @workflow.signal
    def board_event(self, event: BoardEvent) -> None:
        """Accept a normalized board event, exactly once.

        The dedup check happens here, before any state changes, so a duplicate
        delivery is indistinguishable from no delivery at all. kan never retries
        on its own, but the reconciliation sweep re-reads the board and can
        legitimately re-raise an event the webhook already delivered.
        """
        if event.event_key in self._state.seen:
            workflow.logger.info("duplicate event %s ignored", event.event_key)
            return

        self._state.seen.append(event.event_key)
        if len(self._state.seen) > SEEN_LIMIT:
            del self._state.seen[:-SEEN_LIMIT]

        self._pending.append(event)

    @workflow.signal
    def slot_granted(self, grant: SlotGrant) -> None:
        self._slot = grant

    @workflow.signal
    def stop(self, reason: str = "operator") -> None:
        """Stop the current attempt without abandoning the card."""
        self._stop_requested = True
        workflow.logger.info("stop requested: %s", reason)

    # ------------------------------------------------------------------ queries

    @workflow.query
    def status(self) -> dict[str, object]:
        return {
            "card_id": self._state.card_id,
            "board": self._state.board_name,
            "stage": self._state.stage,
            "approved": self._state.approval is not None,
            "approved_hash": self._state.approval.handoff_hash if self._state.approval else "",
            # Exposed because it is the only field that distinguishes a webhook
            # approval (kan user id) from a reconciler sweep (activity-feed
            # email). Diagnosing §7c live required reading logs for want of this.
            "approved_actor": self._state.approval.actor.id if self._state.approval else "",
            "attempt": self._state.attempt_number,
            "active_job": self._state.active_job,
            "events_handled": self._state.events_handled,
            "last_outcome": self._state.last_outcome,
            "queued_events": len(self._pending),
        }

    # --------------------------------------------------------------------- run

    @workflow.run
    async def run(self, state: TaskState) -> TaskState:
        # `state` is already installed by `__init__`; see the note there.
        while True:
            await workflow.wait_condition(
                lambda: bool(self._pending)
                or (self._state.approval is not None and not self._busy)
                or self._stop_requested
            )

            await self._drain()

            # `_stop_requested` exists for an in-flight attempt to observe, and
            # is cleared when that attempt reports INTERRUPTED. With nothing
            # running there is no attempt to consume it -- and because the wait
            # condition above ors it in, leaving it set makes that condition
            # return immediately forever. The loop then spins without yielding,
            # trips Temporal's 2s deadlock detector, and wedges the workflow so
            # hard it cannot even be queried. Reached by the most ordinary
            # operator action there is: dragging a card out of Ready.
            if self._stop_requested and not self._busy:
                self._stop_requested = False

            if self._state.approval is not None and not self._busy:
                await self._attempt()

            # Roll the history only when nothing is in flight, so no attempt is
            # orphaned mid-observation. Pending events are drained first, above,
            # and the dedup set is carried, so nothing is replayed twice.
            limit = workflow.info().get_current_history_length()
            if self._state.events_handled >= 200 or limit > 8000:
                if not self._pending and not self._busy:
                    workflow.continue_as_new(self._state)

    # ---------------------------------------------------------------- internals

    async def _drain(self) -> None:
        """Apply every queued board event.

        Called from the main loop and from inside an attempt, because an event
        that revokes approval is only useful if it can be applied while the task
        is busy waiting.
        """
        while self._pending:
            await self._apply(self._pending.popleft())

    async def _wait_draining(self, ready) -> None:
        """Block until `ready()`, applying board events that arrive meanwhile."""
        while not ready():
            await workflow.wait_condition(lambda: ready() or bool(self._pending))
            await self._drain()

    async def _apply(self, event: BoardEvent) -> None:
        """Fold one board event into task state."""
        self._state.events_handled += 1
        self._state.card_id = event.card_id
        self._state.board_id = event.board_id or self._state.board_id
        self._state.board_name = event.board_name or self._state.board_name
        previous = self._state.stage
        self._state.stage = event.stage.value

        if event.kind is EventKind.DELETED:
            self._stop_requested = True
            self._revoked = True
            self._state.approval = None
            return

        # A description edit is a material change to the approved contract
        # (plan §4), so it revokes approval wherever the card currently sits.
        if "description" in event.changed_fields and self._state.approval is not None:
            workflow.logger.info("approval revoked: description changed")
            self._state.approval = None
            self._revoked = True
            await self._comment(
                f"revoked-{event.event_key}",
                "Approval revoked: the handoff changed after it was approved. "
                "Re-approve from Design review.",
            )
            await self._move(Stage.DESIGN_REVIEW)
            return

        if event.kind is EventKind.MOVED:
            await self._on_moved(event, previous)

    async def _on_moved(self, event: BoardEvent, previous: str) -> None:
        if event.stage is Stage.READY:
            await self._record_approval(event)
            return

        # Moving the card out of the execution lane cancels the attempt. The
        # orchestrator itself only ever writes Running / Review / Blocked /
        # Design review, and never writes Ready for local — which is why an
        # arrival in Ready is always a human act and this state machine cannot
        # drive itself in a loop.
        if previous in (Stage.READY.value, Stage.RUNNING.value) and event.stage not in (
            Stage.READY,
            Stage.RUNNING,
        ):
            if self._state.approval is not None or self._busy:
                workflow.logger.info("attempt cancelled: card moved to %s", event.stage.value)
            self._state.approval = None
            self._revoked = True
            self._stop_requested = True

    async def _record_approval(self, event: BoardEvent) -> None:
        """Turn a move into 'Ready for local' into a bound approval.

        The actor comes from `event.actor`, which kan populates from its own
        session. Plan §8 forbids taking it from card text, and nothing on the
        card can influence it.
        """
        if event.actor is None:
            await self._comment(
                f"noactor-{event.event_key}",
                "Ignored: the move carried no board identity, so no approval actor "
                "could be recorded.",
            )
            return

        snapshot = await self._fetch()
        if snapshot.handoff is None:
            await self._comment(
                f"badhandoff-{event.event_key}",
                f"Cannot dispatch: {snapshot.handoff_error}",
            )
            await self._move(Stage.BLOCKED)
            return

        held = self._state.approval
        if held is not None and held.handoff_hash == snapshot.handoff_hash:
            # A reconciler sweep, or a redelivery, of a card already approved on
            # exactly this handoff. Re-recording would overwrite `actor`: the
            # sweep's activity-feed email would replace the webhook's verified kan
            # user id, degrading the audit trail on a five-minute timer.
            workflow.logger.info("approval already held for hash=%s", snapshot.handoff_hash)
            return

        if held is not None:
            # The handoff moved underneath a held approval. The `changed_fields`
            # guard cannot see this: the reconciler synthesizes `["listId"]` for
            # every card it finds in Ready, so only comparing content catches an
            # edit whose `card.updated` webhook was lost -- and kan never retries.
            # Without this the sweep launders an unapproved revision into an
            # approval. See PHASE_2_Board_Lifecycle.md §7c.
            workflow.logger.info(
                "approval revoked: handoff changed under a held approval %s -> %s",
                held.handoff_hash,
                snapshot.handoff_hash,
            )
            self._state.approval = None
            self._revoked = True
            await self._comment(
                f"revoked-{event.event_key}",
                "Approval revoked: the handoff changed after it was approved. "
                "Re-approve from Design review.",
            )
            await self._move(Stage.DESIGN_REVIEW)
            return

        self._state.approval = Approval(
            actor=event.actor,
            handoff_hash=snapshot.handoff_hash,
            design_revision=snapshot.handoff.design_revision,
            base_commit=snapshot.handoff.base_commit,
            repository=snapshot.handoff.repository,
            recorded_at=workflow.now().isoformat(timespec="seconds"),
            event_key=event.event_key,
        )
        self._revoked = False
        self._stop_requested = False
        workflow.logger.info(
            "approval recorded actor=%s hash=%s", event.actor.id, snapshot.handoff_hash
        )

    async def _attempt(self) -> None:
        """Queue for a slot, verify approval is still current, then run."""
        approval = self._state.approval
        assert approval is not None
        self._busy = True
        try:
            ticket = TaskTicket(
                task_id=self._state.card_id,
                board_id=self._state.board_id,
                handoff_hash=approval.handoff_hash,
                repository=approval.repository,
                workflow_id=workflow.info().workflow_id,
                enqueued_at=workflow.now().isoformat(timespec="seconds"),
            )
            dispatcher = workflow.get_external_workflow_handle(_dispatcher_id())

            # Keep folding in board events while queued. The wait for a desktop
            # shift can be hours, and it is the window in which a design is most
            # likely to change — so the loop that waits for a slot must also be
            # the loop that notices the approval being revoked.
            #
            # It re-sends the ticket on every pass rather than trusting one
            # signal, so a ticket the dispatcher dropped is recovered instead of
            # deadlocking this task against an empty queue.
            def _settled() -> bool:
                return self._slot is not None or self._revoked or self._stop_requested

            while not _settled():
                await dispatcher.signal("enqueue", ticket)
                with suppress(asyncio.TimeoutError):
                    await workflow.wait_condition(
                        lambda: _settled() or bool(self._pending), timeout=ENQUEUE_REFRESH
                    )
                await self._drain()

            grant = self._slot
            self._slot = None
            if grant is None:
                # Cancelled before a slot arrived. The ticket is still queued on
                # the dispatcher, and if it is granted later nobody would ever
                # release it, so the queue entry has to be withdrawn.
                await dispatcher.signal("withdraw", ticket)
                return

            if self._revoked or self._stop_requested:
                # The grant and the revocation raced. Hand the slot straight
                # back rather than running work whose approval is gone; nothing
                # started, so there is nothing to fence.
                await self._release(approval, grant, fenced=True, outcome="revoked")
                return

            if await self._is_stale(approval):
                await self._release(approval, grant, fenced=True, outcome="stale")
                return

            try:
                result = await self._execute(approval, grant)
            except Exception as exc:  # noqa: BLE001
                # An Activity that exhausted its retries is an *infrastructure*
                # failure, not a task failure. Letting it propagate would fail
                # this workflow, and a failed workflow can never send `release`
                # -- so the desktop slot would be held by a dead holder forever.
                # Observed for real: a misplaced RBAC Role made ensure_workspace
                # 403 eight times and stranded the slot.
                #
                # Approval is deliberately kept, so the task retries on the next
                # shift rather than needing a human to re-approve infrastructure.
                workflow.logger.warning("attempt aborted, infrastructure error: %s", exc)
                await self._release(
                    approval, grant, fenced=await self._can_fence(), outcome="infrastructure"
                )
                await self._comment(
                    f"infra-{grant.attempt_number}-{approval.handoff_hash}",
                    f"Attempt {grant.attempt_number} could not start: {exc}. "
                    f"The approval still stands; it will retry on the next shift.",
                )
                return

            self._state.last_outcome = result.outcome.value

            # Fence before releasing. `confirm_terminated` returns False while a
            # pod is Unknown, so a partitioned node holds the slot rather than
            # letting a second writer at the workspace.
            fenced = await workflow.execute_activity(
                k8s_acts.confirm_terminated, result.job_name, **_SHORT
            )
            while not fenced:
                await workflow.sleep(POLL_INTERVAL)
                fenced = await workflow.execute_activity(
                    k8s_acts.confirm_terminated, result.job_name, **_SHORT
                )

            await self._release(approval, grant, fenced=True, outcome=result.outcome.value)
            await self._finish(result)
            # Strictly after `_finish`: the Job *is* the evidence, so it may not
            # be collected until the outcome it proves is on the card.
            await self._collect_job(result)
        finally:
            self._busy = False
            self._state.active_job = ""

    async def _can_fence(self) -> bool:
        """Is it safe to hand the slot back after an aborted attempt?

        If no Job was ever created there is nothing that could still be writing,
        so the slot is safe to release. Once a Job exists the question has to be
        asked properly, and a failure to ask is answered `False` -- holding the
        slot is the safe direction.
        """
        if not self._state.active_job:
            return True
        try:
            return await workflow.execute_activity(
                k8s_acts.confirm_terminated, self._state.active_job, **_SHORT
            )
        except Exception:  # noqa: BLE001
            return False

    async def _is_stale(self, approval: Approval) -> bool:
        """Re-read the card and compare against what was approved.

        This runs after the slot is granted, not before it is requested: the
        wait for a desktop shift can be hours, and the whole point is to catch
        an edit made during that wait.
        """
        snapshot = await self._fetch()
        if snapshot.handoff is not None and snapshot.handoff_hash == approval.handoff_hash:
            return False

        detail = snapshot.handoff_error or (
            f"handoff is now {snapshot.handoff_hash!r}, approved {approval.handoff_hash!r}"
        )
        workflow.logger.info("stale approval, not dispatching: %s", detail)
        self._state.approval = None
        await self._comment(
            f"stale-{approval.event_key}",
            f"Not dispatched: the approved handoff changed before an execution slot "
            f"was available ({detail}). Re-approve from Design review.",
        )
        await self._move(Stage.DESIGN_REVIEW)
        return True

    async def _execute(self, approval: Approval, grant: SlotGrant) -> AttemptResult:
        attempt = AttemptRef(
            task_id=self._state.card_id,
            board_id=self._state.board_id,
            handoff_hash=approval.handoff_hash,
            attempt_number=grant.attempt_number,
        )
        self._state.attempt_number = grant.attempt_number

        await workflow.execute_activity(k8s_acts.ensure_workspace, attempt, **_WRITE)
        await self._move(Stage.RUNNING)

        request = k8s_acts.EnsureJobRequest(
            attempt=attempt,
            image=_job_image(),
            base_commit=approval.base_commit,
            repository=approval.repository,
        )
        # Idempotent by name: a worker that dies between creating the Job and
        # recording it recreates the same name on replay and adopts it.
        job_name = await workflow.execute_activity(k8s_acts.ensure_job, request, **_WRITE)
        self._state.active_job = job_name
        self._state.job_seen_alive = False

        while True:
            state = await workflow.execute_activity(k8s_acts.observe_job, job_name, **_SHORT)
            if state.exists:
                self._state.job_seen_alive = True

            if self._revoked or self._stop_requested:
                await workflow.execute_activity(k8s_acts.stop_job, job_name, **_WRITE)
                return AttemptResult(
                    outcome=AttemptOutcome.INTERRUPTED, job_name=job_name, reason="cancelled"
                )
            if state.succeeded:
                return AttemptResult(
                    outcome=AttemptOutcome.SUCCEEDED, job_name=job_name, exit_code=0
                )
            if state.failed:
                return AttemptResult(
                    outcome=AttemptOutcome.FAILED,
                    job_name=job_name,
                    reason="job reported failure",
                    exit_code=state.exit_code,
                )
            if not state.exists:
                # The Job is gone and no terminal state was ever read from it.
                # That is *not* an interruption: `kube-cleanup-operator` runs
                # cluster-wide with `--delete-failed-after=60m`, so an attempt
                # that failed during an orchestrator outage longer than the
                # window is collected before anyone observes the failure, and
                # looks from here exactly like a Job that vanished mid-flight.
                #
                # Treating it as INTERRUPTED keeps the approval and silently
                # re-runs the attempt, so a failure is never reported and the
                # card never reaches Blocked. The outcome is genuinely unknown
                # and unknowable after collection, so it goes to a human rather
                # than being guessed. PHASE_2_Board_Lifecycle.md §6.7.
                if workflow.patched(PATCH_VANISHED_JOB):
                    return AttemptResult(
                        outcome=AttemptOutcome.ABANDONED,
                        job_name=job_name,
                        reason=(
                            "the Job was last seen running and then disappeared"
                            if self._state.job_seen_alive
                            else "the Job disappeared before any observation saw it"
                        ),
                    )
                return AttemptResult(
                    outcome=AttemptOutcome.INTERRUPTED,
                    job_name=job_name,
                    reason="job disappeared",
                )

            # Poll, but wake immediately if a signal arrives. Plan §7: workflow
            # polling must pause between observations, never spin.
            #
            # `wait_condition` with a timeout *raises* on expiry rather than
            # returning False, and here expiry is the normal case — it just
            # means "no signal, go observe again" — so the timeout is suppressed
            # rather than allowed to propagate and fail the workflow.
            with suppress(asyncio.TimeoutError):
                await workflow.wait_condition(
                    lambda: self._revoked or self._stop_requested or bool(self._pending),
                    timeout=POLL_INTERVAL,
                )
            # A design change arriving mid-attempt must be able to stop it
            # (plan §12), so events are applied here too, not only in `run`.
            await self._drain()

    async def _release(
        self, approval: Approval, grant: SlotGrant, *, fenced: bool, outcome: str
    ) -> None:
        release = SlotRelease(
            task_id=self._state.card_id,
            handoff_hash=approval.handoff_hash,
            attempt_number=grant.attempt_number,
            fenced=fenced,
            outcome=outcome,
        )
        dispatcher = workflow.get_external_workflow_handle(_dispatcher_id())
        await dispatcher.signal("release", release)

    async def _finish(self, result: AttemptResult) -> None:
        if result.outcome is AttemptOutcome.SUCCEEDED:
            await self._comment(
                f"done-{result.job_name}",
                f"Attempt {result.job_name} completed. Evidence is on the workspace volume; "
                f"review the diff and test output before accepting.",
            )
            await self._move(Stage.REVIEW)
            self._state.approval = None
            return

        if result.outcome is AttemptOutcome.INTERRUPTED:
            # Plan §4: interrupted work stays queued with a checkpoint, it is
            # not an error. Approval is kept so it resumes on the next shift.
            await self._comment(
                f"interrupted-{result.job_name}",
                f"Attempt {result.job_name} was interrupted ({result.reason}). "
                f"The workspace is preserved; it will resume on the next shift.",
            )
            self._stop_requested = False
            self._revoked = False
            return

        if result.outcome is AttemptOutcome.ABANDONED:
            # Same destination as a failure, different words: nobody knows
            # whether this attempt failed, and saying "failed" would assert
            # something that was never observed.
            await self._comment(
                f"abandoned-{result.job_name}",
                f"Attempt {result.job_name} ended with no recorded outcome "
                f"({result.reason}). Failed Jobs are collected an hour after they "
                f"fail, so an attempt that ended while the orchestrator was down "
                f"leaves nothing left to read. The approval has been consumed "
                f"deliberately: re-running work whose result nobody saw is not "
                f"safe to do silently. Check the workspace volume for evidence, "
                f"then re-approve from Design review to try again.",
            )
            await self._move(Stage.BLOCKED)
            self._state.approval = None
            return

        await self._comment(
            f"failed-{result.job_name}",
            f"Attempt {result.job_name} failed ({result.reason}, exit={result.exit_code}).",
        )
        await self._move(Stage.BLOCKED)
        self._state.approval = None

    async def _collect_job(self, result: AttemptResult) -> None:
        """Delete the attempt's Job, now that `_finish` has recorded its outcome.

        Plan §12 keeps a Job until its evidence has been collected, which is why
        `ensure_job` sets no `ttlSecondsAfterFinished`. Nothing was deleting them
        afterwards, so `kube-cleanup-operator` did it on a 60-minute timer that
        knows nothing about whether anyone read the failure -- the §6.7 fix stops
        that being *misread* as an interruption, it does not stop the evidence
        going. The operator is now told to leave these Jobs alone, so the
        workflow that knows when the evidence has served its purpose owns the
        deletion instead.

        An INTERRUPTED attempt is exempt: it keeps its approval and resumes on
        the next shift, so its Job is not finished evidence.
        """
        if result.outcome is AttemptOutcome.INTERRUPTED:
            return
        if not result.job_name:
            return
        if workflow.patched(PATCH_DELETE_JOB_AFTER_FINISH):
            try:
                await workflow.execute_activity(
                    k8s_acts.delete_job, result.job_name, **_CLEANUP
                )
            except Exception as exc:  # noqa: BLE001
                # Cleanup must not be able to kill the workflow. By this point
                # the outcome is already on the card and the slot is already
                # released, so failing here would orphan the card from every
                # future board event to tidy up a Job -- the same reasoning that
                # puts a catch around `_execute`. An uncollected Job stays
                # visible in `ai-jobs` and harms nothing; the operator no longer
                # collects it either, so it waits for a human.
                workflow.logger.warning(
                    "could not collect job %s: %s", result.job_name, exc
                )

    # ------------------------------------------------------------ small helpers

    async def _fetch(self) -> CardSnapshot:
        return await workflow.execute_activity(board_acts.fetch_card, self._state.card_id, **_SHORT)

    async def _move(self, stage: Stage) -> None:
        await workflow.execute_activity(
            board_acts.move_card,
            board_acts.MoveRequest(
                card_id=self._state.card_id, board_id=self._state.board_id, stage=stage
            ),
            **_WRITE,
        )
        self._state.stage = stage.value

    async def _comment(self, marker: str, text: str) -> None:
        """Post once per marker.

        The marker set is workflow state, so a replay does not re-post; the
        Activity independently scans the card, so a *retry* of the Activity
        after a successful write does not either.
        """
        if marker in self._state.published:
            return
        self._state.published.append(marker)
        await workflow.execute_activity(
            board_acts.publish_comment,
            board_acts.CommentRequest(card_id=self._state.card_id, marker=marker, text=text),
            **_WRITE,
        )


def _dispatcher_id() -> str:
    """Resolved from a workflow memo so the ID is fixed at start time.

    Reading the environment here would be non-deterministic: a replay on a pod
    with a different `DESKTOP_ID` would address a different dispatcher than the
    original run did.
    """
    memo = workflow.memo_value("dispatcher_id", "desktop-dispatcher-primary")
    return str(memo)


def _job_image() -> str:
    return str(workflow.memo_value("job_image", ""))
