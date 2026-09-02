#!/usr/bin/env python3
"""test_board.py -- red proofs for the board machine.

Every test here plants a defect and asserts the tool CATCHES it. A checker that
has never been seen to fail proves nothing (CODING-PRACTICES 1.1), and this
tool's whole value is that it refuses to report a number it cannot stand behind
-- so the most important test is the one proving it cannot silently skip a row.

    python tools/test_board.py
"""

from __future__ import annotations

import io
import json
import sys
import tempfile
from contextlib import redirect_stdout, redirect_stderr
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import board  # noqa: E402

CFG = {
    **board.DEFAULT_CONFIG,
    "boards": [{"path": "b.md", "src": "test"}],
    "row_id_pattern": r"^(P\d+\.\d+|X-\d+)$",
    "source_roots": ["src"],
}

PASS = FAIL = 0
FAILURES: list[str] = []


def check(name: str, cond: bool, detail: str = "") -> None:
    global PASS, FAIL
    if cond:
        PASS += 1
    else:
        FAIL += 1
        FAILURES.append(f"{name}: {detail}")


def board_with(text: str) -> tuple[Path, dict]:
    d = Path(tempfile.mkdtemp(prefix="boardtest_"))
    (d / "b.md").write_text(text, encoding="utf-8")
    return d, dict(CFG)


def lint_of(text: str) -> dict:
    root, cfg = board_with(text)
    args = type("A", (), {"json": True})()
    buf = io.StringIO()
    with redirect_stdout(buf), redirect_stderr(io.StringIO()):
        board.cmd_lint(root, cfg, args)
    return json.loads(buf.getvalue())


def msgs(res: dict, level: str = "errors") -> str:
    return " | ".join(p["msg"] for p in res[level])


GOOD = """# board

<!--row id=P1.1 tier=S status=todo files=src/a.gd-->
**P1.1 [S] A thing.** Accept: it works. Red proof: break it, watch it fail.
"""


# --- 1. the happy path parses -------------------------------------------------
r = lint_of(GOOD)
check("parses a well-formed row", r["rows"] == 1, f"rows={r['rows']}")
check("well-formed row is clean", not r["errors"], msgs(r))


# --- 2. THE CENTRAL CLAIM: a row-shaped opener with no header is an ERROR -----
# If this ever passes silently, every count this tool prints is a lie.
r = lint_of(GOOD + """
**P1.2 [S] An unheadered row.** Accept: nothing. Red proof: none.
""")
check("unheadered row-shaped opener is CAUGHT",
      any("NO <!--row--> header" in p["msg"] for p in r["errors"]),
      f"errors={msgs(r)}")

# ...and a NON-row-shaped bold opener is correctly ignored (no false positive)
r = lint_of(GOOD + """
**MODEL ROUTING** (standing rule): each row carries a tier.
""")
check("non-row bold text is not mistaken for a row",
      not any("NO <!--row-->" in p["msg"] for p in r["errors"]), msgs(r))


# --- 2b. NESTED rows: a header trailing a list item --------------------------
# A comment line BETWEEN bullets splits the markdown list, so a nested sub-row
# carries its header at the end of its own line instead. Both forms are rows.
NESTED = """# board

<!--row id=P1.1 tier=O status=todo files=src/a.gd-->
**P1.1 [O] A phase with sub-rows.** Accept: children ship. Red proof: n/a.

- **P1.1a [O] First child.** Accept: x. Red proof: y. <!--row id=P1.1a tier=O status=todo files=src/x.gd-->
- **P1.1b [S] Second child.** Accept: x. Red proof: y. <!--row id=P1.1b tier=S status=todo files=src/y.gd-->
"""
CFG_NESTED = {**CFG, "row_id_pattern": r"^(P\d+\.\d+[a-z]?|X-\d+)$"}


def lint_with(text: str, cfg: dict) -> dict:
    root, c = board_with(text)
    c.update(cfg)
    a = type("A", (), {"json": True})()
    buf = io.StringIO()
    with redirect_stdout(buf), redirect_stderr(io.StringIO()):
        board.cmd_lint(root, c, a)
    return json.loads(buf.getvalue())


r = lint_with(NESTED, CFG_NESTED)
check("nested list rows are parsed", r["rows"] == 3, f"rows={r['rows']}")
check("nested rows are clean", not r["errors"], msgs(r))

# and an UNHEADERED nested row is still caught -- the guarantee must not have a
# hole the moment rows are allowed to nest
r = lint_with(NESTED + "- **P1.1c [S] An unheadered child.** Accept: x.\n",
              CFG_NESTED)
check("unheadered NESTED row is CAUGHT",
      any("NO <!--row--> header" in p["msg"] for p in r["errors"]), msgs(r))

# nested rows dispatch independently of their parent
root, c = board_with(NESTED)
c.update(CFG_NESTED)
rws, _ = board.load_rows(root, c)
rdy, _ = board.readiness(rws, c)
wv, _ = board.pick_wave(rdy, [], 3)
check("parent and children are all independently dispatchable",
      [x.id for x in wv] == ["P1.1", "P1.1a", "P1.1b"], f"wave={[x.id for x in wv]}")

# `set` on a nested row edits the inline header and leaves the prose alone
a = type("A", (), {"json": False, "id": "P1.1a", "kv": ["status=doing"]})()
with redirect_stdout(io.StringIO()):
    board.cmd_set(root, c, a)
after = (root / "b.md").read_text(encoding="utf-8")
check("`set` rewrites an INLINE header in place",
      "id=P1.1a tier=O status=doing" in after, after)
check("`set` on a nested row keeps its bullet and prose",
      "- **P1.1a [O] First child.** Accept: x. Red proof: y. <!--row" in after,
      after)


# --- 3. duplicate ids ---------------------------------------------------------
r = lint_of(GOOD + """
<!--row id=P1.1 tier=H status=todo files=src/b.gd-->
**P1.1 [H] Same id again.** Accept: x. Red proof: y.
""")
check("duplicate id is CAUGHT",
      any("duplicate id" in p["msg"] for p in r["errors"]), msgs(r))


