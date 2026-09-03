#!/bin/sh
# validate_worktree.sh [sha=HEAD] [--wt DIR] [--log DIR] [--skip-e2e]
#
# Why this exists (MR-61, retrospective mr-run2): running the full gate
# ladder straight on the working tree gets poisoned by OTHER workers'
# in-flight edits -- a half-written source file (not just a half-written
# test) reds the whole suite even though the commit under test is fine.
# The fix used by hand six times in one run: build a DETACHED git worktree
# at the sha under test, junction in node_modules (so npm install is not
# needed again), and run every gate there instead of on the live tree.
#
# Every gate's return code is captured into a variable -- NEVER piped --
# per CODING-PRACTICES 3.2e: a gate piped into tail/grep/head reports the
# consumer's exit code (which is always 0), not the gate's, so a red gate
# reads green.

set -u

# ---- locate the repo root from the script's own path, not a hard-coded
# ---- user path (this script is shared; C:/Users/Noob is not universal).
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)

SHA="HEAD"
WT="$REPO_ROOT/../hydro-wt"
LOG_DIR_OVERRIDE=""
SKIP_E2E=0
SHA_SET=0

while [ $# -gt 0 ]; do
	case "$1" in
		--wt)
			WT="$2"
			shift 2
			;;
		--log)
			LOG_DIR_OVERRIDE="$2"
			shift 2
			;;
		--skip-e2e)
			SKIP_E2E=1
			shift
			;;
		*)
			if [ "$SHA_SET" = "0" ]; then
				SHA="$1"
				SHA_SET=1
			fi
			shift
			;;
	esac
done

