#!/usr/bin/env python3
"""board.py -- THE BOARD's machine.

The task board is prose: 64 rows of English that only a person can read. That
made four questions unanswerable by any program:

    what is READY right now?      (re-derived by hand, from 59KB, every wave)
    what CLASHES with what?       (footprint overlap -- three poisoned verdicts)
    which rows have gone STALE?   (P1.4 was dispatched against a row fixed
                                   three days earlier)
    what does NOTHING cover?      (no coverage view exists at all)

This tool answers them. It does NOT replace the prose -- every row keeps its
English body. It adds one machine-readable header line per row, and a `lint`
command that hard-fails if prose and header ever disagree. Drift becomes a
build failure instead of a discovery.

    <!--row id=P1.1 tier=O status=done lane=A deps=P1.3 files=scenes/park.gd commit=e46cb7cb-->
    **P1.1 [O] N29 + B-03 -- the feed hit-test divergence** (lane A). ...

Commands
    lint                 schema + pairing + prose duties. Runs in validate.sh.
    ready                what is dispatchable now, and WHY each other row is not
    wave [--max N]       a maximal DISJOINT set of ready rows -- the /work pick
    conflicts            pairwise footprint overlap among open rows
    audit                drift: dead commits, phantom files, stale-row candidates
    coverage             which areas of the repo have churn but no open row
    stats                process telemetry from the runs ledger
    show <id>            one row, header + body
    set <id> k=v [k=v]   rewrite a row's header in place
    validate --exclude-in-flight
                         derive the vitest --exclude globs for test files
                         inside in-flight (status=doing) rows' footprints

Every command takes --json. Every command exits non-zero on a hard failure so
it can be a gate (CODING-PRACTICES 1.7: a gate ABORTS, it does not report a
number it cannot stand behind).

Project-agnostic: all project specifics live in board.config.json. To use this
in another repo, copy this file and write a new config.
"""

from __future__ import annotations

import argparse
import fnmatch
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

# BUMP THIS IN THE SAME EDIT THAT CHANGES BEHAVIOUR. `lint` prints it, so two
# vendored copies can be compared at a glance -- but only if it actually moves.
# It did not on its first day: `wave --exclude`, `log --outcome repaired` and
# `log --violation` all shipped under 1.1.0, and the ~/.claude copy sat stale
# while both files agreed they were 1.1.0. A version that does not change when
# behaviour does is not a version, it is decoration.
#
# The tool is DELIBERATELY not made to read ~/.claude at runtime: the repo must
# build on a machine that has never seen it, which is the whole reason the copy
# is vendored. Comparing copies is therefore a human act, and this string is
# the only thing that makes it cheap.
#
# 1.3.2  validate --exclude-in-flight: derive the vitest --exclude globs for
#        test files inside in-flight (status=doing) rows' footprints, so the
#        exclusion is read off the board instead of hand-typed by a foreman
# 1.2.1  body_ends() now treats a bare `---` divider as a body/section end
#        (fenced code blocks are tracked so a divider-shaped line inside one
#        does not truncate the row)
# 1.2.0  wave --exclude; log --outcome repaired; log --violation; stats counts
#        repairs and rule breaks apart from clean ships, per tier
# 1.1.0  new; stats per-run deltas; UTF-8 stdout; version stamp
# 1.0.0  lint/ready/wave/conflicts/audit/coverage/stats/log/show/set
__version__ = "1.3.2"

# --------------------------------------------------------------------------
# config
# --------------------------------------------------------------------------

DEFAULT_CONFIG = {
    "boards": [],           # [{"path": "docs/board.md", "src": "stack"}]
    "row_id_pattern": r"^[A-Z][A-Za-z0-9]*(?:[-.][A-Za-z0-9]+)*$",
    "tiers": ["H", "S", "O"],
    "statuses": ["todo", "ready", "doing", "blocked", "done", "closed"],
    "open_statuses": ["todo", "ready", "doing", "blocked"],
    "flags": ["dg", "owner", "tree"],
    "source_roots": [],     # for coverage
    "ignore_globs": [],
    "runs_ledger": "docs/.board-runs.jsonl",
    "churn_days": 14,
    # prose a non-done row must contain, as {label: [any-of-these-substrings]}
    "prose_duties": {},
    # Phases. A plan's dependency law ("P4 before P5") is usually a sentence in
    # a doc; encoded here it becomes a readiness rule instead of a memory test.
    "phase_pattern": "",        # regex, group 1 of the row id -> phase name
    "phase_alias": {},          # {"U": "P2"} for phases whose rows are named oddly
    "phase_deps": {},           # {"P5": ["P4"]} -- P5 waits while P4 has open rows
}

# A header is EITHER its own line above the row (block rows) OR trailing on the
# opener line (list rows -- a comment line between bullets splits the list, and
# a nested sub-row is still a dispatchable unit).
HEADER_RE = re.compile(r"^<!--\s*row\s+(?P<body>.*?)\s*-->\s*$")
TRAILING_RE = re.compile(r"<!--\s*row\s+(?P<body>.*?)\s*-->\s*$")
OPENER_RE = re.compile(r"^(?:[-*]\s+|\d+\.\s+)?\*\*(?P<id>[^\s\[\*]+)")
# A bare `---` horizontal rule ends a row's body exactly as a `## ` heading
# does -- the live board separates rows/sections with it. A fenced code block
# (```` ``` ````) can legally contain a line that LOOKS like a divider (the
# board keeps arithmetic in fences), so `---` is only checked with fence
# state tracked around it -- see body_ends()'s caller.
DIVIDER_RE = re.compile(r"^-{3,}\s*$")
FENCE_RE = re.compile(r"^\s*```")
KV_RE = re.compile(r"(?P<k>[a-z_]+)=(?P<v>[^\s]*)")


def repo_root(start: Path) -> Path:
    p = start.resolve()
    for cand in [p, *p.parents]:
        if (cand / ".git").exists():
            return cand
    return p


def load_config(root: Path) -> dict:
    cfg = dict(DEFAULT_CONFIG)
    for name in ("board.config.json", "docs/board.config.json"):
        f = root / name
        if f.exists():
            cfg.update(json.loads(f.read_text(encoding="utf-8")))
            cfg["_config_path"] = str(f)
            return cfg
    cfg["_config_path"] = None
    return cfg


# --------------------------------------------------------------------------
# model
# --------------------------------------------------------------------------

