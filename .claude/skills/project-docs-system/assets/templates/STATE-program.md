# STATE — program index. Read this first, then ONLY the subproject being worked on.
_Last updated: YYYY-MM-DD_

**Program:** [one-line description]

## Subprojects (one line each — detail lives inside the subproject, never here)
| # | Subproject | Status | Blocked by | Next action |
|---|---|---|---|---|
| 1 | [name]/ | active | — | [one clause] |
| 2 | [name]/ | active | — | [one clause] |
| – | [name] | not started | [blocker] | [what unblocks it] |
| – | [name] | paused (time) | — | [smallest restart step] |

Unstarted/paused subprojects have no folder — they live only on this list until sustained work begins.

## Dependency map
- [blocked item] ← [blocker; where its state lives: `N-subproject/STATE.md` or external path]

## Shared reference (read on demand; cross-cutting facts ONLY — room-specific facts live in the room)
- `reference/datapoints.md` — program-wide numbers (dimensions, shared materials, palette)
- `reference/doctrines.md` — how the owner works; applies to every subproject
- `reference/decisions.md` — cross-cutting decisions only
- `LOG.md` — program-level events only (subproject started/closed, dependency freed)

## Update protocol
After any subproject session: run that subproject's own protocol first, then update its line and the dependency map here if they changed. Rewrite, don't append; keep this file under one screen. On conflict: newest dated decision (program or subproject) wins; fix the stale doc on sight.
