---
name: project-docs-system
description: >-
  Set up and maintain a token-efficient documentation system for long-running, multi-session
  projects: a one-screen STATE.md entrypoint, append-only history logs, on-demand reference
  files, and artifact folders — so a fresh session reaches certainty about project state with
  minimal reading. Invoke BEFORE reading any project files when: (1) the user asks to resume,
  continue, pick up, or get the status of an ongoing project — "resume the build", "where
  were we", "what's next on X", "read the handoff" — or a connected folder turns out to
  contain a STATE.md; (2) the user starts a multi-session project or asks to "set up project
  docs", a "handoff"/"state" file, or how to preserve context between sessions; (3) a session
  is wrapping up on a project using this system, or the user says "update the docs". It gives
  the cheap reading order and update protocol — invoking it first prevents full-folder
  reads. Also handles programs of parallel sub-projects with shared info and dependencies.
---

# Project Documentation System

_Version: 2026-09-10 · content 088e6124 · built by .claude/skills/publish.sh_

<!-- PROVENANCE -->
_Source of truth: `.claude/skills/project-docs-system/` in the **home-cluster** repo.
Every other copy is a downstream build — never edit a skill in a hosted UI, the edit cannot
be exported and the next publish overwrites it. If the user asks which version of this
skill is loaded, report the Version line above verbatim._
<!-- /PROVENANCE -->

A folder structure and set of habits that let a fresh AI context (or the user, weeks later) reach *certainty* about a project's state with minimal reading.

## Why it works

Reading cost forms a pyramid: listing a folder is nearly free, a small file is cheap, a big file is expensive, images are very expensive. This system pushes every routine question down the pyramid — orientation from one small file, specifics from targeted lookups, images and archives only as a last resort. Two disciplines make that possible: **one tiny entrypoint that is rewritten (never appended)**, and **history that accumulates only in append-only logs**. Keep these two invariants and the system stays cheap forever; break them and every future session pays.

## First: pick the mode

- **The project folder already has a STATE.md** → *resume mode*: read STATE.md and nothing else, then follow its lookup map, reading other files only when the task at hand touches them. Read `reference/doctrines.md` once per session — it sets how the user wants to be advised. Do not open images or `archive/` for orientation.
- **The user wants the system set up** (new project, or an existing pile of notes) → *init mode*, below.
- **A working session is ending, or the user says "update the docs"** → *update mode*, below. This phrase is the entire trigger; the protocol says what to touch.

## The skeleton

```
project/
  STATE.md              entrypoint — the ONLY file a new session must read
  NEXT-STEPS.md         remaining roadmap as tickable checklists with gates
  LOG.md                append-only session history, one line per session
  reference/
    decisions.md        settled decisions (append-only, dated, with one-line "why") + open questions
    datapoints.md       every hard number and fact, grep-friendly, no narrative
    doctrines.md        standing rules: how the owner works, permanent constraints
  steps/
    NN-phase-name/      artifacts only (photos, receipts, manuals), numbered in project order
      event-name/       flat subfolders per event; descriptive filenames
  archive/              superseded monoliths and old handoffs; referenced, rarely read
```

Each file has a growth rule, and respecting it is what keeps the system lean:

| File | Growth rule |
|---|---|
| STATE.md | Rewritten every session, never appended; hard cap one screen |
| NEXT-STEPS.md | Ticked and edited; completed sections shrink to a line or move to LOG |
| LOG.md | Append-only, newest first, one line per session |
| decisions.md | Open list shrinks as questions resolve; settled log is append-only with dates and a one-line "why" (the why prevents re-litigating) |
| datapoints.md | Edited in place; wrong numbers corrected, not appended; no prose |
| doctrines.md | Rarely changes; only genuinely permanent rules enter |
| steps/ | Evidence only, never knowledge; folders created only when they have content |
| archive/ | Write-only in practice; read only for deep background |

## Init mode

1. Copy the templates from this skill's `assets/templates/` into the project root (`reference/` too). Create `steps/` and `archive/` only when there is content for them — empty scaffolding is noise; the roadmap lives in NEXT-STEPS.md, not in empty directories.
2. Fill STATE.md: current phase, what's happening right now, the immediate next action, active gates/blockers. Keep the lookup map and update protocol from the template.
3. Interview the user briefly for doctrines.md: how do they like to be advised, what constraints are permanent, what should every future session know about how they work? These rules transfer between the user's projects almost verbatim — if another project of theirs already has a doctrines.md, start from it.
4. If pre-existing notes, plans, or handoff documents exist: move them to `archive/`, then extract their settled decisions (with dates and whys) into decisions.md and their hard numbers into datapoints.md. This one-time extraction is what buys every future session its cheap orientation.
5. Write the first LOG.md line: date + "project docs initialized" + one clause of current state.
6. If persistent assistant memory is available, store only a pointer ("this project: read STATE.md first, follow its protocol") plus the user's standing personal rules. Never store project state in memory — it goes stale; the folder is the source of truth.

