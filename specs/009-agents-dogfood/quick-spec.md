# Quick Spec: agents-dogfood

<!-- Fast-lane: enhancement / refactor / small change.
     Constraints: single-domain, no new dependencies, ≤2 GWT acceptance criteria.
     Combined spec + plan + tasks artifact. Word budget: ≤900 words. -->

## Summary

Smoke-test the 17 native sub-agents introduced in feature 008 by running a trivial fast-lane dummy intent end-to-end through the SDD pipeline. The operator manually drives each phase (`/new-quick-feature` → `/implement-task` → `/simplify-code` → `/review-feature` → `/archive-feature`) and records pass/fail results in `docs/agents-dogfood-report.md`. The dummy feature is throwaway evidence; the report is the only permanent deliverable.

## Trigger

Manual operator run. No automation, cron, or CI hook.

## Happy Path

1. Operator picks a trivial dummy intent (e.g., "add a hello-world function in `bin/`").
2. Operator runs `/new-quick-feature "<dummy intent>"` — `sdd-new-quick-feature` agent runs gate + intake, writes `specs/NNN-dummy/quick-spec.md`.
3. Operator runs `/implement-task` — `sdd-implement-task` agent applies the change list, marks tasks `[x]`.
4. Operator runs `/simplify-code` — `sdd-simplify-code` agent runs baseline + post-validation, writes `.simplified` sentinel.
5. Operator runs `/review-feature` — `sdd-review-feature` agent orchestrates 3 voters + adversarial, returns PASS or PASS WITH WARNINGS.
6. Operator runs `/archive-feature` — `sdd-archive-feature` agent moves dummy feature to `specs/archive/NNN-dummy/`.
7. Operator writes `docs/agents-dogfood-report.md` with a 5-agent PASS/FAIL table and 1-2 lines of observations per agent.

## Acceptance Criteria

- [ ] Given a trivial fast-lane dummy intent, When the operator follows the `Next:` envelope of each phase through `/implement-task` → `/simplify-code` → `/review-feature` → `/archive-feature`, Then the dummy feature lands in `specs/archive/` and each of the 5 phase agents (`sdd-new-quick-feature`, `sdd-implement-task`, `sdd-simplify-code`, `sdd-review-feature`, `sdd-archive-feature`) is invoked at least once via the Agent tool (verifiable in the transcript).
- [ ] Given the smoke test completed, When the operator opens `docs/agents-dogfood-report.md`, Then the report lists all 5 agents with pass/fail status and 1-2 lines of observations each.

## Rollback Plan

- Delete `docs/agents-dogfood-report.md`.
- Optionally remove the dummy feature from `specs/archive/NNN-dummy/` if it remains.
- No production code is touched — rollback is trivial.

## Success Criterion

- 5/5 agents listed as PASS in `docs/agents-dogfood-report.md` and the dummy feature lands in `specs/archive/` without any phase reporting `Status: ESCALATED`.

---

## Plan

### Touched files

| File | Action |
|------|--------|
| `docs/agents-dogfood-report.md` | CREATE — permanent deliverable |
| `specs/NNN-dummy/quick-spec.md` | CREATE (throwaway, archived at end) |
| `bin/hello-world` (or equivalent) | CREATE via dummy implement-task (throwaway) |

No existing files are modified. No new dependencies.

### Approach

- Single operator session; all phases driven manually in sequence.
- Dummy intent kept trivially simple (one new file, no logic) to minimize distraction from the goal of exercising agents.
- Observations captured live during each phase (unexpected errors, latency, tool call gaps).
- Report written after all phases complete; uses the transcript as the source of truth for invocation evidence.

### Test strategy

- Unit: none (this is a process validation exercise, not a code change).
- Manual: operator verifies each phase agent is invoked via the Agent tool by inspecting the transcript; verifies dummy feature appears in `specs/archive/` after `/archive-feature`; verifies report is readable and complete.

---

## Tasks

- [ ] Run `/new-quick-feature "add a hello-world script in bin/"` and confirm `sdd-new-quick-feature` agent is invoked; capture any observations.
- [ ] Run `/implement-task` on the dummy feature and confirm `sdd-implement-task` agent is invoked and marks tasks `[x]`; capture any observations.
- [ ] Run `/simplify-code` on the dummy feature and confirm `sdd-simplify-code` agent is invoked and writes `.simplified` sentinel; capture any observations.
- [ ] Run `/review-feature` on the dummy feature and confirm `sdd-review-feature` agent orchestrates 3 voters + adversarial; capture any observations.
- [ ] Run `/archive-feature` on the dummy feature and confirm `sdd-archive-feature` agent moves it to `specs/archive/`; capture any observations.
- [ ] Write `docs/agents-dogfood-report.md` with a 5-agent PASS/FAIL table and 1-2 lines of observations per agent.
