# Tasks

<!-- Vertical slices; checkbox lines parsed downstream, keep IDs stable.
     Detail (formulas, line ranges, rejected alternatives) lives in plan.md. -->

## Execution order

**Rationale**: the pipeline breaks while used to fix itself: commit-slice would drop this
feature's test files, and branch would silently stack, handing simplify the wrong scope.
T001-T004 harden both first, so every later slice commits and branches safely.
**T001 is the exception and must be compensated by hand**: its own commit is made by the
still-broken `commit-slice`, and T001 creates a new test file — exactly what the broken tool
drops in silence. Stage T001's new files explicitly and verify with `git show --stat` before
moving on. Same for the missing `.parent-branch`: write it by hand before T003 lands.

### 1. Foundation — commit-slice & branch integrity
- [x] **T001 [AFK] commit-slice rejects undeclared new files**: run the undeclared-file check before commit, unfiltered against `pre_staged`; exit ≠0 naming the file, no commit.
  - blocked_by: none; verifies: AC1; touches: bin/sdd, tests
- [x] **T002 [AFK] Reject `..`/`/` in feature-id**: validate before the index is touched; fix the docstring's stale call-site count.
  - blocked_by: T001; verifies: AC2; touches: bin/sdd, tests
- [x] **T003 [AFK] `sdd branch` records the parent and warns on stacking**: two separate behaviours — (a) resolve the base and always write `specs/<id>/.parent-branch` (`mkdir -p`; gitignored, so it raises no `??`), and (b) warn on stderr when branching off another `feature/*`. Writing the sidecar does not by itself prevent stacking.
  - blocked_by: T002; verifies: AC3; touches: bin/sdd, tests
- [x] **T004 [AFK] commit-slice verifies current branch**: current branch must equal the `feature/<id>` naming convention (NOT read from `.parent-branch`, which holds the *base* branch for diff scope); exit 4 otherwise.
  - blocked_by: T003; verifies: AC4; touches: bin/sdd, tests

### 2. Core implementation — state file & pipeline gates
- [x] **T005 [AFK] `.sdd-state` writer + freshness reader**: new `cmd_state_write`/`tree_digest` (plan.md), wired into `usage()` and the dispatch; simplify calls it on success, no `files:` list; `detect_feature_phase` compares HEAD + digest — edits invalidate ready-to-review. **`.gitignore:5` must change `specs/**/.simplified` → `specs/**/.sdd-state` in this slice**: unignored, the new file is untracked, and T001's hardened commit-slice then fails every commit.
  - blocked_by: T004; verifies: AC6; touches: bin/sdd, .gitignore, sdd-simplify-code.md, tests
- [x] **T006 [AFK] review-feature seals verdict, adds `reviewed` phase**: writes verdict via `state-write` after Step 4 and the judge branch; `detect_feature_phase` gains `reviewed`, next command archive. **Also retires the 6 stale `.simplified` references left in `sdd-next/SKILL.md` (4) and `sdd-auto/SKILL.md` (2)** — after T005's clean break they point at a file that no longer exists — and adds the `reviewed` row to `sdd-next`'s phase table following the `archived` row's `sdd status` pattern (`sdd-auto` inherits it by reference).
  - blocked_by: T005; verifies: AC7; touches: review-feature/SKILL.md, sdd-next/SKILL.md, sdd-auto/SKILL.md, bin/sdd, tests
- [x] **T007 [AFK] archive verifies the receipt**: pre-flight requires `phase: reviewed` + a passing verdict, blocks otherwise; deletes `.sdd-state` on success.
  - blocked_by: T006; verifies: AC11; touches: sdd-archive-feature.md, tests
- [ ] **T008 [AFK] Delete the `auto-commit` knob entirely**: strip all 13 references (behavior, `tdd:` illustrations, envelope prose, both `git.md` sections) in one commit; retitle the cross-pinned test (`retired-symbol-proofs`/`sweep-retired-symbols`); invert `sdd.test.js`'s knob assertions; fix the false `docs/adr/0003` line.
  - blocked_by: T004; verifies: AC5; touches: .claude, .specify, docs/adr/0003, tests
- [ ] **T009 [AFK] Discovery gate blocks on empty user decisions**: `plan-feature/SKILL.md` blocks when `## User decisions` is empty (weak form — findings carry no IDs).
  - blocked_by: T004; verifies: AC8; touches: plan-feature/SKILL.md, tests
- [ ] **T010 [AFK] simplify blocks on dirty scoped file**: before rewriting scope, block (no commit, no discard) a scoped file with uncommitted edits.
  - blocked_by: T005; verifies: AC9; touches: sdd-simplify-code.md, tests
- [ ] **T011 [AFK] `--minimal` resolves the feature path**: parse flags before resolving `specs/<id>/`. Leave shared `sdd-phase-common.md` §I untouched.
  - blocked_by: T004; verifies: AC10; touches: review-feature/SKILL.md, tests

### 3. Validation
- [ ] **T012 [AFK] State-machine harness across all eight phases**: fixtures drive all eight phases; asserts `sdd status` reports the right one each step, including the untested sentinel-freshness branch. Header comment declares it tests CLI reads only; set an explicit Jest timeout.
  - blocked_by: T007; verifies: AC12; touches: tests, bin/sdd

## Notes
- No `[HITL]`: all real decisions were resolved at the discovery checkpoint.
- `type`: fix T001-T004,T008; feat T005-T007,T012; chore T009-T011.
