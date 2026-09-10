# Replay corpus

Recorded Temporal histories, replayed by `tests/test_replay.py` against the
current workflow code.

## Why this exists

Temporal replays a workflow's whole history on every workflow task. If a code
change makes the workflow issue a *different sequence of commands* for the same
recorded events, replay fails with `NonDeterministicError` and the workflow is
wedged: queries stop answering, no signal is processed, and restarting the
worker does not help. The only exits are terminating the workflow or shipping
code that replays the old history again.

The rest of this suite cannot see that coming. Every other test starts from an
empty history, so it exercises the *outcome* of the state machine, not the
sequence. Measured, 2026-09-10: swapping `ensure_workspace` and the move to
`Running` in `TaskWorkflow._execute` — behaviourally invisible — leaves **all 81
other tests green** and fails three of the fixtures here in half a second.

## The two directories

| Directory | Assertion | Meaning of a failure |
| --- | --- | --- |
| `./*.json` | must replay clean | your change will wedge every card in flight |
| `./nondeterministic/*.json` | must raise `NondeterminismError` | the guard has stopped detecting anything |

The second is not a test of the application. It is the mutation check on the
guard itself (§6.5's bar): a replay test whose corpus quietly emptied, or whose
converter stopped decoding, passes just as happily as one that is working.

## Regenerating

```
python scripts/generate_histories.py
```

Rewrites every file in this directory (not `nondeterministic/`) by driving the
scenarios through a real Temporal test server.

**Regenerating is not how you fix a failing replay test.** It silences the
alarm and leaves the board wedged. When `test_history_still_replays` fails,
either keep the command sequence compatible — add new branches behind
`workflow.patched()`, append rather than reorder — or accept the break
knowingly: drain the board first (no card in Ready, Running or queued on the
dispatcher), then regenerate and say so in the commit message.

## `nondeterministic/`

Captured from the cluster, not generated, which is what makes it worth keeping:
it cannot be re-derived from today's code.

`task-4zomih22b1w3-2026-09-09T18-01Z.json` — the Phase 2 smoke-test card, run
before the §7c fix. That fix put a `withdraw` signal where the sequence
previously went straight to an Activity, so replaying it now meets an
`ActivityTaskScheduled` where the code offers a signal. This is the incident
in `ai-activity/ai_workflow_optimization/PHASE_2_Board_Lifecycle.md` §7d, as a
file.

It contains board ids, a card description and the operator's name and email, as
kan recorded them. No credentials, no hostnames; the email is already the author
of every commit in this repository, so it is not published here for the first
time.

It is left verbatim because it is evidence. A hand-edited capture invites the
question of what else was changed, which is the one property this file is
supposed to have. If it ever needs to carry no real data, recapture the same
divergence from a board seeded with placeholders rather than editing this one.

To capture another, see `scripts/capture-history.sh`.
