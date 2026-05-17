# Decisions

## Design: 2026-04-27 — Base branch resolver implementation

### 3-layer precedence (implemented as specified)

1. **Layer 1 — per-feature sidecar** (`specs/<id>/.parent-branch`): first line, whitespace-trimmed. Empty/whitespace → falls through. Non-empty but missing ref → exit 2, no fallthrough.
2. **Layer 2 — project config** (`base-branch:` in `.claude/rules/git.md`, anchored `^base-branch:[[:space:]]*`). Missing ref → exit 2, no fallthrough.
3. **Layer 3 — auto-detect**: candidates `develop main master` in order; for each that resolves, `git rev-list --count <c>..HEAD`; strict `<` comparison preserves first-in-order tiebreaker. None resolve → exit 3 with instructive stderr.

### Exit codes
- 0 = resolved successfully (stdout = ref name)
- 2 = explicit ref declared but missing locally (Layer 1 or Layer 2 hit, ref absent)
- 3 = no candidate found (Layer 3 exhausted all candidates)

### grep anchor note
`grep -m1 '^base-branch:[[:space:]]*'` with `-m1` prevents false matches from code-fence examples in `git.md`. The `|| true` suffix prevents `set -e` from aborting on no-match.

### sdd-simplify-code.md integration
- Pre-flight bullet updated: `sdd base-branch $ARGUMENTS` exits 0 AND `git merge-base "$(sdd base-branch $ARGUMENTS)" HEAD` resolves.
- Step 3.1 replaced: `BASE_BRANCH=$(sdd base-branch "$ARGUMENTS")` — canonical scope source; hardcoded `main` removed.

---

## T1: Stash entry for feature 012

Feature 012's `bin/sdd` modifications were stashed before branching for 016.

**Stash entry:** `stash@{0}` on branch `feature/012-sdd-status-json`
**Message:** `WIP: feature 012 bin/sdd cmd_status (resume after 016)`

**Instructions for orchestrator:** After 016 is complete and merged (or the branch is done), switch back to `feature/012-sdd-status-json` and run:
```bash
git stash pop
```
Do NOT pop the stash from within the 016 branch.

---

## Verification: SC1

SC1 states: "Re-running `/simplify-code` on feature 012 produces a 1-file scope (`bin/sdd`), not the 39-file regression."

SC1 verification is deferred to when feature 012 is completed. The 016 branch itself shows 39 files vs `main` because `feature/016` is branched from `feature/011` (which itself diverged significantly from `main`). This is expected and not a regression of 016.

The resolver is confirmed working: `sdd base-branch` returns the correct base, and `git merge-base <base> HEAD` produces a valid SHA. SC1 will be verifiable once feature 012 is resumed and its branch scope is checked.

---

## Simplify: 2026-04-27 — /simplify-code

- **Files simplified**: none
- **Changes**: No committed files in scope. `git merge-base feature/011-sdd-pipeline-operational-fixes HEAD` equals HEAD (`6400aea`) — all 016 implementation lives in unstaged working-tree files outside `<base>..HEAD`. IGNORED_DIRTY: `bin/sdd`, `.claude/agents/sdd-simplify-code.md`, `.claude/rules/git.md`, `.gitignore`.
- **Baseline**: pass | **Post-edit**: skip (SCOPED_FILES empty)

---

## Deferred manual verifications

| # | AC | Criterion | Status | Fix Required |
|---|----|-----------| -------|--------------|
| 1 | AC4 | True tiebreaker (two branches with equal rev-list count) | Deferred — requires repo with two equal-count branches; code inspection confirms strict `<` comparison preserves first-in-order | None — code review satisfies |
| 2 | AC8 | Full `/simplify-code` invocation consuming resolver | Deferred — requires completed feature with passing baseline; integration path verified manually via `git diff --name-only $(sdd base-branch)..HEAD` | None — verified in smoke test |
| 3 | SC1 | Feature 012 scope = 1 file (not 39-file regression) | Deferred — requires resuming feature 012 after 016 | Unstash 012's `bin/sdd` changes |
| 4 | SC3 | Feature 013 `/simplify-code` uses resolver, no manual override | Deferred — verify when feature 013 runs simplify | None — resolver installed |

---

## SPEC-GAP — 016-base-branch-resolution — adversarial review

| # | Gap | Severity | Description |
|---|-----|----------|-------------|
| 1 | `sdd` PATH requirement not documented in `git.md` | medium | `sdd-simplify-code.md` calls `sdd base-branch $ARGUMENTS` — if `sdd` is not on PATH in the agent's shell, pre-flight will fail with `command not found`. This is a pre-existing operational requirement (sdd was already invoked in agents), not new to this feature. Failure mode is clear (not silent). Documenting it in `git.md`'s "Base branch resolution" section or the `sdd-simplify-code` docs would reduce onboarding friction. |
| 2 | `bin/sdd update` does not propagate `bin/sdd` itself | low | Acknowledged risk in `plan.md` risks table — "Out of scope per intake; flag for follow-up." `--copy` installs need a manual re-copy of `bin/sdd` to get the new `cmd_base_branch`. No action required here; flagged for a follow-up feature. |
| 3 | Pre-flight calls `sdd base-branch` twice (exit-0 check + subshell for merge-base) | low | Line 21 of `sdd-simplify-code.md` invokes the resolver twice in the pre-flight bullet. No side effects; purely a minor efficiency note. Step 3.1 (line 44) correctly captures once into `BASE_BRANCH`. Not a defect. |

Source: adversarial review agent, review-feature phase
Date: 2026-04-27