# --- 4. header id must match the opener --------------------------------------
r = lint_of("""<!--row id=P1.1 tier=S status=todo files=src/a.gd-->
**P1.9 [S] Mismatched.** Accept: x. Red proof: y.
""")
check("header/opener id mismatch is CAUGHT",
      any("row opener says" in p["msg"] for p in r["errors"]), msgs(r))


# --- 5. done rows must carry a commit ----------------------------------------
r = lint_of("""<!--row id=P1.1 tier=S status=done-->
**P1.1 [S] DONE already.** Shipped.
""")
check("status=done with no commit is CAUGHT",
      any("no commit=" in p["msg"] for p in r["errors"]), msgs(r))


# --- 6. THE DRIFT CHECK ------------------------------------------------------
# This is what makes it safe to hide the header in an HTML comment: prose and
# header can never disagree without the build going red.
r = lint_of("""<!--row id=P1.1 tier=S status=todo files=src/a.gd-->
**P1.1 [S] DONE 2026-08-08.** Accept: x. Red proof: y.
""")
check("prose says DONE, header says todo -> CAUGHT",
      any("prose says DONE" in p["msg"] for p in r["errors"]), msgs(r))

# The reverse direction is DELIBERATELY not flagged. The header owns status;
# the prose is the story. Warning here would sit unpayable next to every
# shipped row, and a warning nobody can clear hides the ones that matter.
r = lint_of("""<!--row id=P1.1 tier=S status=done commit=deadbeef-->
**P1.1 [S] A quiet finished row.** It happened.
""")
check("header done + silent prose is NOT flagged",
      not any("prose" in p["msg"] for p in r["errors"] + r["warnings"]),
      msgs(r) + " / " + msgs(r, "warnings"))


# --- 7. schema violations -----------------------------------------------------
r = lint_of("""<!--row id=P1.1 tier=Q status=todo files=src/a.gd-->
**P1.1 [Q] Bad tier.** Accept: x. Red proof: y.
""")
check("unknown tier is CAUGHT",
      any("tier 'Q' unknown" in p["msg"] for p in r["errors"]), msgs(r))

r = lint_of("""<!--row id=P1.1 tier=S status=maybe files=src/a.gd-->
**P1.1 [S] Bad status.** Accept: x. Red proof: y.
""")
check("unknown status is CAUGHT",
      any("is not one of" in p["msg"] for p in r["errors"]), msgs(r))

r = lint_of("""<!--row id=P1.1 tier=S status=todo deps=P9.9 files=src/a.gd-->
**P1.1 [S] Phantom dep.** Accept: x. Red proof: y.
""")
check("dep on a non-existent row is CAUGHT",
      any("is not a row" in p["msg"] for p in r["errors"]), msgs(r))

r = lint_of("""<!--row id=P1.1 tier=S status=todo-->
**P1.1 [S] No footprint.** Accept: x. Red proof: y.
""")
check("open row with no footprint is warned",
      any("never be dispatched" in p["msg"] for p in r["warnings"]),
      msgs(r, "warnings"))


# --- 8. readiness -------------------------------------------------------------
def rows_of(text: str) -> list[board.Row]:
    root, cfg = board_with(text)
    rows, _ = board.load_rows(root, cfg)
    return rows


rows = rows_of("""<!--row id=P1.1 tier=S status=done commit=a-->
**P1.1 [S] DONE.** done

<!--row id=P1.2 tier=S status=todo deps=P1.1 files=src/b.gd-->
**P1.2 [S] Depends on a finished row.** Accept: x. Red proof: y.

<!--row id=P1.3 tier=S status=todo deps=P1.2 files=src/c.gd-->
**P1.3 [S] Depends on an unfinished row.** Accept: x. Red proof: y.

<!--row id=P1.4 tier=O status=todo flags=owner files=src/d.gd-->
**P1.4 [O] Owner-blocked.** Accept: x. Red proof: y.

<!--row id=P1.5 tier=O status=todo flags=dg files=src/e.gd-->
**P1.5 [O] Designer-gated.** Accept: x. Red proof: y.
""")
ready, blocked = board.readiness(rows, CFG)
ready_ids = [r.id for r in ready]
why = {r.id: w for r, w in blocked}

check("satisfied dep -> ready", ready_ids == ["P1.2"], f"ready={ready_ids}")
check("unmet dep -> not ready, with reason",
      "P1.2 is todo" in why.get("P1.3", ""), f"why={why}")
check("owner flag -> not ready", "owner-blocked" in why.get("P1.4", ""), f"{why}")
check("designer gate -> not ready",
      "designer gate" in why.get("P1.5", ""), f"{why}")
check("done rows are not offered", "P1.1" not in ready_ids and "P1.1" not in why)


# --- 8b. PHASE GATING: the plan's dependency law, not a memory test ----------
PHASED = """<!--row id=P4.1 tier=O status=todo files=src/a.gd-->
**P4.1 [O] An unfinished P4 row.** Accept: x. Red proof: y.

<!--row id=P5.1 tier=O status=todo files=src/b.gd-->
**P5.1 [O] A P5 row that must wait for P4.** Accept: x. Red proof: y.

<!--row id=P4.2 tier=S status=done commit=abc-->
**P4.2 [S] A finished P4 row.** DONE.
"""
CFG_PHASE = {**CFG, "row_id_pattern": r"^P\d+\.\d+$",
             "phase_pattern": r"^(P\d+)", "phase_deps": {"P5": ["P4"]}}

root, c = board_with(PHASED)
c.update(CFG_PHASE)
rws, _ = board.load_rows(root, c)
rdy, blk = board.readiness(rws, c)
w = {r.id: reason for r, reason in blk}
check("a row waits while its prerequisite phase owes work",
      [r.id for r in rdy] == ["P4.1"], f"ready={[r.id for r in rdy]}")
check("the phase gate names what it is waiting on",
      "phase P4 still owes 1 row(s)" in w.get("P5.1", ""), f"why={w}")

