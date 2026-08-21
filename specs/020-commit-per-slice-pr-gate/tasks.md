# Tasks

<!-- Task IDs are stable and downstream-parsed. -->

## Execution order

### 1. Foundation

- [x] **T012 [AFK] `sdd branch` subcommand**: idempotent — on `feature/<id>` no-op; exists → checkout; else `checkout -b`; prints branch.
  - blocked_by: none
  - verifies: AC1
  - touches: bin/sdd, tests/sdd.test.js
  - type: feat

- [x] **T001 [AFK] `sdd commit-slice` happy path**: stage `--files` + derived feature dir (`specs/<id>`/archive fallback); commit `<type>(<id>): Tnnn <title>`; no push.
  - blocked_by: none
  - verifies: AC1, AC2
  - touches: bin/sdd, tests/sdd.test.js
  - type: feat

- [x] **T002 [AFK] `sdd commit-slice` guardrails**: no `--files` → exit non-zero, no commit; never stage unrelated files; never `git add -A`.
  - blocked_by: T001
  - verifies: AC2, AC3
  - touches: bin/sdd, tests/sdd.test.js
  - type: feat

- [x] **T003 [AFK] `sdd open-pr` gate**: preflight `gh auth status` + remote; ok → push + `gh pr create --draft` (title/body: `spec.md`+`decisions.md`; no `--fill`) + `.pr-opened`; fail → no push, command printed, exit non-zero; else report URL + sentinel.
  - blocked_by: T001
  - verifies: AC6
  - touches: bin/sdd, tests/sdd.test.js
  - type: feat

- [x] **T004 [AFK] `sdd status` reports `ready-to-pr`**: archived + no `.pr-opened` → `phase: ready-to-pr`, `next_command` points at gate; `archived` requires sentinel.
  - blocked_by: T003
  - verifies: AC5
  - touches: bin/sdd, tests/sdd.test.js
  - type: feat

### 2. Core implementation

- [x] **T005 [AFK] Envelope + task format**: add `commit:` (SHA or `none`) to the envelope (`_shared/sdd-phase-common.md` §D); add `type:` key (`feat|fix|refactor|chore|docs`) to `tasks-template.md` and `sdd-task-planner.md`.
  - blocked_by: T001
  - verifies: AC4
  - touches: .claude/skills/_shared/sdd-phase-common.md, .specify/templates/tasks-template.md, .claude/agents/sdd-task-planner.md
  - type: chore

- [x] **T006 [AFK] Wire `/implement-task`**: Step 1: `sdd branch <id>`; after validations, read `type:` (fallback `fix`), call `sdd commit-slice`; failure → revert `[x]`→`[ ]`, `Status: blocked`+stderr; set `commit:`; skip if `auto-commit: off`.
  - blocked_by: T002, T005, T012
  - verifies: AC1, AC4
  - touches: .claude/agents/sdd-implement-task.md
  - type: feat

- [x] **T013 [AFK] `git.md`**: commit-per-slice + auto-commit-knob.
  - blocked_by: T006
  - verifies: Rollback Plan
  - touches: .claude/rules/git.md
  - type: docs

- [x] **T007 [AFK] Wire `/simplify-code`**: commit after simplifying, before writing `.simplified` (order matters); set envelope `commit:`; also gitignore `specs/**/.simplified` (`.pr-opened` stays tracked).
  - blocked_by: T002, T005
  - verifies: AC1
  - touches: .claude/agents/sdd-simplify-code.md, .gitignore
  - type: feat

- [x] **T008 [AFK] Wire `/archive-feature`**: after the folder move, one `sdd commit-slice` call on the derived path; no branching (haiku-safe); set `commit:`.
  - blocked_by: T002, T005
  - verifies: AC1, AC5
  - touches: .claude/agents/sdd-archive-feature.md
  - type: feat

- [x] **T009 [AFK] Orchestrator PR gate**: `sdd-next` gains `ready-to-pr` + missing `archived` row; confirms with human, calls `sdd open-pr`; `sdd-auto` stops at gate (carve-out).
  - blocked_by: T004, T006, T007, T008
  - verifies: AC5, AC6
  - touches: .claude/skills/sdd-next/SKILL.md, .claude/skills/sdd-auto/SKILL.md
  - type: feat

- [x] **T010 [AFK] Docs**: `CLAUDE.md` Commands/Pipeline/Phase-table/Workflow/Archive.
  - blocked_by: T009
  - verifies: Rollback Plan, AC5
  - touches: CLAUDE.md
  - type: docs

- [x] **T014 [AFK] No AI attribution**: forbid `Co-Authored-By` trailers and AI PR-body footers; assert `bin/sdd` emits neither.
  - blocked_by: T010
  - verifies: Rollback Plan
  - touches: .claude/rules/git.md, tests/sdd.test.js
  - type: docs

### 3. Human checkpoint

- [ ] **T011 [HITL] Dogfood the pipeline on a real slice**: run implement→simplify→review→archive→gate; confirm one commit/slice, no unrelated files, `ready-to-pr` post-archive, gate works with/without `gh` auth.
  - blocked_by: T010
  - verifies: AC1, AC2, AC3, AC4, AC5, AC6, Success Criteria
  - decision: run /sdd-hitl 020-commit-per-slice-pr-gate T011 "<decision>"

## Notes
- `[AFK]` via `/implement-task`; `[HITL]` via `/sdd-hitl`.
- Update `decisions.md` if scope changes.
