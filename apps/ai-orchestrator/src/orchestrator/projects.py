"""Trusted project configuration: which board drives which repository.

This is the allowlist plan §4 and §11 depend on. It is loaded from a file the
orchestrator ships or mounts, never from board text, because everything it
contains is a privilege decision:

* `repository` — a handoff naming a repository absent from here cannot dispatch.
* `acceptance_checks` — check *IDs* map to commands here. Plan §11 keeps the
  expected checks outside model control, so a card can select a check by ID but
  can never supply the command that runs.

One board per project (each project gets its own kan board), keyed by the
board's **name**. Deliberately not its publicId: an opaque per-instance id makes
this file unreadable, ties it to one kan deployment, and has to be looked up by
hand for every new project. Stage resolution already works this way -- a kan
list is matched by name -- so the board is matched the same way.

kan puts the board name in every card webhook, so the read path resolves a
project with no API call at all.

A rename breaks the binding, which is the correct failure: a renamed board
should stop driving a repository until someone says otherwise.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml


class ProjectUnknown(Exception):
    """No project is configured for this board. Never retryable."""


class RepositoryNotAllowed(Exception):
    """The handoff names a repository this board may not touch."""


class CheckNotAllowed(Exception):
    """The handoff names an acceptance check that is not trusted config."""


@dataclass(frozen=True)
class Project:
    # Board name exactly as it appears in kan, matched case-insensitively.
    board: str
    repository: str
    default_branch: str = "main"
    # Check ID -> the command actually run, as an argv list. Never a shell
    # string: a check ID must not be able to smuggle a pipeline or a `;`.
    checks: dict[str, list[str]] = field(default_factory=dict)
    # Job image for this project's toolchain. Phase 2 runs the dummy worker.
    image: str = ""

    def resolve_checks(self, ids: list[str]) -> dict[str, list[str]]:
        unknown = [i for i in ids if i not in self.checks]
        if unknown:
            raise CheckNotAllowed(
                f"board {self.board!r} has no acceptance check(s): {', '.join(sorted(unknown))}"
            )
        return {i: self.checks[i] for i in ids}


@dataclass(frozen=True)
class Registry:
    # Keyed by casefolded board name.
    projects: dict[str, Project]

    def for_board(self, board_name: str) -> Project:
        project = self.projects.get((board_name or "").strip().casefold())
        if project is None:
            raise ProjectUnknown(f"no project configured for board {board_name!r}")
        return project

    def assert_repository(self, board_name: str, repository: str) -> Project:
        project = self.for_board(board_name)
        if repository != project.repository:
            raise RepositoryNotAllowed(
                f"board {board_name!r} is bound to {project.repository!r}, "
                f"handoff asked for {repository!r}"
            )
        return project

    @property
    def board_names(self) -> list[str]:
        return sorted(p.board for p in self.projects.values())


def load(path: str | os.PathLike[str]) -> Registry:
    raw = yaml.safe_load(Path(path).read_text()) or {}
    entries: Any = raw.get("projects") or []
    if not isinstance(entries, list):
        raise ValueError("projects config: 'projects' must be a list")

    projects: dict[str, Project] = {}
    for entry in entries:
        board = str(entry["board"]).strip()
        if not board:
            raise ValueError("projects config: 'board' must be a non-empty board name")
        key = board.casefold()
        if key in projects:
            raise ValueError(f"projects config: duplicate board {board!r}")
        checks_raw = entry.get("checks") or {}
        checks: dict[str, list[str]] = {}
        for check_id, argv in checks_raw.items():
            if isinstance(argv, str):
                raise ValueError(
                    f"check {check_id!r}: must be a list of argv items, not a shell string"
                )
            checks[str(check_id)] = [str(a) for a in argv]

        projects[key] = Project(
            board=board,
            repository=str(entry["repository"]),
            default_branch=str(entry.get("default_branch") or "main"),
            checks=checks,
            image=str(entry.get("image") or ""),
        )

    return Registry(projects=projects)