@dataclass
class Row:
    id: str
    tier: str = ""
    status: str = "todo"
    lane: str = ""
    deps: list[str] = field(default_factory=list)
    files: list[str] = field(default_factory=list)
    commit: str = ""
    flags: list[str] = field(default_factory=list)
    src: str = ""
    phase: str = ""
    # provenance
    path: str = ""
    header_line: int = 0
    opener_line: int = 0
    body_end: int = 0   # 0-based index (in path.splitlines()) one past this
                         # row's LAST body line -- where the next row's header,
                         # the next section, or EOF begins. `new --after` needs
                         # this (not opener_line) so it inserts after the WHOLE
                         # block, never inside a multi-paragraph row's prose.
    title: str = ""
    body: str = ""

    def is_open(self, cfg: dict) -> bool:
        return self.status in cfg["open_statuses"]

    def as_dict(self) -> dict:
        return {
            "id": self.id, "tier": self.tier, "status": self.status,
            "lane": self.lane, "deps": self.deps, "files": self.files,
            "commit": self.commit, "flags": self.flags, "src": self.src,
            "phase": self.phase,
            "path": self.path, "line": self.opener_line, "title": self.title,
        }


@dataclass
class Problem:
    level: str   # "error" | "warn"
    row: str
    msg: str
    where: str = ""

    def as_dict(self) -> dict:
        return {"level": self.level, "row": self.row, "msg": self.msg,
                "where": self.where}


# --------------------------------------------------------------------------
# parsing
# --------------------------------------------------------------------------

def parse_header(body: str) -> tuple[dict, list[str]]:
    """Return (fields, leftovers). Leftovers are tokens that were not k=v."""
    fields: dict[str, str] = {}
    consumed = 0
    for m in KV_RE.finditer(body):
        fields[m.group("k")] = m.group("v")
        consumed += len(m.group(0))
    leftovers = [t for t in body.split() if "=" not in t]
    return fields, leftovers


def split_list(v: str) -> list[str]:
    return [x for x in (p.strip() for p in v.split(",")) if x]


def phase_of(rid: str, explicit: str, cfg: dict) -> str:
    """A row's phase: the header's `phase=` if given, else derived from the id."""
    if explicit:
        return explicit
    pat = cfg.get("phase_pattern")
    if not pat:
        return ""
    m = re.match(pat, rid)
    if not m:
        return ""
    return (cfg.get("phase_alias") or {}).get(m.group(1), m.group(1))


def parse_board(path: Path, src: str, cfg: dict) -> tuple[list[Row], list[Problem]]:
    """Parse one board file. Returns rows and any structural problems.

    A row is a `<!--row ...-->` header line whose next non-blank line is a
    `**<id> ...**` opener. An opener whose id matches the project's row-id
    pattern but carries NO header is an ERROR, never a silent skip -- that is
    the whole point: the tool must not report a count it cannot stand behind.
    """
    rows: list[Row] = []
    problems: list[Problem] = []
    id_pat = re.compile(cfg["row_id_pattern"])

    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    rel = str(path).replace("\\", "/")

    headered_openers: set[int] = set()

    def body_ends(k: int) -> bool:
        """A row's body runs until the next row, the next section, or a `---`
        divider (fenced-code lines are filtered out by the caller before this
        is asked -- see the `in_fence` walk below)."""
        if lines[k].startswith("## "):
            return True
        if HEADER_RE.match(lines[k]):
            return True
        if DIVIDER_RE.match(lines[k]):
            return True
        return bool(OPENER_RE.match(lines[k]) and TRAILING_RE.search(lines[k]))

    i = 0
    while i < len(lines):
        om = OPENER_RE.match(lines[i])
        tm = TRAILING_RE.search(lines[i]) if om else None

        if om and tm:
            # form B: the header trails the opener (a nested / list row)
            header_line = i + 1
            j = i
            fields, leftovers = parse_header(tm.group("body"))
        else:
            m = HEADER_RE.match(lines[i])
            if not m:
                i += 1
                continue
            # form A: the header is its own line above the row
            header_line = i + 1
            fields, leftovers = parse_header(m.group("body"))
            j = i + 1
            while j < len(lines) and not lines[j].strip():
                j += 1
            if j >= len(lines) or not OPENER_RE.match(lines[j]):
                problems.append(Problem(
                    "error", fields.get("id", "?"),
                    "header is not followed by a `**<id> ...**` row opener",
                    f"{rel}:{header_line}"))
                i += 1
                continue

        headered_openers.add(j)
        opener = lines[j]
        opener_id = OPENER_RE.match(opener).group("id")

        rid = fields.get("id", "")
        if not rid:
            problems.append(Problem("error", opener_id,
                                    "header has no id=", f"{rel}:{header_line}"))
            rid = opener_id
        elif rid != opener_id:
            problems.append(Problem(
                "error", rid,
                f"header id={rid} but the row opener says {opener_id}",
                f"{rel}:{header_line}"))

        if leftovers:
            problems.append(Problem(
                "warn", rid,
                f"header has non key=value tokens: {' '.join(leftovers)}",
                f"{rel}:{header_line}"))

        k = j + 1
        in_fence = False
        while k < len(lines):
            if FENCE_RE.match(lines[k]):
                # A fence toggle is never a body-end itself, and while inside
                # one nothing (including a `---`-shaped line of arithmetic)
                # ends the row -- only fence OPEN/CLOSE is tracked, not the
                # fence's own content.
                in_fence = not in_fence
                k += 1
                continue
            if not in_fence and body_ends(k):
                break
            k += 1

        rows.append(Row(
            id=rid,
            tier=fields.get("tier", ""),
            status=fields.get("status", "todo"),
            lane=fields.get("lane", ""),
            deps=split_list(fields.get("deps", "")),
            files=split_list(fields.get("files", "")),
            commit=fields.get("commit", ""),
            flags=split_list(fields.get("flags", "")),
            src=fields.get("src", src),
            phase=phase_of(rid, fields.get("phase", ""), cfg),
            path=rel,
            header_line=header_line,
            opener_line=j + 1,
            body_end=k,
            title=TRAILING_RE.sub("", opener).strip().lstrip("-* 0123456789.").strip("* "),
            body="\n".join(lines[j:k]),
        ))
        i = j + 1

    # openers that look like rows but carry no header
    for n, line in enumerate(lines):
        if n in headered_openers:
            continue
        m = OPENER_RE.match(line)
        if not m:
            continue
        oid = m.group("id").rstrip(":.,")
        if id_pat.match(oid):
            problems.append(Problem(
                "error", oid,
                "row opener has NO <!--row--> header (it is invisible to every "
                "query -- add one or rename it so it is not row-shaped)",
                f"{rel}:{n + 1}"))

    return rows, problems


def load_rows(root: Path, cfg: dict) -> tuple[list[Row], list[Problem]]:
    rows: list[Row] = []
    problems: list[Problem] = []
    if not cfg["boards"]:
        problems.append(Problem("error", "-", "no boards configured "
                                "(board.config.json -> boards[])"))
        return rows, problems
    for entry in cfg["boards"]:
        p = root / entry["path"]
        if not p.exists():
            problems.append(Problem("error", "-",
                                    f"board file missing: {entry['path']}"))
            continue
        r, pr = parse_board(p, entry.get("src", ""), cfg)
        rows.extend(r)
        problems.extend(pr)
    return rows, problems


