# Tasks

## Execution order

### 1. Foundation

- [x] **T001 [AFK] Install 4 core skills**: the 4 gentle-ai drafts copied verbatim to .claude/skills/; added to CORE_SKILLS and build-registry's ignore list.
  - blocked_by: none
  - verifies: AC1
  - touches: cli, skills, tests
  - type: feat

- [x] **T002 [AFK] `sdd verify-archive <id>` subcommand**: pure-shell check via `git show --no-renames --name-status`: exit 0 only with both halves of the move present and specs/<id>/ gone from HEAD; multi-date dirs → most recent. Temp-repo tests: bypass and legit archive.
  - blocked_by: none
  - verifies: AC4
  - touches: cli, tests
  - type: feat

- [x] **T003 [AFK] `sdd status` integrity check**: detect specs/<id>/ and specs/archive/*-<id>/ both tracked and report integrity-broken (phase literal + `blockers` entry per plan.md), in single and list mode.
  - blocked_by: none
  - verifies: AC5
  - touches: cli, tests
  - type: feat

- [x] **T004 [AFK] TDD contract: TRIANGULATE + TDD-Evidence envelope**: 4-step cycle (TRIANGULATE default-mandatory; skip only structural, noted) + mandatory TDD-Evidence envelope field in sdd-implement-task.md and §D; work-unit-commits pointer at Step 7.5; testing.md, mirror and `/tdd` synced. Prose-pinned.
  - blocked_by: none
  - verifies: AC2
  - touches: agents, rules, tests
  - type: feat

### 2. Core

- [x] **T005 [AFK] Orchestrator + reviewer validate TDD-Evidence**: identical §F/sdd-next/sdd-auto clause failing the phase on missing TDD-Evidence; sdd-reviewer mechanical evidence-vs-reality step 2.5.
  - blocked_by: T004
  - verifies: AC3
  - touches: orchestration, agents, tests
  - type: feat

- [x] **T006 [AFK] archive-feature self-check**: Step 3.5 self-check runs `sdd verify-archive` before .sdd-state deletion (flat prose, one fenced block); branch-pr/chained-pr pointer at 3.6.
  - blocked_by: T002
  - verifies: AC6
  - touches: agents, tests
  - type: feat

- [x] **T007 [AFK] Orchestrator post-archive gate**: identical post-archive clause in §F/sdd-next/sdd-auto running `sdd verify-archive`, trusting only its exit code (fail→blocked, zero retries); consistency pin across the three files.
  - blocked_by: T002
  - verifies: AC6
  - touches: orchestration, tests
  - type: feat

### 3. Validation

- [x] **T008 [AFK] ADR 0005 + invariant sweep**: docs/adr/0005 written (021/294ccfc bypasses + gentle-ai doctrine); concatenated-needle sweep test added; purity greps 0, full suite green.
  - blocked_by: T001, T002, T003, T004, T005, T006, T007
  - verifies: AC7
  - touches: docs, tests
  - type: docs

### 4. Judgment-day fixes

- [x] **T009 [AFK] Pure-deletion bypass detection**: `sdd status` and `check_archive_integrity` flag a feature with git history under specs/<id>/ but present in NEITHER specs/<id>/ nor specs/archive/*-<id>/ (integrity-broken, not "not found"); `verify-archive` exit-3 stderr distinguishes "never started" from "was tracked, now gone". Temp-repo tests: git-rm bypass caught by both; unknown id still plain not-found. AC extension recorded as delta.
  - blocked_by: none
  - verifies: judge-high-1
  - touches: cli, tests
  - type: fix

- [x] **T010 [AFK] Persist TDD-Evidence + wire it to the reviewer**: sdd-implement-task.md appends a per-task TDD-Evidence entry to decisions.md (implemented-by pattern); sdd-reviewer.md step 2.5 reads it from decisions.md, not "envelopes"; review-feature Step 3 forwards it; RED-unfalsifiability recorded as accepted residual risk (decisions.md + one ADR 0005 line). Prose pins updated.
  - blocked_by: none
  - verifies: judge-high-2
  - touches: agents, orchestration, docs, tests
  - type: fix

## Notes
- All `[AFK]` via `/implement-task`; no `[HITL]`.
- Tests live inside each slice; TDD_MODE is ON in this repo (real RED before implementation).