# ...and it opens the moment the prerequisite phase is clear
PHASED_CLEAR = PHASED.replace(
    "<!--row id=P4.1 tier=O status=todo files=src/a.gd-->",
    "<!--row id=P4.1 tier=O status=done commit=abc-->").replace(
    "**P4.1 [O] An unfinished P4 row.** Accept: x. Red proof: y.",
    "**P4.1 [O] A finished P4 row.** DONE.")
root, c = board_with(PHASED_CLEAR)
c.update(CFG_PHASE)
rws, _ = board.load_rows(root, c)
rdy, _ = board.readiness(rws, c)
check("the phase gate opens when the prerequisite phase is clear",
      [r.id for r in rdy] == ["P5.1"], f"ready={[r.id for r in rdy]}")

# a phase alias re-points oddly-named rows at their real phase
root, c = board_with("""<!--row id=P1.1 tier=S status=todo files=src/a.gd-->
**P1.1 [S] A row whose phase is aliased.** Accept: x. Red proof: y.
""")
c.update({**CFG, "row_id_pattern": r"^P\d+\.\d+$",
          "phase_pattern": r"^(P\d+)", "phase_alias": {"P1": "P2"}})
rws, _ = board.load_rows(root, c)
check("phase_alias re-points a row's phase",
      rws[0].phase == "P2", f"phase={rws[0].phase}")


# --- 9. wave picking: the rules the prose asked a human to remember ----------
rows = rows_of("""<!--row id=P1.1 tier=S status=todo files=src/a.gd,src/shared.gd-->
**P1.1 [S] One.** Accept: x. Red proof: y.

<!--row id=P1.2 tier=S status=todo files=src/shared.gd-->
**P1.2 [S] Clashes with P1.1.** Accept: x. Red proof: y.

<!--row id=P1.3 tier=H status=todo files=src/c.gd-->
**P1.3 [H] Disjoint.** Accept: x. Red proof: y.
""")
ready, _ = board.readiness(rows, CFG)
wave, held = board.pick_wave(ready, [], 3)
ids = [r.id for r in wave]
check("overlapping footprints never share a wave",
      ids == ["P1.1", "P1.3"], f"wave={ids}")
check("the clash names its blocker",
      any("clash with P1.1" in w for _, w in held), f"held={held}")

# a whole-tree claimant (a blind run, a full sweep) runs SOLO
rows = rows_of("""<!--row id=P1.1 tier=S status=todo flags=tree files=.-->
**P1.1 [S] A blind run -- read-locks the tree.** Accept: x. Red proof: y.

<!--row id=P1.2 tier=S status=todo files=src/b.gd-->
**P1.2 [S] A writer.** Accept: x. Red proof: y.
""")
ready, _ = board.readiness(rows, CFG)
wave, held = board.pick_wave(ready, [], 3)
check("a tree claimant takes the wave alone",
      [r.id for r in wave] == ["P1.1"], f"wave={[r.id for r in wave]}")
check("the writer is held with a reason",
      any("whole-tree claimant" in w for _, w in held), f"held={held}")

# ...and it is held back if a writer already holds the wave
rows = rows_of("""<!--row id=P1.1 tier=S status=todo files=src/b.gd-->
**P1.1 [S] A writer, listed first.** Accept: x. Red proof: y.

<!--row id=P1.2 tier=S status=todo flags=tree files=.-->
**P1.2 [S] A blind run.** Accept: x. Red proof: y.
""")
ready, _ = board.readiness(rows, CFG)
wave, held = board.pick_wave(ready, [], 3)
check("a tree claimant never joins an occupied wave",
      [r.id for r in wave] == ["P1.1"] and any("run solo" in w for _, w in held),
      f"wave={[r.id for r in wave]} held={held}")

# a footprintless row can never be proven disjoint, so it never dispatches
rows = rows_of("""<!--row id=P1.1 tier=S status=todo-->
**P1.1 [S] No files declared.** Accept: x. Red proof: y.
""")
ready, _ = board.readiness(rows, CFG)
wave, held = board.pick_wave(ready, [], 3)
check("a footprintless row is never dispatched",
      not wave and any("cannot be proven disjoint" in w for _, w in held),
      f"wave={[r.id for r in wave]} held={held}")

# --exclude: "ready, but not this wave", stated rather than hidden in a status
rows = rows_of("""<!--row id=P1.1 tier=S status=todo flags=tree files=.-->
**P1.1 [S] A solo investigation, ready but not for today.** Accept: x. Red proof: y.

<!--row id=P1.2 tier=S status=todo files=src/b.gd-->
**P1.2 [S] The work I actually want to run.** Accept: x. Red proof: y.
""")
ready, _ = board.readiness(rows, CFG)
wave, held = board.pick_wave(ready, [], 3)
check("without --exclude the tree claimant still takes the wave",
      [r.id for r in wave] == ["P1.1"], f"{[r.id for r in wave]}")
wave, held = board.pick_wave(ready, [], 3, ["P1.1"])
check("--exclude defers a ready row without touching its status",
      [r.id for r in wave] == ["P1.2"], f"{[r.id for r in wave]}")
check("the exclusion is STATED, not silent",
      any("excluded BY HAND" in w for r, w in held if r.id == "P1.1"),
      f"held={held}")
check("--exclude does not mutate the row",
      rows[0].status == "todo" and "tree" in rows[0].flags,
      f"status={rows[0].status} flags={rows[0].flags}")

# the max is respected
rows = rows_of("".join(
    f"<!--row id=P1.{i} tier=S status=todo files=src/{i}.gd-->\n"
    f"**P1.{i} [S] Row {i}.** Accept: x. Red proof: y.\n\n" for i in range(1, 6)))
ready, _ = board.readiness(rows, CFG)
wave, held = board.pick_wave(ready, [], 3)
check("wave respects --max", len(wave) == 3, f"wave={len(wave)}")
check("rows past the max are held with a reason",
      any("already at max" in w for _, w in held), f"held={held}")