# --------------------------------------------------------------------------
# git helpers
# --------------------------------------------------------------------------

def git(root: Path, *args: str) -> str:
    try:
        out = subprocess.run(["git", "-C", str(root), *args],
                             capture_output=True, text=True, timeout=30)
        return out.stdout if out.returncode == 0 else ""
    except Exception:
        return ""


def commit_exists(root: Path, sha: str) -> bool:
    return bool(git(root, "cat-file", "-t", sha).strip() == "commit")


def changed_since(root: Path, days: int) -> set[str]:
    out = git(root, "log", f"--since={days} days ago", "--name-only",
              "--pretty=format:")
    return {ln.strip() for ln in out.splitlines() if ln.strip()}


def commits_naming(root: Path, token: str, limit: int = 400) -> list[str]:
    """Commits whose SUBJECT names this row id.

    The signal for a stale row is not "its files changed" -- in any active repo
    that is nearly every row, which is why the first version of this check
    flagged all five rows of a repo thirty seconds old. The signal is that work
    LABELLED AS THIS ROW has already landed while the row still reads open.
    """
    out = git(root, "log", f"-{limit}", "--pretty=format:%h\x1f%s")
    hits = []
    pat = re.compile(r"(?<![0-9A-Za-z.-])" + re.escape(token) + r"(?![0-9A-Za-z.])")
    for ln in out.splitlines():
        if "\x1f" not in ln:
            continue
        sha, subj = ln.split("\x1f", 1)
        if pat.search(subj):
            hits.append(f"{sha} {subj[:60]}")
    return hits


# --------------------------------------------------------------------------
# footprints
# --------------------------------------------------------------------------

def repo_files(root: Path, cfg: dict) -> list[str]:
    out = git(root, "ls-files")
    files = [ln.strip() for ln in out.splitlines() if ln.strip()]
    ig = cfg.get("ignore_globs") or []
    if ig:
        files = [f for f in files
                 if not any(fnmatch.fnmatch(f, g) for g in ig)]
    return files


def expand(globs: list[str], files: list[str]) -> set[str]:
    """Concrete files a footprint claims. A glob matching nothing still
    contributes its literal text, so two rows naming the same not-yet-created
    file still collide (a footprint is a CLAIM, not an inventory)."""
    hit: set[str] = set()
    for g in globs:
        g = g.replace("\\", "/")
        matched = [f for f in files if fnmatch.fnmatch(f, g)]
        if matched:
            hit.update(matched)
        else:
            hit.add(g)
    return hit


# --------------------------------------------------------------------------
# validate -- deriving the vitest --exclude list from in-flight footprints
# --------------------------------------------------------------------------

TEST_FILE_RE = re.compile(r"\.test\.(?:js|jsx|mjs)$")


def is_test_file(rel: str) -> bool:
    """A footprint entry counts as a test file if it matches the vitest
    naming convention (*.test.js/.jsx/.mjs) or lives under test/ or
    frontend/src/__tests__/ -- the three shapes MR-36's retrospective named
    (MR-34's ten-species assertion, MR-23's kaboom boundary test, MR-25's
    require-in-a-test, Modal.test.jsx)."""
    rel = rel.replace("\\", "/")
    if TEST_FILE_RE.search(rel):
        return True
    if rel == "test" or rel.startswith("test/"):
        return True
    if rel == "frontend/src/__tests__" or "frontend/src/__tests__/" in rel:
        return True
    return False


def working_tree_files(root: Path) -> list[str]:
    """Every file on disk, relative to root, forward-slashed. Unlike
    `repo_files()` (git ls-files) this sees files a row created but has not
    yet staged -- exactly the state a `doing` row is usually in."""
    out = []
    # Dependency and build trees hold no footprint file and cost ~27 s to
    # walk on this repo (two node_modules); the footprint globs never name
    # them (board.config.json ignore_globs), so prune at the top.
    skip = {".git", "node_modules", "dist", "coverage"}
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in skip]
        for fn in filenames:
            rel = (Path(dirpath) / fn).relative_to(root).as_posix()
            out.append(rel)
    return out


def expand_working_tree(root: Path, globs: list[str]) -> set[str]:
    """Concrete files a footprint claims, resolved against the WORKING TREE
    (not `git ls-files`, unlike `expand()`). A row mid-edit may have created a
    test file that is not yet staged/committed -- exactly the case this
    command exists for -- so this must see the disk, not the index. A glob
    matching nothing on disk still contributes its literal text (a footprint
    is a claim, not an inventory, same rule as `expand()`). fnmatch has no
    special recursive syntax, so `test/**` matches like `test/*` (`*` already
    translates to `.*`) -- which is exactly "covers every file under test/",
    the behaviour this command needs."""
    files = working_tree_files(root)
    hits: set[str] = set()
    for g in globs:
        g = g.replace("\\", "/")
        if any(ch in g for ch in "*?["):
            matched = [f for f in files if fnmatch.fnmatch(f, g)]
            if matched:
                hits.update(matched)
            else:
                hits.add(g)
            continue
        p = root / g
        if p.is_dir():
            hits.update(f for f in files if f == g or f.startswith(g + "/"))
        elif p.is_file():
            hits.add(g)
        else:
            hits.add(g)
    return hits


# --------------------------------------------------------------------------
# readiness
# --------------------------------------------------------------------------

def phase_owed(rows: list[Row], cfg: dict) -> dict[str, int]:
    """How many rows each phase still owes -- the plan's dependency law.
    ONE copy, used by both readiness() and lint's prose-duty deferral, so the
    two can never disagree about what "reachable" means."""
    owed: dict[str, int] = {}
    for r in rows:
        if r.phase and r.is_open(cfg):
            owed[r.phase] = owed.get(r.phase, 0) + 1
    return owed


def readiness(rows: list[Row], cfg: dict) -> tuple[list[Row], list[tuple[Row, str]]]:
    """(ready, [(row, why-not)]) over OPEN rows only."""
    by_id = {r.id: r for r in rows}
    done = {"done", "closed"}
    ready: list[Row] = []
    blocked: list[tuple[Row, str]] = []

    phase_open = phase_owed(rows, cfg)
    phase_deps = cfg.get("phase_deps") or {}

    for r in rows:
        if not r.is_open(cfg):
            continue
        why: list[str] = []
        for p in phase_deps.get(r.phase, []):
            owed = phase_open.get(p, 0)
            if owed:
                why.append(f"phase {p} still owes {owed} row(s)")
        if r.status == "blocked":
            why.append("marked blocked")
        if r.status == "doing":
            why.append("already in flight")
        if "owner" in r.flags:
            why.append("owner-blocked")
        if "dg" in r.flags:
            why.append("unresolved designer gate")
        for d in r.deps:
            dep = by_id.get(d)
            if dep is None:
                why.append(f"dep {d} does not exist")
            elif dep.status not in done:
                why.append(f"dep {d} is {dep.status}")
        if why:
            blocked.append((r, "; ".join(why)))
        else:
            ready.append(r)
    return ready, blocked


