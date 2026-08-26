# Tasks

<!-- Vertical slices, not horizontal layer chores.
     Each checkbox line is parsed by downstream skills; keep IDs stable.
     Metadata lines belong to the task immediately above them. -->

## Execution order

### 1. Foundation
- [ ] **T001 [AFK] <title>**: <thin end-to-end slice or enabling seam>
  - blocked_by: none
  - verifies: AC1
  - touches: <modules/files/domains>
  - type: feat

### 2. Core implementation
- [ ] **T002 [AFK] <title>**: <demoable behavior through all required layers>
  - blocked_by: T001
  - verifies: AC1, AC2
  - touches: <modules/files/domains>
  - type: feat

### 3. Optional human checkpoints
<!-- Add a HITL task only when a real human decision blocks progress.
- [ ] **T003 [HITL] <decision title>**: <decision needed before continuing>
  - blocked_by: T002
  - verifies: Rollback Plan
  - decision: run /sdd-hitl <feature-id> T003 "<decision>"
-->

## Notes
- `[AFK]` tasks can be implemented by `/implement-task`.
- `[HITL]` tasks require a human decision; run `/sdd-hitl <feature-id> Tnnn "<decision>"` to record it and mark the task `[x]`.
- `blocked_by` is `none` or comma-separated task IDs.
- `type` is one of `feat`, `fix`, `refactor`, `chore`, `docs` — the conventional-commit type used for the slice's commit message.
- Prefer many thin, independently verifiable vertical slices over a few broad tasks.
- Put tests, docs, and observability work inside the relevant AFK slice; do not create standalone horizontal validation tasks.
- Update `decisions.md` if the plan changes.