# Normalize WT to an absolute path with forward slashes (cygpath-friendly).
case "$WT" in
	/*) : ;;
	*) WT="$(pwd)/$WT" ;;
esac

SHA_FULL=$(git -C "$REPO_ROOT" rev-parse "$SHA" 2>/dev/null)
if [ -z "$SHA_FULL" ]; then
	echo "validate_worktree: cannot resolve sha '$SHA' in $REPO_ROOT" >&2
	exit 2
fi
SHA_SHORT=$(git -C "$REPO_ROOT" rev-parse --short "$SHA_FULL")

# ---- log directory. .validate/ is NOT in this row's gitignore (checked:
# ---- .gitignore has no such entry and editing it is out of footprint),
# ---- so logs go under the system temp dir instead, never inside the repo.
if [ -n "$LOG_DIR_OVERRIDE" ]; then
	LOG="$LOG_DIR_OVERRIDE"
else
	TMPBASE="${TMPDIR:-${TEMP:-/tmp}}"
	# TEMP on Windows is a backslash path; cygpath -u makes it POSIX-usable.
	case "$TMPBASE" in
		*\\*) TMPBASE=$(cygpath -u "$TMPBASE" 2>/dev/null || printf '%s' "$TMPBASE") ;;
	esac
	STAMP=$(date -u +%Y%m%dT%H%M%SZ)
	LOG="$TMPBASE/hydro-validate/${SHA_SHORT}-${STAMP}"
fi
mkdir -p "$LOG" || exit 2

# ---- detect Windows (Git Bash / MSYS) for the node_modules link strategy.
case "$(uname -s)" in
	MINGW*|MSYS*|CYGWIN*) IS_WIN=1 ;;
	*) IS_WIN=0 ;;
esac

# ---- create or reuse the worktree at the requested sha.
if [ ! -d "$WT" ]; then
	git -C "$REPO_ROOT" worktree add --detach "$WT" "$SHA_FULL" > "$LOG/worktree-setup.log" 2>&1
	RC_SETUP=$?
	if [ "$RC_SETUP" != "0" ]; then
		echo "validate_worktree: git worktree add failed (rc=$RC_SETUP), see $LOG/worktree-setup.log" >&2
		exit 2
	fi
else
	DIRTY=$(git -C "$WT" status --porcelain 2>/dev/null)
	if [ -n "$DIRTY" ]; then
		echo "validate_worktree: $WT has uncommitted changes, refusing to reuse it" >&2
		exit 3
	fi
	git -C "$WT" checkout -q --detach "$SHA_FULL" > "$LOG/worktree-setup.log" 2>&1
	RC_SETUP=$?
	if [ "$RC_SETUP" != "0" ]; then
		echo "validate_worktree: git checkout --detach failed (rc=$RC_SETUP), see $LOG/worktree-setup.log" >&2
		exit 2
	fi
fi

git -C "$WT" log --oneline -1 > "$LOG/head.txt" 2>&1

# ---- link node_modules in rather than reinstalling: a junction on
# ---- Windows, a symlink elsewhere. Skip silently when already present.
link_node_modules() {
	label="$1"
	target="$2"
	source="$3"
	if [ -e "$target" ]; then
		return 0
	fi
	if [ ! -e "$source" ]; then
		echo "validate_worktree: source $source does not exist, cannot link" >&2
		return 1
	fi
	if [ "$IS_WIN" = "1" ]; then
		tgt_w=$(cygpath -w "$target")
		src_w=$(cygpath -w "$source")
		# Git Bash (MSYS) mangles a bare "/J" into a path, so the switch is
		# passed as "//J" -- MSYS only strips one leading slash, leaving the
		# single slash mklink actually expects.
		cmd //c mklink //J "$tgt_w" "$src_w" > "$LOG/link-$label.log" 2>&1
	else
		ln -s "$source" "$target"
	fi
}

link_node_modules root "$WT/node_modules" "$REPO_ROOT/node_modules"
link_node_modules frontend "$WT/frontend/node_modules" "$REPO_ROOT/frontend/node_modules"

# ---- run each gate in the worktree, capturing RC into a variable
# ---- (never piped) and its own log file.
run_gate() {
	gate_name="$1"
	shift
	( cd "$WT" && "$@" ) > "$LOG/$gate_name.log" 2>&1
	return $?
}

run_gate build npm run build:frontend
RC_BUILD=$?

run_gate backend npm test
RC_BACKEND=$?

run_gate lint npm --prefix frontend run lint
RC_LINT=$?

run_gate unit npm --prefix frontend run test:unit
RC_UNIT=$?

run_gate board python tools/board.py lint
RC_BOARD=$?

if [ "$SKIP_E2E" = "1" ]; then
	RC_E2E="skipped"
else
	run_gate e2e npm run test:e2e
	RC_E2E=$?
fi

# ---- counts, pulled from each gate's own finished log (never from a
# ---- shared/piped stream, so a truncated pipe can't fake a passing count).
counts_for() {
	gate="$1"
	case "$gate" in
		backend|unit)
			grep -E "Tests |Test Files" "$LOG/$gate.log" 2>/dev/null | tail -2 | tr '\n' ' '
			;;
		e2e)
			grep -E "passed|failed|flaky" "$LOG/e2e.log" 2>/dev/null | tail -1
			;;
		*)
			printf ''
			;;
	esac
}

SUMMARY="$LOG/summary.txt"
: > "$SUMMARY"
printf 'build rc=%s %s\n' "$RC_BUILD" "$(counts_for build)" >> "$SUMMARY"
printf 'backend rc=%s %s\n' "$RC_BACKEND" "$(counts_for backend)" >> "$SUMMARY"
printf 'lint rc=%s %s\n' "$RC_LINT" "$(counts_for lint)" >> "$SUMMARY"
printf 'unit rc=%s %s\n' "$RC_UNIT" "$(counts_for unit)" >> "$SUMMARY"
printf 'board rc=%s %s\n' "$RC_BOARD" "$(counts_for board)" >> "$SUMMARY"
if [ "$SKIP_E2E" = "1" ]; then
	printf 'e2e skipped\n' >> "$SUMMARY"
else
	printf 'e2e rc=%s %s\n' "$RC_E2E" "$(counts_for e2e)" >> "$SUMMARY"
fi

cat "$SUMMARY"
echo "log dir: $LOG"

# ---- exit non-zero with the first failing gate's rc, in gate order.
FIRST_FAIL_RC=0
FIRST_FAIL_NAME=""
for pair in "build:$RC_BUILD" "backend:$RC_BACKEND" "lint:$RC_LINT" "unit:$RC_UNIT" "board:$RC_BOARD" "e2e:$RC_E2E"; do
	gname="${pair%%:*}"
	grc="${pair#*:}"
	if [ "$grc" = "skipped" ]; then
		continue
	fi
	if [ "$grc" != "0" ] && [ "$FIRST_FAIL_NAME" = "" ]; then
		FIRST_FAIL_RC="$grc"
		FIRST_FAIL_NAME="$gname"
	fi
done

if [ -n "$FIRST_FAIL_NAME" ]; then
	echo "validate_worktree: FAILED at gate '$FIRST_FAIL_NAME' (rc=$FIRST_FAIL_RC)" >&2
	exit "$FIRST_FAIL_RC"
fi

exit 0
