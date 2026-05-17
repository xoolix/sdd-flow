# Tasks

## Execution order

### 1. Foundation

- [x] **T1 — Branch from clean HEAD; isolate from feature 012's `bin/sdd` work**
  - Verify `git status` shows `bin/sdd` modified by 012.
  - `git stash push -m "012-wip-bin-sdd" -- bin/sdd`.
  - Create branch `feature/016-base-branch-resolution`.
  - Note in `decisions.md`: stashed 012's `bin/sdd`; do NOT pop within this feature.

### 2. Core implementation

- [x] **T2 — Implement `cmd_base_branch` in `bin/sdd`**
  - Add `cmd_base_branch()` per plan §Proposed design (3 layers).
  - L1: read `specs/$1/.parent-branch` if `$1` set; trim; skip if empty after trim; `git rev-parse --verify`; on missing ref → exit 2 citing file+ref.
  - L2: `grep -m1 '^base-branch:[[:space:]]*' .claude/rules/git.md`; same verify/exit-2 contract.
  - L3: iterate `develop main master`; for each verifiable, `git rev-list --count <c>..HEAD`; strict `<` for first-in-order tiebreak; emit winner or exit 3.
  - Add `base-branch [feature-id]` row to `usage()`.
  - Add `base-branch) shift; cmd_base_branch "$@" ;;` to dispatch.
  - File: `bin/sdd`.

- [x] **T3 — Wire resolver into `sdd-simplify-code.md`**
  - Pre-flight (line 21): replace `git merge-base main HEAD ...` with `sdd base-branch $ARGUMENTS` resolves AND `git merge-base "$(sdd base-branch $ARGUMENTS)" HEAD` resolves.
  - Step 3.1: replace `Resolve branch base: git merge-base main HEAD ...` with `BASE_BRANCH=$(sdd base-branch "$ARGUMENTS")` — on non-zero exit, `Status: blocked` forwarding stderr; else `git merge-base "$BASE_BRANCH" HEAD`.
  - Add inline note that `sdd base-branch` is canonical scope source.
  - File: `.claude/agents/sdd-simplify-code.md`.

- [x] **T4 — Document resolver in `.claude/rules/git.md`**
  - New `## Base branch resolution` section after `## Branch naming`.
  - Subsections: precedence (sidecar → config → auto-detect); `base-branch:` syntax with example (commented out so `main`-only repos don't accidentally activate); sidecar location and one-line format; auto-detect candidate order + tiebreaker; shallow-clone note (use `origin/<ref>` if needed).
  - File: `.claude/rules/git.md`.

- [x] **T5 — Gitignore `.parent-branch` sidecars**
  - Append `specs/**/.parent-branch` to `.gitignore` (create if absent).
  - Verify with `git check-ignore -v` on a test sidecar path.
  - File: `.gitignore`.

### 3. Validation

- [x] **T6 — Smoke tests for AC1–AC9**
  - Write `specs/016-base-branch-resolution/smoke.md` — one entry per AC (setup → command → expected → cleanup), per plan §Test strategy.
  - Run all 9 manually; record PASS/FAIL.
  - Complete only if all 9 PASS.
  - File: `specs/016-base-branch-resolution/smoke.md` (new).

- [x] **T7 — SC1 regression check (feature 012 repro)**
  - Run `git diff --name-only $(git merge-base $(sdd base-branch 012-sdd-status-json) HEAD)..HEAD`.
  - Confirm scope is `bin/sdd`-only, not the 39-file regression.
  - Record outcome under `## Verification: SC1` in `decisions.md`.

- [x] **T8 — Decisions.md and rollback verification**
  - Append design entry (3-layer order, strict-min tiebreaker, no fallback on explicit-ref miss).
  - Spot-check rollback paths: revert restores legacy line; one-line hot-patch works; `base-branch: main` opt-out behaves.
  - File: `specs/016-base-branch-resolution/decisions.md`.

## Notes
- Each task = one discrete file/state change.
- T1 is non-negotiable — without stashing, 012's diff contaminates 016's scope.
- No automated harness; T6 smoke checklist is the validation surface.
- If T6 fails, fix in T2 and re-run before advancing.
- Update `decisions.md` if the plan changes during implementation.