# --- 9c. a row ALREADY IN FLIGHT still owns its files ------------------------
# readiness() drops status=doing from `ready`, and for a long time that was the
# whole story -- so the in-flight row's footprint was never claimed and the
# picker would hand a worker a file the foreman was mid-edit in. Observed live
# 2026-08-09: with P13.1 (sim/creature_needs.gd) out, the wave offered P4.2 and
# then P4.3, both claiming that same file.
rows = rows_of("""<!--row id=P1.1 tier=O status=doing files=src/hot.gd,src/led.md-->
**P1.1 [O] The foreman is editing this right now.** Accept: x. Red proof: y.

<!--row id=P1.2 tier=S status=todo files=src/hot.gd,src/other.gd-->
**P1.2 [S] Claims the same hot file.** Accept: x. Red proof: y.

<!--row id=P1.3 tier=S status=todo files=src/safe.gd-->
**P1.3 [S] Genuinely disjoint.** Accept: x. Red proof: y.
""")
ready, _ = board.readiness(rows, CFG)
flight = [r for r in rows if r.status == "doing"]
check("readiness still drops the in-flight row itself",
      [r.id for r in ready] == ["P1.2", "P1.3"], f"ready={[r.id for r in ready]}")
wave, held = board.pick_wave(ready, [], 3, None, flight)
check("a row clashing with work in flight is HELD",
      [r.id for r in wave] == ["P1.3"], f"wave={[r.id for r in wave]}")
check("the clash names the IN-FLIGHT row as its owner",
      any("clash with P1.1" in w for r, w in held if r.id == "P1.2"),
      f"held={held}")
# RED PROOF: drop the in_flight argument and the same board hands out the file.
# If this ever starts passing, the parameter has stopped doing the work.
wave_blind, _ = board.pick_wave(ready, [], 3)
check("RED PROOF -- without in_flight the picker DOES offer the held file",
      [r.id for r in wave_blind] == ["P1.2", "P1.3"],
      f"wave={[r.id for r in wave_blind]}")

# an in-flight WHOLE-TREE claimant owns everything, including a fresh tree row
rows = rows_of("""<!--row id=P1.1 tier=O status=doing flags=tree files=.-->
**P1.1 [O] A blind run, already out.** Accept: x. Red proof: y.

<!--row id=P1.2 tier=S status=todo files=src/b.gd-->
**P1.2 [S] A writer.** Accept: x. Red proof: y.

<!--row id=P1.3 tier=S status=todo flags=tree files=.-->
**P1.3 [S] Another sweep.** Accept: x. Red proof: y.
""")
ready, _ = board.readiness(rows, CFG)
flight = [r for r in rows if r.status == "doing"]
wave, held = board.pick_wave(ready, [], 3, None, flight)
check("nothing dispatches under an in-flight tree claimant",
      not wave, f"wave={[r.id for r in wave]}")
check("a second tree claimant does not slip in on an empty wave",
      any("run solo" in w for r, w in held if r.id == "P1.3"), f"held={held}")

# ...and the REVERSE: an ORDINARY row in flight must hold a ready TREE row.
# Observed live 2026-08-10 (P-TOOL-15): with three doing rows out, `wave`
# offered P1.13 [SOLO] -- a tree-claiming run over live writers, the launch
# that had to be killed twice the day the rule was written. The tree branch
# checked only `chosen` and `tree_taken`, never whether in-flight rows had
# files claimed.
rows = rows_of("""<!--row id=P1.1 tier=O status=doing files=src/hot.gd-->
**P1.1 [O] An ordinary writer, mid-edit.** Accept: x. Red proof: y.

<!--row id=P1.2 tier=S status=todo flags=tree files=.-->
**P1.2 [S] A full sweep, ready.** Accept: x. Red proof: y.
""")
ready, _ = board.readiness(rows, CFG)
flight = [r for r in rows if r.status == "doing"]
wave, held = board.pick_wave(ready, [], 3, None, flight)
check("a ready tree claimant is HELD while any ordinary row is in flight",
      not wave, f"wave={[r.id for r in wave]}")
check("the hold NAMES the in-flight owner",
      any(r.id == "P1.2" and "P1.1" in w for r, w in held), f"held={held}")


# --- 9b. the STALE-ROW check must be a signal, not a smoke alarm -------------
# Its first version flagged "every file in this open row's footprint changed
# recently", which in any active repo is nearly every row -- it lit up all five
# rows of a repo thirty seconds old. The real signal is that work LABELLED as
# this row has already shipped while the row still reads open (the P1.4 class).
import subprocess  # noqa: E402

sb = Path(tempfile.mkdtemp(prefix="boardstale_"))
(sb / "docs").mkdir()
(sb / "src").mkdir()


def sh(*a):
    subprocess.run(["git", "-C", str(sb), *a], capture_output=True, text=True)


sh("init", "-q")
sh("config", "user.email", "t@t")
sh("config", "user.name", "t")
(sb / "src" / "a.py").write_text("x\n", encoding="utf-8")
(sb / "src" / "b.py").write_text("x\n", encoding="utf-8")
(sb / "docs" / "b.md").write_text(
    "<!--row id=X-1 tier=S status=todo files=src/a.py-->\n"
    "**X-1 [S] Already shipped, still open.** Accept: x. Red proof: y.\n\n"
    "<!--row id=X-2 tier=S status=todo files=src/b.py-->\n"
    "**X-2 [S] Genuinely outstanding.** Accept: x. Red proof: y.\n",
    encoding="utf-8")
sh("add", "-A")
sh("commit", "-qm", "X-1: paginate the endpoint")   # names X-1, not X-2

cfg_stale = {**CFG, "boards": [{"path": "docs/b.md", "src": "t"}],
             "row_id_pattern": r"^X-\d+$"}
a = type("A", (), {"json": True})()
buf = io.StringIO()
with redirect_stdout(buf), redirect_stderr(io.StringIO()):
    board.cmd_audit(sb, cfg_stale, a)