def pick_wave(ready: list[Row], files: list[str], max_n: int,
              exclude: list[str] | None = None,
              in_flight: list[Row] | None = None,
              ) -> tuple[list[Row], list[tuple[Row, str]]]:
    """Greedy maximal DISJOINT set, in board order.

    Three rules the prose protocol asked a human to remember, made structural:
      * footprints must not intersect
      * a `tree` claimant (blind run, full sweep) takes the WHOLE repo and
        therefore runs alone, as its own wave
      * `in_flight` rows (status=doing) still OWN their files. `readiness()`
        drops them from `ready`, and for a long time that was the whole story
        -- so their footprint was never claimed and the picker would happily
        hand a worker a file the foreman was editing. Observed live
        2026-08-09: with P13.1 (sim/creature_needs.gd) in flight, the wave
        offered P4.2 and then P4.3, both claiming that same file. That is the
        overlapping-footprint case that poisoned three verdicts in one day.
    """
    chosen: list[Row] = []
    # file -> id of the row holding it, so a clash can NAME its owner whether
    # that owner is in this wave or already out with a worker.
    claimed: dict[str, str] = {}
    skipped: list[tuple[Row, str]] = []
    tree_taken = False
    held_by_hand = set(exclude or [])
    for r in in_flight or []:
        if "tree" in r.flags:
            # a whole-tree claimant already running owns everything
            tree_taken = True
        for f in expand(r.files, files):
            claimed.setdefault(f, r.id)

    for r in ready:
        # "Ready, but not this wave." Found on the protocol's own first run: a
        # solo investigation was READY and correctly took the whole wave, and
        # there was no way to defer it without marking it `blocked`, which
        # would have been a lie the board then carried. An exclusion is a
        # DECISION, so it is stated out loud here rather than hidden in a
        # status. It is not the same as dispatching around a stated reason: the
        # reason still holds, you are choosing not to run that row now.
        if r.id in held_by_hand:
            skipped.append((r, "excluded BY HAND on this pick (--exclude)"))
            continue
        if len(chosen) >= max_n:
            skipped.append((r, f"wave already at max {max_n}"))
            continue
        if "tree" in r.flags:
            if chosen or tree_taken:
                skipped.append((r, "whole-tree claimant -- must run solo"))
                continue
            if claimed:
                # An ORDINARY row in flight holds a tree claimant too. Observed
                # live 2026-08-10: with three doing rows out, `wave` offered a
                # [SOLO] sweep over live writers -- the launch that had to be
                # killed twice the day the solo rule was written.
                owner = sorted(set(claimed.values()))[0]
                skipped.append((r, f"whole-tree claimant -- {owner} is in "
                                   "flight and owns files"))
                continue
            chosen.append(r)
            tree_taken = True
            continue
        if tree_taken:
            skipped.append((r, "a whole-tree claimant holds this wave"))
            continue
        mine = expand(r.files, files)
        if not mine:
            skipped.append((r, "declares no footprint (files=) -- cannot be "
                               "proven disjoint, so it never dispatches"))
            continue
        clash = mine & set(claimed)
        if clash:
            owner = claimed[sorted(clash)[0]]
            skipped.append((r, f"footprint clash with {owner}: "
                               f"{', '.join(sorted(clash)[:3])}"))
            continue
        chosen.append(r)
        for f in mine:
            claimed.setdefault(f, r.id)
    return chosen, skipped


# --------------------------------------------------------------------------
# commands
# --------------------------------------------------------------------------

def cmd_lint(root: Path, cfg: dict, args) -> int:
    rows, problems = load_rows(root, cfg)
    seen: dict[str, Row] = {}

    # Prose duties come due only when a row's PHASE IS REACHABLE. A P6 row's
    # acceptance gets written when P6 opens; warning on it today builds the
    # exact wall the drift check below refuses to build -- a warning nobody
    # can pay yet hides the ones that matter. Deferred duties are COUNTED in
    # the output, never silently dropped.
    phase_open = phase_owed(rows, cfg)
    phase_deps = cfg.get("phase_deps") or {}
    deferred_duties = 0

    for r in rows:
        where = f"{r.path}:{r.header_line}"
        if r.id in seen:
            problems.append(Problem("error", r.id,
                                    f"duplicate id (also {seen[r.id].path}:"
                                    f"{seen[r.id].header_line})", where))
        seen[r.id] = r

        if r.status not in cfg["statuses"]:
            problems.append(Problem("error", r.id,
                                    f"status={r.status!r} is not one of "
                                    f"{cfg['statuses']}", where))
        if r.tier:
            for t in re.split(r"[/,]", r.tier):
                if t.strip() and t.strip() not in cfg["tiers"]:
                    problems.append(Problem("error", r.id,
                                            f"tier {t.strip()!r} unknown", where))
        else:
            problems.append(Problem("error", r.id, "no tier=", where))

        for f in r.flags:
            if f not in cfg["flags"]:
                problems.append(Problem("error", r.id,
                                        f"flag {f!r} unknown", where))

        if r.status == "done" and not r.commit:
            problems.append(Problem("error", r.id,
                                    "status=done with no commit=", where))
        if r.commit and not commit_exists(root, r.commit):
            problems.append(Problem("error", r.id,
                                    f"commit {r.commit} is not in this repo",
                                    where))
        if r.is_open(cfg) and not r.files and "tree" not in r.flags:
            problems.append(Problem("warn", r.id,
                                    "open row declares no footprint -- it can "
                                    "never be dispatched", where))

        # THE DRIFT CHECK -- deliberately ASYMMETRIC, because only one
        # direction is dangerous.
        #
        # prose says DONE, header does not  -> ERROR. A row that reads as
        #   finished but is not tracked as finished is how P1.4 got dispatched
        #   against work that had shipped three days earlier. It is also how
        #   P11.3 nearly got marked done off one finished sub-item out of seven.
        #
        # header says done, prose is quiet  -> fine. The header is the source of
        #   truth for STATUS; the prose is the story. Warning on this direction
        #   would put a permanent unpayable warning next to every shipped row,
        #   and a warning nobody can clear is noise that hides the real ones.
        first = r.body.split("\n\n")[0]
        prose_done = bool(re.search(r"\b(DONE|CLOSED|SHIPPED)\b", first))
        if prose_done and r.status not in ("done", "closed"):
            problems.append(Problem(
                "error", r.id,
                f"prose says DONE/CLOSED but header says status={r.status}",
                where))

        # dep integrity
        for d in r.deps:
            if d not in {x.id for x in rows}:
                problems.append(Problem("error", r.id,
                                        f"dep {d} is not a row", where))

        # per-project prose duties (e.g. an open row must name its red proof)
        if r.is_open(cfg):
            for label, needles in (cfg.get("prose_duties") or {}).items():
                if not any(n.lower() in r.body.lower() for n in needles):
                    if any(phase_open.get(p, 0)
                           for p in phase_deps.get(r.phase, [])):
                        deferred_duties += 1
                    else:
                        problems.append(Problem("warn", r.id,
                                                f"prose names no {label}",
                                                where))

    errors = [p for p in problems if p.level == "error"]
    warns = [p for p in problems if p.level == "warn"]

    if args.json:
        print(json.dumps({"rows": len(rows),
                          "errors": [p.as_dict() for p in errors],
                          "warnings": [p.as_dict() for p in warns],
                          "deferred_prose_duties": deferred_duties}, indent=1))
    else:
        print(f"board lint: {len(rows)} rows parsed from "
              f"{len(cfg['boards'])} file(s)  [board.py {__version__}]")
        for p in errors:
            print(f"  ERROR  {p.row:<10} {p.msg}\n         {p.where}")
        for p in warns:
            print(f"  warn   {p.row:<10} {p.msg}\n         {p.where}")
        print(f"  {len(errors)} error(s), {len(warns)} warning(s)")
        if deferred_duties:
            print(f"  ({deferred_duties} prose dut"
                  f"{'y' if deferred_duties == 1 else 'ies'} deferred on "
                  f"unreachable-phase rows -- owed when their phase opens)")
    return 1 if errors else 0


