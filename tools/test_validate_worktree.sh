#!/bin/sh
# test_validate_worktree.sh -- smoke test for tools/validate_worktree.sh.
#
# (a) green check: run the script with --skip-e2e against HEAD on a
#     THROWAWAY worktree (never the foreman's ../hydro-wt) and assert exit 0
#     and that every gate is named in the summary.
# (b) RED PROOF: stage a deliberately failing backend test inside that
#     throwaway worktree ONLY, commit it there on the (already detached)
#     HEAD, run the script again against that commit, and assert a
#     non-zero exit with the backend gate's rc != 0 named in the summary.
# (c) clean up the throwaway worktree either way.
#
# Prints PASS/FAIL per check; exits non-zero if any check fails.

set -u

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
SMOKE_WT="$REPO_ROOT/../hydro-wt-smoke"
FAIL_COUNT=0

check() {
	label="$1"
	ok="$2"
	if [ "$ok" = "0" ]; then
		echo "PASS: $label"
	else
		echo "FAIL: $label"
		FAIL_COUNT=$((FAIL_COUNT + 1))
	fi
}

# Remove ONLY the junction/symlink at $1, never what it points to. A
# recursive delete (git worktree remove --force included) walks through a
# Windows junction and empties the TARGET: on 2026-09-03 this very script
# removed the throwaway worktree with node_modules still junctioned in and
# wiped both real node_modules trees (CODING-PRACTICES 2.4i).
unlink_only() {
	[ -e "$1" ] || return 0
	if command -v cygpath > /dev/null 2>&1; then
		cmd //c rmdir "$(cygpath -w "$1")" > /dev/null 2>&1
	else
		rm "$1" > /dev/null 2>&1 || rmdir "$1" > /dev/null 2>&1
	fi
}

cleanup() {
	unlink_only "$SMOKE_WT/node_modules"
	unlink_only "$SMOKE_WT/frontend/node_modules"
	# Refuse to go on if the links are still there: deleting now would
	# take the real dependency trees with it.
	if [ -e "$SMOKE_WT/node_modules" ] || [ -e "$SMOKE_WT/frontend/node_modules" ]; then
		echo "cleanup: node_modules links still present under $SMOKE_WT; NOT removing the worktree" >&2
		return 1
	fi
	git -C "$REPO_ROOT" worktree remove --force "$SMOKE_WT" > /dev/null 2>&1
	git -C "$REPO_ROOT" worktree prune > /dev/null 2>&1
}

# Never reuse a stale throwaway from a previous crashed run.
if [ -d "$SMOKE_WT" ]; then
	cleanup
fi

# ---- (a) green run -------------------------------------------------
GREEN_LOG=$(mktemp)
sh "$SCRIPT_DIR/validate_worktree.sh" HEAD --wt "$SMOKE_WT" --skip-e2e > "$GREEN_LOG" 2>&1
RC_GREEN=$?
check "green run exits 0" "$([ "$RC_GREEN" = "0" ] && echo 0 || echo 1)"

for gate in build backend lint unit board e2e; do
	if grep -q "^$gate " "$GREEN_LOG" || grep -q "^$gate:" "$GREEN_LOG"; then
		check "summary names gate '$gate'" 0
	else
		check "summary names gate '$gate'" 1
	fi
done

# ---- (b) red proof ---------------------------------------------------
# Stage a failing vitest test in the throwaway worktree's own copy only.
RED_TEST="$SMOKE_WT/test/zz-smoke-red.test.mjs"
printf '%s\n' "import { describe, it, expect } from 'vitest';" > "$RED_TEST"
printf '%s\n' "describe('smoke red proof', () => {" >> "$RED_TEST"
printf '%s\n' "	it('is deliberately false', () => {" >> "$RED_TEST"
printf '%s\n' "		expect(1).toBe(2);" >> "$RED_TEST"
printf '%s\n' "	});" >> "$RED_TEST"
printf '%s\n' "});" >> "$RED_TEST"

git -C "$SMOKE_WT" add test/zz-smoke-red.test.mjs > /dev/null 2>&1
git -C "$SMOKE_WT" commit -q -m smoke-red > /dev/null 2>&1
RC_COMMIT=$?
check "red-proof commit created in throwaway worktree" "$([ "$RC_COMMIT" = "0" ] && echo 0 || echo 1)"

RED_SHA=$(git -C "$SMOKE_WT" rev-parse HEAD)

RED_LOG=$(mktemp)
sh "$SCRIPT_DIR/validate_worktree.sh" "$RED_SHA" --wt "$SMOKE_WT" --skip-e2e > "$RED_LOG" 2>&1
RC_RED=$?
check "red run exits non-zero" "$([ "$RC_RED" != "0" ] && echo 0 || echo 1)"

if grep -qE "^backend rc=[^0][^ ]* " "$RED_LOG"; then
	check "summary shows backend rc != 0" 0
else
	check "summary shows backend rc != 0" 1
fi

# ---- (c) cleanup -------------------------------------------------------
cleanup
check "throwaway worktree removed" "$([ ! -d "$SMOKE_WT" ] && echo 0 || echo 1)"

rm -f "$GREEN_LOG" "$RED_LOG"

if [ "$FAIL_COUNT" = "0" ]; then
	echo "ALL CHECKS PASSED"
	exit 0
else
	echo "$FAIL_COUNT CHECK(S) FAILED"
	exit 1
fi