res = json.loads(buf.getvalue())
stale = [f["row"] for f in res["findings"] if f["kind"] == "stale-candidate"]
check("a row whose work already shipped under its name is flagged",
      "X-1" in stale, f"stale={stale}")
check("a genuinely outstanding row is NOT flagged",
      "X-2" not in stale, f"stale={stale} (a check that flags everything "
                          f"flags nothing)")

# the id match must not be a loose substring: X-1 must not match X-10
sh("commit", "-q", "--allow-empty", "-m", "X-10: a different row entirely")
buf = io.StringIO()
with redirect_stdout(buf), redirect_stderr(io.StringIO()):
    board.cmd_audit(sb, cfg_stale, a)
res = json.loads(buf.getvalue())
x1 = [f for f in res["findings"]
      if f["row"] == "X-1" and f["kind"] == "stale-candidate"]
check("X-10 does not count as a mention of X-1",
      bool(x1) and "X-10" not in x1[0]["detail"], f"{x1}")


# --- 10. a board that does not parse must REFUSE to answer -------------------
root, cfg = board_with("""<!--row id=P1.1 tier=S status=todo files=src/a.gd-->
**P1.1 [S] Fine.** Accept: x. Red proof: y.

**P1.2 [S] Unheadered -- the board is now untrustworthy.** Accept: x.
""")
args = type("A", (), {"json": False, "max": 3})()
buf, err = io.StringIO(), io.StringIO()
with redirect_stdout(buf), redirect_stderr(err):
    rc_ready = board.cmd_ready(root, cfg, args)
    rc_wave = board.cmd_wave(root, cfg, args)
check("`ready` REFUSES on an unparseable board (exit 2)",
      rc_ready == 2 and "REFUSING" in err.getvalue(), f"rc={rc_ready}")
check("`wave` REFUSES on an unparseable board (exit 2)",
      rc_wave == 2, f"rc={rc_wave}")


# --- 11. prose duties (per-project) ------------------------------------------
root, cfg = board_with("""<!--row id=P1.1 tier=S status=todo files=src/a.gd-->
**P1.1 [S] A row that never says how it would be disproved.** Accept: it works.
""")
cfg["prose_duties"] = {"red proof": ["red proof", "red-proven"]}
a = type("A", (), {"json": True})()
buf = io.StringIO()
with redirect_stdout(buf):
    board.cmd_lint(root, cfg, a)
r = json.loads(buf.getvalue())
check("an open row naming no red proof is warned",
      any("names no red proof" in p["msg"] for p in r["warnings"]),
      msgs(r, "warnings"))

# ...but a duty on a row whose PHASE IS NOT REACHABLE is deferred: counted in
# the output, never warned. Warning today on a P5 row while P4 still owes work
# builds a wall of unpayable warnings, and (per the drift check's own scar) a
# warning nobody can clear hides the ones that matter.
FUTURE = """<!--row id=P4.1 tier=S status=todo files=src/a.gd-->
**P4.1 [S] Open prerequisite work.** Accept: x. Red proof: y.

<!--row id=P5.1 tier=S status=todo files=src/b.gd-->
**P5.1 [S] A future-phase row, duties unwritten.**
"""


def lint_future(text: str) -> dict:
    root, cfg = board_with(text)
    cfg["prose_duties"] = {"red proof": ["red proof"]}
    cfg["phase_pattern"] = r"^(P\d+)"
    cfg["phase_deps"] = {"P5": ["P4"]}
    buf = io.StringIO()
    with redirect_stdout(buf), redirect_stderr(io.StringIO()):
        board.cmd_lint(root, cfg, type("A", (), {"json": True})())
    return json.loads(buf.getvalue())


r = lint_future(FUTURE)
check("a duty on an unreachable-phase row is DEFERRED, not warned",
      not any(p["row"] == "P5.1" for p in r["warnings"]),
      msgs(r, "warnings"))
check("the deferral is COUNTED in the output, never silent",
      r.get("deferred_prose_duties") == 1, f"json={r}")

# ...and the duty comes due the moment the prerequisite phase clears
r = lint_future(FUTURE.replace("id=P4.1 tier=S status=todo",
                               "id=P4.1 tier=S status=closed"))
check("the duty comes due the moment the phase is reachable",
      any(p["row"] == "P5.1" and "names no red proof" in p["msg"]
          for p in r["warnings"]),
      msgs(r, "warnings"))
check("a reachable-phase deferral count is zero, not carried",
      r.get("deferred_prose_duties") == 0, f"json={r}")


# --- 11b. `new` writes a row that is born legal ------------------------------
def new_args(**kw):
    base = dict(json=False, id="P1.2", title="A fresh row", tier="S",
                files="src/b.gd", accept="the badge shows 0",
                redproof="drop the clause, the badge test fails",
                body="", deps="", lane="", flags="", status="todo",
                board="", after="")
    base.update(kw)
    return type("A", (), base)()


root, c = board_with(GOOD)
buf = io.StringIO()
with redirect_stdout(buf), redirect_stderr(io.StringIO()):
    rc = board.cmd_new(root, c, new_args())
after = (root / "b.md").read_text(encoding="utf-8")
check("`new` writes a row", rc == 0 and "id=P1.2" in after, after[-300:])
check("`new` writes the prose duties into the body",
      "Accept: the badge shows 0" in after and "Red proof: drop the clause" in after,
      after[-300:])
# and the row it just wrote must LINT CLEAN -- a generator that emits rows its
# own checker rejects is worse than no generator
rws, probs = board.load_rows(root, c)
check("`new`'s output parses as a real row",
      [r.id for r in rws] == ["P1.1", "P1.2"] and not [p for p in probs if p.level == "error"],
      f"{[r.id for r in rws]} {[p.msg for p in probs]}")

# it refuses an id the project's own pattern cannot see -- otherwise the row is
# invisible to every query and lint would demand a header it already has
root, c = board_with(GOOD)
buf, err = io.StringIO(), io.StringIO()
with redirect_stdout(buf), redirect_stderr(err):
    rc = board.cmd_new(root, c, new_args(id="wibble"))