def cmd_ready(root: Path, cfg: dict, args) -> int:
    rows, problems = load_rows(root, cfg)
    if [p for p in problems if p.level == "error"]:
        print("board: REFUSING to answer -- the board does not parse cleanly.\n"
              "       run `python tools/board.py lint` first.", file=sys.stderr)
        return 2
    ready, blocked = readiness(rows, cfg)
    if args.json:
        print(json.dumps({
            "ready": [r.as_dict() for r in ready],
            "not_ready": [{**r.as_dict(), "why": w} for r, w in blocked],
        }, indent=1))
        return 0
    print(f"READY ({len(ready)})")
    for r in ready:
        fp = ",".join(r.files) or "(none)"
        print(f"  {r.id:<10} [{r.tier:<3}] {r.title[:58]}")
        print(f"  {'':<10}  files: {fp}")
    print(f"\nNOT READY ({len(blocked)})")
    for r, w in blocked:
        print(f"  {r.id:<10} [{r.tier:<3}] {w}")
    return 0


def cmd_wave(root: Path, cfg: dict, args) -> int:
    rows, problems = load_rows(root, cfg)
    if [p for p in problems if p.level == "error"]:
        print("board: REFUSING to pick a wave -- the board does not parse.\n"
              "       run `python tools/board.py lint` first.", file=sys.stderr)
        return 2
    ready, _ = readiness(rows, cfg)
    files = repo_files(root, cfg)
    excluded = split_list(args.exclude)
    unknown = [e for e in excluded if e not in {r.id for r in rows}]
    if unknown:
        print(f"board: --exclude names no such row: {', '.join(unknown)}",
              file=sys.stderr)
        return 1
    # Rows already out with a worker still OWN their files. A `doing` row that
    # declares no footprint owns something UNKNOWABLE, so there is no honest
    # wave to pick -- abort rather than hand back a disjointness claim we
    # cannot stand behind (CODING-PRACTICES 1.7).
    in_flight = [r for r in rows if r.status == "doing"]
    footprintless = [r.id for r in in_flight if not expand(r.files, files)]
    if footprintless:
        print("board: REFUSING to pick a wave -- these rows are in flight "
              "(status=doing) but declare no footprint, so what they own "
              f"cannot be known: {', '.join(footprintless)}\n"
              "       give each a files= footprint, or set it back to todo.",
              file=sys.stderr)
        return 2
    # The ceiling is the owner's ruling in board.config.json -> work.max_workers;
    # --max only overrides it. A CLI default of 3 here once outvoted a config
    # raised to 10 for three weeks (~/.claude/CLAUDE.md, 2026-09-01).
    if args.max is None:
        args.max = int((cfg.get("work") or {}).get("max_workers", 3))
    chosen, skipped = pick_wave(ready, files, args.max, excluded, in_flight)
    if args.json:
        print(json.dumps({
            "wave": [r.as_dict() for r in chosen],
            "held": [{**r.as_dict(), "why": w} for r, w in skipped],
            "in_flight": [r.as_dict() for r in in_flight],
        }, indent=1))
        return 0
    print(f"WAVE ({len(chosen)} of {len(ready)} ready, max {args.max})")
    for r in chosen:
        solo = "  [SOLO -- whole tree]" if "tree" in r.flags else ""
        print(f"  {r.id:<10} [{r.tier:<3}] {r.title[:52]}{solo}")
        print(f"  {'':<10}  files: {','.join(r.files)}")
    if in_flight:
        print("\nALREADY IN FLIGHT (their files are claimed, not available)")
        for r in in_flight:
            solo = "  [WHOLE TREE]" if "tree" in r.flags else ""
            print(f"  {r.id:<10} {','.join(r.files)}{solo}")
    if skipped:
        print("\nHELD BACK")
        for r, w in skipped:
            print(f"  {r.id:<10} {w}")
    return 0


def cmd_conflicts(root: Path, cfg: dict, args) -> int:
    rows, _ = load_rows(root, cfg)
    files = repo_files(root, cfg)
    open_rows = [r for r in rows if r.is_open(cfg)]
    pairs = []
    for i, a in enumerate(open_rows):
        fa = expand(a.files, files)
        for b in open_rows[i + 1:]:
            if "tree" in a.flags or "tree" in b.flags:
                pairs.append({"a": a.id, "b": b.id,
                              "shared": ["<whole tree>"]})
                continue
            shared = sorted(fa & expand(b.files, files))
            if shared:
                pairs.append({"a": a.id, "b": b.id, "shared": shared})
    if args.json:
        print(json.dumps({"conflicts": pairs}, indent=1))
        return 0
    print(f"FOOTPRINT CONFLICTS among {len(open_rows)} open rows: {len(pairs)}")
    for p in pairs:
        print(f"  {p['a']:<10} x {p['b']:<10} {', '.join(p['shared'][:4])}")
    return 0


