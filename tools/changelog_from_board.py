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
}
HEADER = re.compile(r"<!--row (.*?)-->\s*\n\*\*(MR-\d+) \[[A-Z/]+\] (.*?)\*\*", re.S)


def main(version: str, date: str) -> int:
    text = BOARD.read_text(encoding="utf-8")
    rows: dict[str, list[tuple[str, str, str]]] = {k: [] for k in LANES}
    for m in HEADER.finditer(text):
        fields = dict(kv.split("=", 1) for kv in m.group(1).split() if "=" in kv)
        if fields.get("status") != "done":
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
    if len(sys.argv) != 3:
        print(__doc__, file=sys.stderr)
        sys.exit(2)
    sys.exit(main(sys.argv[1], sys.argv[2]))