check("`new` refuses an id the row_id_pattern cannot see",
      rc == 1 and "invisible to every query" in err.getvalue(), err.getvalue())

# duplicate id, unknown tier, phantom dep
for kw, needle, label in (
        (dict(id="P1.1"), "already exists", "duplicate id"),
        (dict(tier="Q"), "not one of", "unknown tier"),
        (dict(deps="P9.9"), "is not a row", "phantom dep")):
    root, c = board_with(GOOD)
    err = io.StringIO()
    with redirect_stdout(io.StringIO()), redirect_stderr(err):
        rc = board.cmd_new(root, c, new_args(**kw))
    check(f"`new` refuses a {label}", rc == 1 and needle in err.getvalue(),
          err.getvalue())

# --after inserts in the right place, not at the end
root, c = board_with(GOOD + """
<!--row id=P1.3 tier=S status=todo files=src/c.gd-->
**P1.3 [S] Third.** Accept: x. Red proof: y.
""")
with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
    board.cmd_new(root, c, new_args(id="P1.2", after="P1.1"))
rws, _ = board.load_rows(root, c)
check("`new --after` inserts in order, not at the end",
      [r.id for r in rws] == ["P1.1", "P1.2", "P1.3"], f"{[r.id for r in rws]}")


# --- 11b2. P-TOOL-11: --after must not insert INSIDE a multi-paragraph row ---
# Found 2026-08-09: `new --after X` walked to the end of X's FIRST paragraph
# and inserted there, stranding X's remaining paragraphs -- including its
# Accept/Red proof -- below the new row, where they read as the NEW row's
# oracle. The insertion point must be the end of X's WHOLE block.
MULTI = """<!--row id=P1.1 tier=S status=todo files=src/a.gd-->
**P1.1 [S] Multi-paragraph anchor.** First paragraph of prose.

Second paragraph, still P1.1's.

Third paragraph, still P1.1's.
Accept: it works.
Red proof: break it, watch it fail.

<!--row id=P1.3 tier=S status=todo files=src/c.gd-->
**P1.3 [S] Third, unrelated row.** Accept: x. Red proof: y.
"""
CFG_PROSE = {**CFG, "prose_duties": {"accept": ["accept:"],
                                     "red proof": ["red proof", "red-proven"]}}


def lint_warn_count(root: Path, cfg: dict) -> int:
    a = type("A", (), {"json": True})()
    buf = io.StringIO()
    with redirect_stdout(buf), redirect_stderr(io.StringIO()):
        board.cmd_lint(root, cfg, a)
    return len(json.loads(buf.getvalue())["warnings"])


root, c = board_with(MULTI)
c.update(CFG_PROSE)
before_warn = lint_warn_count(root, c)
with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
    rc = board.cmd_new(root, c, new_args(id="P1.2", after="P1.1"))
after_text = (root / "b.md").read_text(encoding="utf-8")
rws, probs = board.load_rows(root, c)
by_id = {r.id: r for r in rws}
check("`new --after` on a multi-paragraph row inserts AFTER the whole block",
      [r.id for r in rws] == ["P1.1", "P1.2", "P1.3"], f"{[r.id for r in rws]}")
check("the anchor keeps its later paragraphs",
      "Second paragraph, still P1.1's" in by_id["P1.1"].body
      and "Third paragraph, still P1.1's" in by_id["P1.1"].body,
      by_id["P1.1"].body)
check("the anchor keeps its OWN Accept/Red proof, not the new row's",
      "Accept: it works." in by_id["P1.1"].body
      and "Red proof: break it, watch it fail." in by_id["P1.1"].body,
      by_id["P1.1"].body)
check("the new row's body does not swallow the anchor's later paragraphs",
      "Second paragraph, still P1.1's" not in by_id["P1.2"].body
      and "Third paragraph, still P1.1's" not in by_id["P1.2"].body,
      by_id["P1.2"].body)
check("lint warning count is UNCHANGED by the insertion (the accept criterion)",
      lint_warn_count(root, c) == before_warn,
      f"before={before_warn} after={lint_warn_count(root, c)}")

# RED PROOF: reproduce the ORIGINAL insert-after-first-paragraph behaviour by
# hand (not by patching board.py) and show it DOES move the warning count --
# the same board, the same anchor, only the insertion point differs.
root2, c2 = board_with(MULTI)
c2.update(CFG_PROSE)
before_warn2 = lint_warn_count(root2, c2)
buggy_block = ("<!--row id=P1.2 tier=S status=todo files=src/b.gd-->\n"
               "**P1.2 [S] A fresh row** the badge shows 0\n"
               "Accept: the badge shows 0\n"
               "Red proof: drop the clause, the badge test fails\n")
rows2, _ = board.load_rows(root2, c2)
anchor2 = next(r for r in rows2 if r.id == "P1.1")
text2 = (root2 / "b.md").read_text(encoding="utf-8")
lines2 = text2.splitlines()
k = anchor2.opener_line   # the OLD (buggy) code's exact insertion index:
                           # opener_line is the opener's 1-based line number,
                           # used directly as a 0-based array index -- which
                           # points one past the opener, i.e. the START of the
                           # anchor's second line (paragraph 2, if inline text
                           # ends the opener line as it does here).
while k < len(lines2) and lines2[k].strip():
    k += 1                          # walk to the end of the FIRST paragraph only
lines2.insert(k, "\n" + buggy_block.rstrip())
(root2 / "b.md").write_text("\n".join(lines2) + "\n", encoding="utf-8")
after_warn2 = lint_warn_count(root2, c2)
check("RED PROOF -- insert-after-first-paragraph DOES move the warning count "
      "(gains 2: P1.1 loses its Accept and its Red proof)",
      after_warn2 == before_warn2 + 2,
      f"before={before_warn2} after={after_warn2}")


# --- 11b3. --after the LAST row in the file -----------------------------------
LAST = """<!--row id=P1.1 tier=S status=todo files=src/a.gd-->
**P1.1 [S] Only row, no trailing blank.** Accept: x. Red proof: y.
"""
root, c = board_with(LAST)
with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
    rc = board.cmd_new(root, c, new_args(id="P1.2", after="P1.1"))