def cmd_audit(root: Path, cfg: dict, args) -> int:
    """Drift between the board and the repository."""
    rows, _ = load_rows(root, cfg)
    files = set(repo_files(root, cfg))
    churn = changed_since(root, cfg["churn_days"])
    findings: list[dict] = []

    for r in rows:
        # a footprint naming a concrete path that does not exist
        for g in r.files:
            g = g.replace("\\", "/")
            if any(ch in g for ch in "*?["):
                if not any(fnmatch.fnmatch(f, g) for f in files):
                    findings.append({"row": r.id, "kind": "phantom-glob",
                                     "detail": f"{g} matches no tracked file"})
            elif g not in files:
                findings.append({"row": r.id, "kind": "phantom-file",
                                 "detail": f"{g} is not a tracked file"})
        # done rows whose commit vanished
        if r.commit and not commit_exists(root, r.commit):
            findings.append({"row": r.id, "kind": "dead-commit",
                             "detail": r.commit})
        # THE P1.4 CLASS: an open row whose work appears to have already
        # shipped. P1.4 was dispatched against a fix that had landed three days
        # earlier because nothing compared the board to the log.
        if r.is_open(cfg):
            named = commits_naming(root, r.id)
            if named:
                findings.append({
                    "row": r.id, "kind": "stale-candidate",
                    "detail": f"still open, but {len(named)} commit(s) name it: "
                              + "; ".join(named[:2])})

    if args.json:
        print(json.dumps({"findings": findings}, indent=1))
        return 0
    print(f"BOARD AUDIT: {len(findings)} finding(s)")
    for f in findings:
        print(f"  {f['kind']:<16} {f['row']:<10} {f['detail']}")
    return 0


def cmd_coverage(root: Path, cfg: dict, args) -> int:
    """What has churn but no open row -- i.e. what the board MISSES."""
    rows, _ = load_rows(root, cfg)
    files = repo_files(root, cfg)
    churn = changed_since(root, cfg["churn_days"])
    claimed: set[str] = set()
    for r in rows:
        if r.is_open(cfg):
            claimed |= expand(r.files, files)

    roots = cfg.get("source_roots") or sorted(
        {f.split("/")[0] for f in files if "/" in f})
    report = []
    for area in roots:
        in_area = [f for f in files if f == area or f.startswith(area + "/")]
        if not in_area:
            continue
        ch = [f for f in in_area if f in churn]
        cl = [f for f in in_area if f in claimed]
        report.append({
            "area": area, "files": len(in_area), "changed": len(ch),
            "claimed_by_open_rows": len(cl),
            "unowned_churn": sorted(set(ch) - claimed)[:8],
        })

    if args.json:
        print(json.dumps({"areas": report,
                          "churn_days": cfg["churn_days"]}, indent=1))
        return 0
    print(f"COVERAGE -- churn window {cfg['churn_days']} days")
    print(f"  {'area':<22}{'files':>7}{'changed':>9}{'claimed':>9}  unowned churn")
    for a in report:
        flag = "  <-- churn, no open row" if a["unowned_churn"] and not a[
            "claimed_by_open_rows"] else ""
        print(f"  {a['area']:<22}{a['files']:>7}{a['changed']:>9}"
              f"{a['claimed_by_open_rows']:>9}{flag}")
        for f in a["unowned_churn"][:4]:
            print(f"  {'':<22}{'':>25}  {f}")
    return 0


