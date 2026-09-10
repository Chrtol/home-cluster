# STATE — new context: read this file first, others only on demand
_Last updated: YYYY-MM-DD_

**Project:** [one-line description]. [Where full history lives, if archived.]

## Phase
[Current phase; what is CLOSED, what is running.]

## Right now
- [Active work item + status]
- [Planned near-term item]

## Next action for a new session
Open `NEXT-STEPS.md`, find the first unchecked box, guide from there. Also read `reference/doctrines.md` once — it sets how to advise the owner.

## Gates to [next phase] (all must pass)
- [ ] [Gate]
- [ ] [Gate]

## Lookup map (read on demand only)
- `NEXT-STEPS.md` — remaining roadmap, checklists, gates
- `LOG.md` — append-only session history, one line each; skim only when the timeline is in question
- `reference/decisions.md` — settled decisions (append-only log) + open questions
- `reference/datapoints.md` — every hard number: dimensions, measurements, materials, contacts
- `reference/doctrines.md` — standing rules (advising style + permanent constraints)
- `steps/` — phase artifacts ONLY (photos, receipts); knowledge never lives here. Numbered `NN-name/` in project order; a folder exists only once it has content. Images are token-expensive: open only for visual judgment, never orientation.

## Update protocol (end of every working session)
1. Rewrite Phase / Right now / Gates above — keep this file under one screen, never append history here
2. Append one line to `LOG.md` (what happened, what changed)
3. Tick or edit `NEXT-STEPS.md`
4. Append new decisions with date to `reference/decisions.md`; move any solved open question down into the log
5. New numbers → `reference/datapoints.md`
6. New artifacts → `steps/NN-phase/<event>/`, descriptive filenames; anything worth knowing from them gets written into the docs so they never need re-reading

**On conflict between docs:** newest dated entry in `reference/decisions.md` wins, then this file, then the rest. Fix the stale doc on sight.