rws, probs = board.load_rows(root, c)
check("`new --after` the LAST row in the file still parses (order + no errors)",
      [r.id for r in rws] == ["P1.1", "P1.2"]
      and not [p for p in probs if p.level == "error"],
      f"{[r.id for r in rws]} {[p.msg for p in probs]}")

# --- 11b4. --after a row immediately followed by a section heading -----------
SECTIONED = """<!--row id=P1.1 tier=S status=todo files=src/a.gd-->
**P1.1 [S] Row right before a section break.** Accept: x. Red proof: y.

## § Next section

<!--row id=P1.3 tier=S status=todo files=src/c.gd-->
**P1.3 [S] Lives in the next section.** Accept: x. Red proof: y.
"""
root, c = board_with(SECTIONED)
with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
    rc = board.cmd_new(root, c, new_args(id="P1.2", after="P1.1"))
after_text = (root / "b.md").read_text(encoding="utf-8")
rws, probs = board.load_rows(root, c)
check("`new --after` a row before a section heading lands BEFORE the heading",
      after_text.index("P1.2") < after_text.index("## § Next section"),
      after_text)
check("it does not disturb the section heading or the row that follows it",
      [r.id for r in rws] == ["P1.1", "P1.2", "P1.3"]
      and not [p for p in probs if p.level == "error"],
      f"{[r.id for r in rws]} {[p.msg for p in probs]}")


# --- 11c. stats reports a REAL per-run delta ---------------------------------
# The /work report template prints "rows/wave 2.8 (prev run 2.1)". Before this,
# stats could not produce that number, so the line would have been hand-faked.
root, c = board_with(GOOD)
led = root / c["runs_ledger"]
led.parent.mkdir(parents=True, exist_ok=True)
led.write_text("\n".join(json.dumps(r) for r in [
    # run A: 1 wave, 2 rows, both shipped
    {"kind": "row", "run": "A", "wave": 1, "row": "X1", "tier": "S",
     "outcome": "done", "redproof": "real"},
    {"kind": "row", "run": "A", "wave": 1, "row": "X2", "tier": "H",
     "outcome": "done", "redproof": "real"},
    # run B: 1 wave, 3 rows, one rejected + one hollow proof
    {"kind": "row", "run": "B", "wave": 1, "row": "Y1", "tier": "S",
     "outcome": "done", "redproof": "real"},
    {"kind": "row", "run": "B", "wave": 1, "row": "Y2", "tier": "S",
     "outcome": "rejected", "redproof": "hollow"},
    {"kind": "row", "run": "B", "wave": 1, "row": "Y3", "tier": "H",
     "outcome": "done", "redproof": "real"},
]) + "\n", encoding="utf-8")

a = type("A", (), {"json": True})()
buf = io.StringIO()
with redirect_stdout(buf):
    board.cmd_stats(root, c, a)
st = json.loads(buf.getvalue())
check("stats separates runs", st["runs"] == ["A", "B"], f"{st['runs']}")
check("stats computes rows/wave per run",
      st["per_run"]["A"]["per_wave"] == 2.0 and st["per_run"]["B"]["per_wave"] == 3.0,
      f"{st['per_run']}")
check("stats counts rejected diffs and hollow proofs",
      st["per_run"]["B"]["rejected"] == 1 and st["per_run"]["B"]["hollow"] == 1,
      f"{st['per_run']['B']}")

# `repaired` and `violation` -- the two records a run is tempted not to write.
# Found on the protocol's own first run: an [H] worker's in-footprint diff was
# correct while it ALSO edited two files outside the repo and created a stray.
# Logging that as `done` would have made the tier look clean, which is exactly
# the signal you need to re-tier or rewrite the brief.
root_v, c_v = board_with(GOOD)
led_v = root_v / c_v["runs_ledger"]
led_v.parent.mkdir(parents=True, exist_ok=True)
led_v.write_text("\n".join(json.dumps(r) for r in [
    {"kind": "row", "run": "C", "wave": 1, "row": "Z1", "tier": "H",
     "outcome": "repaired", "redproof": "none", "violation": "footprint"},
    {"kind": "row", "run": "C", "wave": 1, "row": "Z2", "tier": "S",
     "outcome": "done", "redproof": "real"},
]) + "\n", encoding="utf-8")
buf = io.StringIO()
with redirect_stdout(buf):
    board.cmd_stats(root_v, c_v, type("A", (), {"json": True})())
st = json.loads(buf.getvalue())
check("`repaired` is counted apart from `done`",
      st["overall"]["repaired"] == 1 and st["overall"]["done"] == 1,
      f"{st['overall']}")
check("rule breaks are counted", st["overall"]["violations"] == 1,
      f"{st['overall']}")
buf = io.StringIO()
with redirect_stdout(buf):
    board.cmd_stats(root_v, c_v, type("A", (), {"json": False})())
human = buf.getvalue()
check("a repair is NOT reported as shipped clean",
      "shipped clean     1" in human and "repaired          1" in human, human)
check("the rule break is named in the human view",
      "RULE BREAKS" in human and "footprint x1" in human, human)
check("the per-tier line shows which tier broke a rule",
      "[H] 0/1 shipped clean first pass, 1 rule break(s)" in human, human)

# the human view must SHOW the delta, and must say "first run" rather than
# invent a baseline when there is no history
buf = io.StringIO()
with redirect_stdout(buf):
    board.cmd_stats(root, c, type("A", (), {"json": False})())
human = buf.getvalue()
check("stats prints the prev-run comparison the report template promises",
      "prev 2.0" in human, human)
led.write_text(json.dumps({"kind": "row", "run": "solo", "wave": 1,
                           "row": "Z", "tier": "S", "outcome": "done"}) + "\n",
               encoding="utf-8")
buf = io.StringIO()
with redirect_stdout(buf):
    board.cmd_stats(root, c, type("A", (), {"json": False})())
