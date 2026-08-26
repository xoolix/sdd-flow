# Tasks

<!-- Vertical slices, not horizontal layer chores.
     Each checkbox line is parsed by downstream skills; keep IDs stable. -->

## Execution order

### 1. Foundation — new CLI surfaces

- [x] **T001 [AFK] `sdd domain-vocab` subcommand**: reads § Domain rules via `extract_section`; strips comment-only/blank lines before deciding empty (F1 — a bare `<!-- ... -->` counts as empty); prints content + exit 0, else nothing + exit 3 (F10). Add usage line.
  - blocked_by: none
  - verifies: AC3
  - touches: bin/sdd, tests/sdd.test.js
  - type: feat

- [x] **T002 [AFK] `commit-slice --moved-from` guard**: run `git ls-files --error-unmatch -- "$path"` (F2); tracked ⇒ `git add -- "$path"`, never `-A` (keeps the no-`-A` test green), before the "nothing staged" check; never-tracked, even on disk, ⇒ exit non-zero naming it, nothing staged. Add usage line.
  - blocked_by: none
  - verifies: AC6, AC7
  - touches: bin/sdd, tests/sdd.test.js
  - type: feat

- [x] **T003 [AFK] `sdd status` with no feature-id lists `specs/`**: replace the `not on a feature branch` error with a JSON array of `{feature_id, phase, next_command}` per `specs/*/` folder minus `archive/`, exit 0, `[]` when none; reuse phase detection (F12/AC8).
  - blocked_by: none
  - verifies: AC8
  - touches: bin/sdd, tests/sdd.test.js
  - type: feat

- [x] **T008 [AFK] `commit-slice` commits only named paths**: `git commit -- <paths>` scoped to `--files`/feature dir/`--moved-from`, not a bare commit, so others' pre-staged work stays staged.
  - blocked_by: T002
  - verifies: Rollback Plan
  - touches: bin/sdd, tests/sdd.test.js
  - type: fix

### 2. Core — prose fixes that depend on or gate CLI behavior

- [x] **T004 [AFK] Archive is not exempt from post-phase validation; no retry**: in §F, state archive is NOT covered by "skip if phase produces no code"; add an explicit non-retryable-phases list (`archive-feature`; post-move pre-flight can't retry), checked before the retry loop. Replicate both wordings into `sdd-next/SKILL.md` (:177, :196-197) and `sdd-auto/SKILL.md` (:120, :125) — five occurrences, lockstep (F3/F4).
  - blocked_by: none
  - verifies: AC5
  - touches: .claude/skills/_shared/sdd-phase-common.md, .claude/skills/sdd-next/SKILL.md, .claude/skills/sdd-auto/SKILL.md, tests/sdd.test.js
  - type: fix

- [ ] **T005 [AFK] plan-feature resolves vocabulary before Step 3, via `domain-vocab`**: insert Step 2.5 (not a renumber — :37/:96 stay true) calling `sdd domain-vocab`, falling back to the spec, not step-4 findings, when empty/unavailable; Step 3 then identifies domains from that vocabulary, dropping the fixed taxonomy; only :94's back-pointer changes; rewrite the now-false "CLI never does" line.
  - blocked_by: T001
  - verifies: AC1, AC2, AC4
  - touches: .claude/skills/plan-feature/SKILL.md, tests/sdd.test.js
  - type: fix

- [ ] **T006 [AFK] Remaining domain-vocab consumers drop the grep**: `sdd-designer.md`, `sdd-research-spike.md`, `new-feature/SKILL.md` (:172, Spanish) call `sdd domain-vocab`, not grep; failure/empty degrades to their own scan; rewrite each "CLI never does" line; fix `sdd-designer.md:29`'s stale "step 2" (F6).
  - blocked_by: T001
  - verifies: AC4
  - touches: .claude/agents/sdd-designer.md, .claude/agents/sdd-research-spike.md, .claude/skills/new-feature/SKILL.md, tests/sdd.test.js
  - type: fix

- [ ] **T007 [AFK] Archive commits both halves of the move**: `sdd-archive-feature.md` Step 3.5's single `sdd commit-slice` call adds `--moved-from specs/$ARGUMENTS`, staying one plain call (haiku, no branching); 022's own archive proves it — the commit must show deletions, not just insertions.
  - blocked_by: T002
  - verifies: AC6
  - touches: .claude/agents/sdd-archive-feature.md, tests/sdd.test.js
  - type: fix

## Notes
- Archive fix 2 (resolving an archived feature dir in tests) is already covered by `featureDir(id)` in `tests/sdd.test.js` — verified, not redone.
- T001–T003 are real CLI: test end-to-end against the real binary (`makeTempProject`/`sddFail`), covering comment-only-is-empty and never-tracked-but-present-on-disk explicitly.
- T004–T007 are prose: fold `readFileSync`/`toContain` checks in as regression guards, not coverage.
