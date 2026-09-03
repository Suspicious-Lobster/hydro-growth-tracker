#!/usr/bin/env python3
"""Render CHANGELOG.md's section for a version from the board's done rows.

    python tools/changelog_from_board.py 1.2.0 2026-09-02 > /tmp/section.md

One line per done row, grouped by lane, oldest commit first within a lane.
The row title is the line; the commit sha is appended for traceability.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BOARD = ROOT / "docs" / "board.md"
LANES = {
    "A": "Data safety and security",
    "B": "Frontend correctness",
    "C": "Electron shell and packaging",
    "D": "Tests and CI",
    "E": "Docs and cleanup",
    "F": "Features",
}
HEADER = re.compile(r"<!--row (.*?)-->\s*\n\*\*(MR-\d+) \[[A-Z/]+\] (.*?)\*\*", re.S)


ROW_REF = re.compile(r"\((MR-\d+)(?:,|\))")


def already_released(changelog: Path | None) -> set[str]:
    """Row ids already listed in an existing CHANGELOG.md, so a new section
    only carries what is NEW since the last release. (1.3.0's first draft
    repeated every 1.2.0 row because the board never forgets a done row.)"""
    if changelog is None or not changelog.exists():
        return set()
    return set(ROW_REF.findall(changelog.read_text(encoding="utf-8")))


def main(version: str, date: str, changelog: Path | None = None) -> int:
    text = BOARD.read_text(encoding="utf-8")
    skip = already_released(changelog)
    rows: dict[str, list[tuple[str, str, str]]] = {k: [] for k in LANES}
    for m in HEADER.finditer(text):
        fields = dict(kv.split("=", 1) for kv in m.group(1).split() if "=" in kv)
        if fields.get("status") != "done":
            continue
        if m.group(2) in skip:
            continue
        lane = fields.get("lane", "E")
        title = m.group(3).strip().rstrip(".")
        rows.setdefault(lane, []).append((m.group(2), title, fields.get("commit", "")))
    out = [f"## {version} - {date}", ""]
    for lane, name in LANES.items():
        items = rows.get(lane, [])
        if not items:
            continue
        out.append(f"### {name}")
        out.append("")
        for rid, title, sha in items:
            out.append(f"- {title} ({rid}{', ' + sha if sha else ''})")
        out.append("")
    sys.stdout.write("\n".join(out))
    return 0


if __name__ == "__main__":
    if len(sys.argv) not in (3, 4):
        print(__doc__, file=sys.stderr)
        sys.exit(2)
    existing = Path(sys.argv[3]) if len(sys.argv) == 4 else None
    sys.exit(main(sys.argv[1], sys.argv[2], existing))