def cmd_stats(root: Path, cfg: dict, args) -> int:
    """Process telemetry -- how the MACHINE is doing, not the product."""
    led = root / cfg["runs_ledger"]
    if not led.exists():
        print(f"no runs ledger yet ({cfg['runs_ledger']}).\n"
              "It fills as /work runs waves.")
        return 0
    recs = []
    for ln in led.read_text(encoding="utf-8").splitlines():
        ln = ln.strip()
        if ln:
            try:
                recs.append(json.loads(ln))
            except json.JSONDecodeError:
                pass
    rows_ = [r for r in recs if r.get("kind") == "row"]
    if not rows_:
        print("runs ledger has no row records yet.")
        return 0

    def digest(sample: list[dict]) -> dict:
        n = len(sample)
        waves = {(r.get("run"), r.get("wave")) for r in sample}
        return {
            "rows": n,
            "waves": len(waves),
            "per_wave": round(n / len(waves), 1) if waves else 0.0,
            "done": sum(1 for r in sample if r.get("outcome") == "done"),
            "repaired": sum(1 for r in sample if r.get("outcome") == "repaired"),
            "blocked": sum(1 for r in sample if r.get("outcome") == "blocked"),
            "rejected": sum(1 for r in sample if r.get("outcome") == "rejected"),
            "real": sum(1 for r in sample if r.get("redproof") == "real"),
            "hollow": sum(1 for r in sample if r.get("redproof") == "hollow"),
            "violations": sum(1 for r in sample if r.get("violation")),
        }

    # runs in the order they first appear in the ledger (it is append-only)
    order: list[str] = []
    for r in rows_:
        if r.get("run") not in order:
            order.append(r.get("run"))
    per_run = {rid: digest([r for r in rows_ if r.get("run") == rid])
               for rid in order}
    overall = digest(rows_)
    latest = per_run[order[-1]] if order else None
    prev = per_run[order[-2]] if len(order) > 1 else None

    if args.json:
        print(json.dumps({"overall": overall, "runs": order,
                          "per_run": per_run}, indent=1))
        return 0

    def delta(now: float, before, unit: str = "") -> str:
        """The comparison the /work report template asks for. Absent history is
        printed as 'first run', never as a fabricated baseline."""
        if before is None:
            return "  (first run)"
        d = now - before
        arrow = "+" if d > 0 else ""
        return f"  (prev {before}{unit}, {arrow}{round(d, 1)})"

    n = overall["rows"]
    print(f"PROCESS TELEMETRY -- {n} row-runs over {len(order)} run(s), "
          f"{overall['waves']} wave(s)")
    if latest:
        print(f"\nLATEST RUN  {order[-1]}")
        print(f"  rows/wave      {latest['per_wave']:>5}"
              + delta(latest["per_wave"], prev["per_wave"] if prev else None))
        for key, label in (("done", "shipped clean"), ("repaired", "repaired"),
                           ("blocked", "blocked"), ("rejected", "diff rejected")):
            share = (latest[key] * 100 // latest["rows"]) if latest["rows"] else 0
            pd = None
            if prev and prev["rows"]:
                pd = prev[key] * 100 // prev["rows"]
            print(f"  {label:<14} {latest[key]:>3} / {latest['rows']}"
                  f"  ({share}%)" + delta(share, pd, "%"))
        print(f"  red proofs     {latest['real']} real / "
              f"{latest['hollow']} hollow")

    print(f"\nALL RUNS")
    for key, label in (("done", "shipped clean"), ("repaired", "repaired"),
                       ("blocked", "blocked"), ("rejected", "diff rejected")):
        print(f"  {label:<14} {overall[key]:>4}  ({overall[key] * 100 // n}%)")
    print(f"  red proofs     {overall['real']} real / {overall['hollow']} hollow"
          + ("   <-- a hollow proof is a gate that never guarded anything"
             if overall["hollow"] else ""))
    if overall["violations"]:
        kinds: dict[str, int] = {}
        for r in rows_:
            if r.get("violation"):
                kinds[r["violation"]] = kinds.get(r["violation"], 0) + 1
        print(f"  RULE BREAKS    {overall['violations']:>4}  "
              + ", ".join(f"{k} x{v}" for k, v in sorted(kinds.items()))
              + "\n                 a worker breaking a rule is a brief or a "
                "tier problem, not a worker problem")
    by_tier: dict[str, dict[str, int]] = {}
    for r in rows_:
        t = by_tier.setdefault(r.get("tier", "?"),
                               {"n": 0, "clean": 0, "broke": 0})
        t["n"] += 1
        t["clean"] += 1 if r.get("outcome") == "done" else 0
        t["broke"] += 1 if r.get("violation") else 0
    print("  by tier:")
    for t, v in sorted(by_tier.items()):
        print(f"    [{t}] {v['clean']}/{v['n']} shipped clean first pass"
              + (f", {v['broke']} rule break(s)" if v["broke"] else ""))
    return 0


def cmd_new(root: Path, cfg: dict, args) -> int:
    """Write a new row, header and prose, into a board file.

    It DEMANDS `--accept` and `--redproof` rather than writing placeholders.
    A skeleton that says "Accept: TODO" satisfies the prose duty vacuously,
    which is worse than no check: the lint goes quiet about the one thing it
    was built to ask. If you cannot say what proves the row works and what you
    would break to watch it fail, the row is not ready to exist.
    """
    rows, problems = load_rows(root, cfg)
    if any(p.level == "error" for p in problems):
        print("board: REFUSING to add a row -- the board does not parse.\n"
              "       run `python tools/board.py lint` first.", file=sys.stderr)
        return 2
    if any(r.id == args.id for r in rows):
        print(f"row {args.id!r} already exists", file=sys.stderr)
        return 1
    if not re.match(cfg["row_id_pattern"], args.id):
        print(f"id {args.id!r} does not match this project's row_id_pattern "
              f"({cfg['row_id_pattern']}) -- it would be invisible to every "
              f"query", file=sys.stderr)
        return 1
    for t in re.split(r"[/,]", args.tier):
        if t.strip() and t.strip() not in cfg["tiers"]:
            print(f"tier {t.strip()!r} is not one of {cfg['tiers']}",
                  file=sys.stderr)
            return 1
    for d in split_list(args.deps):
        if d not in {r.id for r in rows}:
            print(f"dep {d!r} is not a row", file=sys.stderr)
            return 1

    target = args.board or (cfg["boards"][0]["path"] if cfg["boards"] else None)
    if not target:
        print("no board file to write to", file=sys.stderr)
        return 1
    path = root / target
    if not path.exists():
        print(f"board file missing: {target}", file=sys.stderr)
        return 1

    parts = [f"id={args.id}", f"tier={args.tier}", f"status={args.status}"]
    if args.lane:
        parts.append(f"lane={args.lane}")
    if args.deps:
        parts.append(f"deps={args.deps}")
    if args.flags:
        parts.append(f"flags={args.flags}")
    parts.append(f"files={args.files}")
    block = (f"<!--row {' '.join(parts)}-->\n"
             f"**{args.id} [{args.tier}] {args.title}** {args.body}\n"
             f"Accept: {args.accept}\n"
             f"Red proof: {args.redproof}\n")

    text = path.read_text(encoding="utf-8")
    if args.after:
        anchor = [r for r in rows if r.id == args.after]
        if not anchor:
            print(f"--after {args.after!r} is not a row", file=sys.stderr)
            return 1
        lines = text.splitlines()
        a = anchor[0]
        k = a.body_end              # end of X's WHOLE block, not its first
                                     # paragraph -- inserting mid-block would
                                     # strand X's later paragraphs (and its
                                     # Accept/Red proof) below the new row,
                                     # where they read as the new row's oracle.
        insert: list[str] = []
        if k > 0 and lines[k - 1].strip():
            insert.append("")       # X's block wasn't already blank-terminated
        insert.extend(block.rstrip("\n").split("\n"))
        if k < len(lines):
            insert.append("")       # keep the blank line before whatever follows
        lines[k:k] = insert
        text = "\n".join(lines) + "\n"
    else:
        text = text.rstrip("\n") + "\n\n" + block

    path.write_text(text, encoding="utf-8")
    print(f"{args.id} added to {target}"
          + (f" after {args.after}" if args.after else " (end of file)"))
    print("  " + " ".join(parts))
    print("  now run: python tools/board.py lint")
    return 0


def cmd_log(root: Path, cfg: dict, args) -> int:
    """Append one row-run record to the telemetry ledger.

    The friction ledger is full of anecdotes about how waves go and holds not a
    single count. `stats` can only answer "how is the machine doing" if
    something writes the rows -- so /work calls this once per row it judges,
    win or lose. `rejected` and `hollow` are the two that matter most: they are
    the ones a run is tempted not to record.
    """
    led = root / cfg["runs_ledger"]
    led.parent.mkdir(parents=True, exist_ok=True)
    rec = {"kind": "row", "run": args.run, "wave": args.wave, "row": args.row,
           "tier": args.tier, "outcome": args.outcome}
    if args.redproof:
        rec["redproof"] = args.redproof
    if args.violation:
        rec["violation"] = args.violation
    if args.note:
        rec["note"] = args.note
    with led.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(rec) + "\n")
    print(f"logged {args.row} {args.outcome}"
          + (f" redproof={args.redproof}" if args.redproof else ""))
    return 0


def cmd_show(root: Path, cfg: dict, args) -> int:
    rows, _ = load_rows(root, cfg)
    hit = [r for r in rows if r.id == args.id]
    if not hit:
        print(f"no row {args.id!r}", file=sys.stderr)
        return 1
    r = hit[0]
    if args.json:
        print(json.dumps({**r.as_dict(), "body": r.body}, indent=1))
        return 0
    print(f"{r.id}  [{r.tier}]  status={r.status}  lane={r.lane or '-'}")
    print(f"  deps:   {', '.join(r.deps) or '-'}")
    print(f"  files:  {', '.join(r.files) or '-'}")
    print(f"  flags:  {', '.join(r.flags) or '-'}")
    print(f"  commit: {r.commit or '-'}")
    print(f"  at:     {r.path}:{r.opener_line}\n")
    print(r.body)
    return 0


