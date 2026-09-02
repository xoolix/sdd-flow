# Tasks

## Execution order

### 1. Foundation

- [x] **T001 [AFK] Install 4 core skills**: copy work-unit-commits, comment-writer, branch-pr, chained-pr drafts verbatim from ~/.claude/sdd-skill-drafts/ to .claude/skills/<name>/SKILL.md; add all 4 to CORE_SKILLS (bin/sdd:11) and build-registry's ignore list (SKILL.md:18); existing "ignores every core skill" test passes unmodified.
  - blocked_by: none
  - verifies: AC1
  - touches: cli, skills, tests
  - type: feat

- [x] **T002 [AFK] `sdd verify-archive <id>` subcommand**: pure-shell command using `git show --no-renames --name-status` on the archive commit; exit 0 only when ≥1 D under specs/<id>/ and ≥1 A under specs/archive/*-<id>/ and specs/<id>/ is gone from HEAD; exit ≠0 naming the missing half otherwise; resolve multi-date archive dirs to most recent or fail clearly. Temp-repo tests cover a simulated bypass (altas-only commit) and a legit --moved-from archive.
  - blocked_by: none
  - verifies: AC4
  - touches: cli, tests
  - type: feat

- [x] **T003 [AFK] `sdd status` integrity check**: detect specs/<id>/ and specs/archive/*-<id>/ both tracked and report integrity-broken (phase literal + `blockers` entry per plan.md), in single and list mode.
  - blocked_by: none
  - verifies: AC5
  - touches: cli, tests
  - type: feat

- [x] **T004 [AFK] TDD contract: TRIANGULATE + TDD-Evidence envelope**: add TRIANGULATE to the RED→GREEN→REFACTOR cycle (default-mandatory; skip only structural, noted) and a mandatory envelope field TDD-Evidence (RED output, GREEN output, TRIANGULATE case count or skip note) in sdd-implement-task.md and sdd-phase-common.md §D; add the work-unit-commits pointer at Step 7.5; sync stale TDD-cycle mentions in testing.md, its templates mirror and `/tdd`. Prose-pinned by tests.
  - blocked_by: none
  - verifies: AC2
  - touches: agents, rules, tests
  - type: feat

### 2. Core

- [x] **T005 [AFK] Orchestrator + reviewer validate TDD-Evidence**: sdd-next, sdd-auto and sdd-phase-common §F carry the identical clause failing the phase (retry→ESCALATED) on missing/incomplete TDD-Evidence; sdd-reviewer gets a mechanical evidence-vs-reality step (test exists, passes now, has N cases).
  - blocked_by: T004
  - verifies: AC3
  - touches: orchestration, agents, tests
  - type: feat

- [x] **T006 [AFK] archive-feature self-check**: sdd-archive-feature.md Step 3.5 "On success" calls `sdd verify-archive` before .sdd-state deletion (flat prose, no branching, one fenced block per the pin test); add the branch-pr/chained-pr pointer at Step 3.6.
  - blocked_by: T002
  - verifies: AC6
  - touches: agents, tests
  - type: feat

- [ ] **T007 [AFK] Orchestrator post-archive gate**: sdd-next Step 4, sdd-auto Step 2 item 3, and sdd-phase-common.md §F carry an identical clause running `sdd verify-archive` post-phase, trusting only its exit code (fail→blocked: archive-feature stays non-retryable, zero retries); consistency-pin test across the three files.
  - blocked_by: T002
  - verifies: AC6
  - touches: orchestration, tests
  - type: feat

### 3. Validation

- [ ] **T008 [AFK] ADR 0005 + invariant sweep**: write docs/adr/0005-*.md ("phase handoffs are verified by deterministic CLI checks, not agent prose"), citing the 021/294ccfc bypasses and gentle-ai's doctrine; add the concatenated-needle sweep test (sweep-retired-symbols.test.js) pinning zero retired-commit-knob hits in bin/ .claude/ .specify/ tests/; confirm purity grep 0 and full suite green.
  - blocked_by: T001, T002, T003, T004, T005, T006, T007
  - verifies: AC7
  - touches: docs, tests
  - type: docs

## Notes
- All `[AFK]` via `/implement-task`; no `[HITL]`.
- Tests live inside each slice; TDD_MODE is ON in this repo (real RED before implementation).