check("with no history stats says 'first run', never a made-up baseline",
      "(first run)" in buf.getvalue(), buf.getvalue())


# --- 12. `set` rewrites the header and nothing else --------------------------
root, cfg = board_with(GOOD)
a = type("A", (), {"json": False, "id": "P1.1",
                   "kv": ["status=done", "commit=abc1234"]})()
with redirect_stdout(io.StringIO()):
    board.cmd_set(root, cfg, a)
after = (root / "b.md").read_text(encoding="utf-8")
check("`set` updates the named fields",
      "status=done" in after and "commit=abc1234" in after, after)
check("`set` preserves the other fields",
      "tier=S" in after and "files=src/a.gd" in after, after)
check("`set` leaves the prose body untouched",
      "**P1.1 [S] A thing.** Accept: it works." in after, after)


# --- 13. an in-flight row with NO footprint must ABORT the pick --------------
# It owns something unknowable, so no disjointness claim about the wave can be
# stood behind. Report nothing rather than a number we cannot defend (1.7).
wb = Path(tempfile.mkdtemp(prefix="boardflight_"))
(wb / "docs").mkdir()
(wb / "src").mkdir()


def shw(*a):
    subprocess.run(["git", "-C", str(wb), *a], capture_output=True, text=True)


shw("init", "-q")
shw("config", "user.email", "t@t")
shw("config", "user.name", "t")
(wb / "src" / "a.py").write_text("x\n", encoding="utf-8")
BOARD_FLIGHT = (
    "<!--row id=X-1 tier=O status={st}-->\n"
    "**X-1 [O] In flight, footprint undeclared.** Accept: x. Red proof: y.\n\n"
    "<!--row id=X-2 tier=S status=todo files=src/a.py-->\n"
    "**X-2 [S] A perfectly good row.** Accept: x. Red proof: y.\n")
(wb / "docs" / "b.md").write_text(BOARD_FLIGHT.format(st="doing"),
                                  encoding="utf-8")
shw("add", "-A")
shw("commit", "-qm", "seed")

cfg_flight = {**CFG, "boards": [{"path": "docs/b.md", "src": "t"}],
              "row_id_pattern": r"^X-\d+$"}
wave_args = type("A", (), {"json": False, "max": 3, "exclude": ""})()
err = io.StringIO()
with redirect_stdout(io.StringIO()), redirect_stderr(err):
    rc = board.cmd_wave(wb, cfg_flight, wave_args)
check("a footprintless row in flight ABORTS the wave", rc == 2, f"rc={rc}")
check("the abort names the offending row and says why",
      "X-1" in err.getvalue() and "no footprint" in err.getvalue(),
      f"stderr={err.getvalue()!r}")

# RED PROOF: the SAME board with that row back at `todo` must pick normally --
# proving the abort keys on IN-FLIGHT-ness, not on the missing footprint alone
# (a footprintless `todo` row is merely undispatchable, which is not an error).
(wb / "docs" / "b.md").write_text(BOARD_FLIGHT.format(st="todo"),
                                  encoding="utf-8")
out = io.StringIO()
with redirect_stdout(out), redirect_stderr(io.StringIO()):
    rc2 = board.cmd_wave(wb, cfg_flight, wave_args)
check("the same board picks fine once that row is not in flight",
      rc2 == 0 and "X-2" in out.getvalue(), f"rc={rc2} out={out.getvalue()!r}")


# --- 14. a `---` divider ends a row's body just like a `## ` heading ---------
# (P-TOOL-12) body_ends() used to only recognise `## ` / the next row header,
# so a `---` divider between rows got swallowed into the PRECEDING row's body.
# body_end now also drives where `new --after` splices (P-TOOL-11), which
# makes this parse boundary load-bearing rather than merely cosmetic.
def rows_of(text: str) -> list:
    root, cfg = board_with(text)
    rows, problems = board.parse_board(root / "b.md", "test", cfg)
    return rows


DIVIDER_BOARD = """# board

<!--row id=P1.1 tier=S status=todo files=src/a.gd-->
**P1.1 [S] A thing before the divider.** Accept: it works. Red proof: none.

---

<!--row id=P1.2 tier=S status=todo files=src/b.gd-->
**P1.2 [S] A thing after the divider.** Accept: it works too. Red proof: none.
"""
rows = rows_of(DIVIDER_BOARD)
check("both rows either side of a `---` divider parse", len(rows) == 2,
      f"rows={[r.id for r in rows]}")
p11 = next(r for r in rows if r.id == "P1.1")
check("the divider does NOT get swallowed into the preceding row's body",
      "---" not in p11.body, f"P1.1 body={p11.body!r}")

# --- 14b. a fenced code block containing a divider-shaped line is NOT split --
# `---` is also YAML front-matter fencing and can appear as arithmetic inside
# a ``` code block; the live board keeps arithmetic in fences, so the divider
# rule tracks fence-open/close state and is inert while inside one. A wider
# rule ("any `---`-shaped line ends the row") would truncate rows like this
# one, which is why fence-tracking is in scope rather than skipped.
FENCE_BOARD = """# board

<!--row id=P1.1 tier=S status=todo files=src/a.gd-->
**P1.1 [S] A thing with code.** Accept: it works. Red proof: none.

```
1 - 2 - 3 = -4
---
```

More prose after the fence, still part of the same body.
"""
rows = rows_of(FENCE_BOARD)
check("a row with one row total (no false split) still parses",
      len(rows) == 1, f"rows={[r.id for r in rows]}")
p11 = rows[0]
check("a divider-shaped line INSIDE a fenced code block is kept in the body",
      "---" in p11.body, f"body={p11.body!r}")
check("prose after the fence is still part of the same row's body",
      "More prose after the fence" in p11.body, f"body={p11.body!r}")


# -----------------------------------------------------------------------------
print(f"\nboard tests: {PASS} passed, {FAIL} failed")
for f in FAILURES:
    print(f"  FAIL  {f}")
sys.exit(1 if FAIL else 0)