def cmd_set(root: Path, cfg: dict, args) -> int:
    """Rewrite one row's header in place, preserving field order."""
    rows, _ = load_rows(root, cfg)
    hit = [r for r in rows if r.id == args.id]
    if not hit:
        print(f"no row {args.id!r}", file=sys.stderr)
        return 1
    r = hit[0]
    updates = {}
    for kv in args.kv:
        if "=" not in kv:
            print(f"bad k=v: {kv!r}", file=sys.stderr)
            return 1
        k, v = kv.split("=", 1)
        updates[k] = v

    p = root / r.path
    lines = p.read_text(encoding="utf-8").splitlines()
    idx = r.header_line - 1
    inline = r.header_line == r.opener_line
    m = TRAILING_RE.search(lines[idx]) if inline else HEADER_RE.match(lines[idx])
    if not m:
        print(f"{r.id}: header moved -- re-run lint", file=sys.stderr)
        return 1
    fields, _ = parse_header(m.group("body"))
    order = list(fields.keys())
    fields.update(updates)
    for k in updates:
        if k not in order:
            order.append(k)
    body = " ".join(f"{k}={fields[k]}" for k in order)
    new_header = f"<!--row {body}-->"
    if inline:
        lines[idx] = TRAILING_RE.sub("", lines[idx]).rstrip() + " " + new_header
    else:
        lines[idx] = new_header
    p.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"{r.id}: " + ", ".join(f"{k}={v}" for k, v in updates.items()))
    return 0


def cmd_validate(root: Path, cfg: dict, args) -> int:
    """Derive the vitest --exclude list from rows currently in flight.

    Gap this closes (retrospective, mr-run1): four times the full validate
    ladder went red only because a worker's in-flight test file was mid-edit
    while the foreman validated a FINISHED row, and each time the foreman
    re-ran with a hand-typed --exclude list. This reads the board instead of
    a human's memory: any test file inside a status=doing row's footprint is
    excluded; a done row contributes nothing.

    This command only DERIVES the list -- it never runs the validate
    commands itself.
    """
    rows, problems = load_rows(root, cfg)
    if any(p.level == "error" for p in problems):
        print("board: REFUSING to answer -- the board does not parse cleanly.\n"
              "       run `python tools/board.py lint` first.", file=sys.stderr)
        return 2

    excluded: set[str] = set()
    in_flight = [r for r in rows if r.status == "doing"]
    if args.exclude_in_flight:
        for r in in_flight:
            for f in expand_working_tree(root, r.files):
                if is_test_file(f):
                    excluded.add(f.replace("\\", "/"))

    result = sorted(excluded)
    if args.json:
        print(json.dumps(result, indent=1))
    else:
        for f in result:
            print(f"--exclude {f}")
    print(f"validate: {len(in_flight)} in-flight row(s), {len(result)} test "
          f"file(s) excluded", file=sys.stderr)
    return 0


# --------------------------------------------------------------------------

def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(prog="board.py", description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--root", default=".", help="repo root (default: discover)")
    sub = ap.add_subparsers(dest="cmd", required=True)

    sub.add_parser("lint", help="schema + pairing + drift checks")
    sub.add_parser("ready", help="what is dispatchable now, and why not")
    w = sub.add_parser("wave", help="a maximal disjoint set of ready rows")
    w.add_argument("--max", type=int, default=None,
                   help="override board.config.json work.max_workers for this pick")
    w.add_argument("--exclude", default="",
                   help="row ids to hold back on THIS pick only, comma-"
                        "separated. For 'ready, but not this wave' -- the "
                        "exclusion is printed, never written to the board.")
    sub.add_parser("conflicts", help="footprint overlap among open rows")
    sub.add_parser("audit", help="board-vs-repo drift")
    sub.add_parser("coverage", help="churn with no open row")
    sub.add_parser("stats", help="process telemetry")
    nw = sub.add_parser("new", help="write a new row (header + prose)")
    nw.add_argument("id")
    nw.add_argument("--title", required=True)
    nw.add_argument("--tier", required=True)
    nw.add_argument("--files", required=True,
                    help="footprint globs, comma-separated. Err WIDE: too wide "
                         "costs parallelism, too narrow permits a collision.")
    nw.add_argument("--accept", required=True,
                    help="what proves it works. Not optional, and not 'TODO'.")
    nw.add_argument("--redproof", required=True,
                    help="what you break to watch the check fail.")
    nw.add_argument("--body", default="")
    nw.add_argument("--deps", default="")
    nw.add_argument("--lane", default="")
    nw.add_argument("--flags", default="")
    nw.add_argument("--status", default="todo")
    nw.add_argument("--board", default="", help="which board file (default: the first)")
    nw.add_argument("--after", default="", help="insert after this row id")
    lg = sub.add_parser("log", help="record one row-run in the telemetry ledger")
    lg.add_argument("--run", required=True, help="run id, e.g. 2026-08-08-a")
    lg.add_argument("--wave", type=int, default=0)
    lg.add_argument("--row", required=True)
    lg.add_argument("--tier", default="")
    lg.add_argument("--outcome", required=True,
                    choices=["done", "repaired", "blocked", "rejected",
                             "rebriefed"],
                    help="`repaired` = it shipped, but the dispatcher had to "
                         "fix something the worker got wrong. Distinct from "
                         "`done` on purpose: logging a repair as done makes a "
                         "tier look cleaner than it is, which is exactly the "
                         "signal you need to re-tier or rewrite the brief.")
    lg.add_argument("--redproof", default="", choices=["", "real", "hollow", "none"])
    lg.add_argument("--violation", default="",
                    help="a rule the worker broke, e.g. 'footprint'. Counted "
                         "separately by `stats` -- it is the number that tells "
                         "you a tier is being over-trusted.")
    lg.add_argument("--note", default="")
    s = sub.add_parser("show", help="one row")
    s.add_argument("id")
    st = sub.add_parser("set", help="rewrite a row header")
    st.add_argument("id")
    st.add_argument("kv", nargs="+", metavar="k=v")
    vd = sub.add_parser("validate", help="derive the vitest --exclude list "
                        "from in-flight (status=doing) rows' footprints")
    vd.add_argument("--exclude-in-flight", action="store_true",
                    help="print one `--exclude <path>` per test file inside "
                         "a status=doing row's footprint; done rows "
                         "contribute nothing")

    args = ap.parse_args(argv)

    # The board is prose: em-dashes, arrows, >=. A Windows console defaults to
    # cp1252 and dies on all of them, which would make `show` unusable on the
    # only machine this runs on. Say UTF-8 out loud rather than hope.
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass

    root = repo_root(Path(args.root))
    cfg = load_config(root)

    fn = {
        "lint": cmd_lint, "ready": cmd_ready, "wave": cmd_wave,
        "conflicts": cmd_conflicts, "audit": cmd_audit,
        "coverage": cmd_coverage, "stats": cmd_stats, "log": cmd_log,
        "new": cmd_new, "show": cmd_show, "set": cmd_set,
        "validate": cmd_validate,
    }[args.cmd]
    return fn(root, cfg, args)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