## Update mode — run at the end of every working session

1. Rewrite STATE.md's phase / right-now / gates sections. Never append history there; if it's over one screen, something is leaking that belongs in a log.
2. Append one line to LOG.md: what happened, what changed.
3. Tick or edit NEXT-STEPS.md.
4. Append new decisions (dated, with the one-line why) to decisions.md; move any newly-solved open question down into the settled log.
5. Put new numbers into datapoints.md.
6. File new artifacts under `steps/NN-phase/event/` with descriptive names — and write anything worth *knowing* from them into the docs, so the artifact never needs re-opening. Convert relative dates ("yesterday", "next week") to absolute dates as you write.

**On conflict between docs:** the newest dated entry in decisions.md wins, then STATE.md, then the rest. Fix the stale doc the moment the conflict is noticed.

## Rules that keep it working

1. Knowledge lives in docs, evidence lives in steps/ — truth has exactly one home.
2. Every reference file opens with a one-line "when to read me" so sessions can skip it confidently.
3. Images are opened only for visual judgment, never for orientation.
4. Numbered step folders (`01-`, `02-`, …) follow project chronology so a bare folder listing reads as a timeline.
5. Memory (if any) holds pointers and personal rules, never project state.

## Multi-subproject programs

Some projects are *programs*: several semi-independent subprojects sharing a space, an owner, and dependencies — rooms of an apartment redesign, parallel workstreams of one product. Structure these fractally: **each subproject is a complete, unmodified instance of the standard system; the program root is only a thin index.** Never merge subproject state into one big doc (it recreates the monolith), and never make subprojects fully independent (shared facts then fork and contradict).

```
program/
  STATE.md            program index — use assets/templates/STATE-program.md
  LOG.md              program-level events only: subproject started/closed, dependency freed, cross-cutting decision
  reference/          cross-cutting ONLY: shared datapoints, doctrines, program-wide decisions
  1-living-room/      full standard instance (own STATE.md, NEXT-STEPS.md, LOG.md, reference/, steps/, archive/)
  2-hallway/          full standard instance
```

The rules that make it work:

- **Program STATE.md holds one line per subproject** (status + blocker + next action) plus a dependency map. If a line wants to grow, the detail belongs down in the subproject — push it there.
- **Number subproject folders by start order, and don't create folders for unstarted subprojects.** They exist only as lines in the program STATE ("bedroom — not started; blocked by terrarium move [external: ../vivarium]"). Small pre-project nibbles (minor improvements before real kickoff) get a one-line program LOG entry; create the folder when sustained work begins.
- **Dependencies live in two places with two jobs.** The program dependency map is for orientation: each blocked item names its blocker and where the blocker's state lives — a sibling subproject, or an external project by path. The same dependency becomes a gate in the blocked subproject's NEXT-STEPS once that subproject exists — the map tells you *that* it's blocked, the gate enforces it during execution.
- **Information lives at the lowest level that needs it.** Promote a fact to program `reference/` only when a second subproject needs it — and *move* it, leaving a link behind, never a copy (two copies is a future contradiction). Doctrines are the exception: they describe the owner, not a room, so they nearly always live at program level; a subproject doctrines file exists only for rules unique to that space.
- **Reading order for any session: program STATE.md → the relevant subproject's STATE.md → on demand.** Two small files. Never read sibling subprojects for orientation.
- **Update protocol addition:** after running a subproject's normal end-of-session protocol, check whether its one-liner or the dependency map in program STATE changed; if so, fix them. Add a program LOG line only for program-level events, not routine sessions.

**Initializing an ongoing program:** init the program root first — fill the index from what the user tells you, extract genuinely shared facts from existing handoffs into program `reference/` — then init each *started* subproject as a standard instance, archiving its old handoff inside that subproject's own `archive/`. Unstarted subprojects stay as index lines.

## Failure modes — repair on sight

The system degrades predictably: STATE quietly growing past a screen (move history to LOG), decisions being re-argued (a "why" line was skipped — add it), datapoints turning into prose (move reasoning to decisions), step folders sprouting documents (move knowledge up), the protocol skipped at session end (the next session pays double). Any session that notices degradation repairs it as part of that session's doc update — repair is part of the protocol, not a favor.
