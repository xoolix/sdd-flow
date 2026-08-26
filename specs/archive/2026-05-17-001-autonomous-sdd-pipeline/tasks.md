# Tasks

## Execution order

### 1. Foundation

- [x] **Add ESCALATED status to envelope spec**: Update `.claude/skills/_shared/sdd-phase-common.md` section D to include `ESCALATED` as a valid status. Add a brief description: used when orchestrator exhausts retry budget and escalates to human.

- [x] **Define validation protocol in sdd-phase-common**: Add a new section F "Post-Phase Validation Protocol" to `sdd-phase-common.md` describing the 3-step validation (artifacts exist, envelope complete, lint/tests pass) and the retry logic (max 2, re-launch with error context, ESCALATE after).

### 2. Core implementation

- [x] **Update sdd-continue to remove confirmations and add validation+retry**: In `.claude/skills/sdd-continue/SKILL.md`: (a) Remove Step 3 user confirmation before launch, (b) Replace Step 5 "ask to continue" with auto-validation+retry loop, (c) After successful validation, show summary without asking.

- [x] **Update sdd-ff to remove confirmation and add validation+retry with per-task tracking**: In `.claude/skills/sdd-ff/SKILL.md`: (a) Remove Step 2 confirmation, (b) Add post-phase validation+retry loop in Step 3, (c) Track retry count per task-id for implement-task to cap at 2 retries per task, (d) On exhaustion, ESCALATE and stop loop.

### 3. Orchestrator update

- [x] **Update CLAUDE.md orchestrator description**: Update the "SDD Orchestrator" section in `.claude/CLAUDE.md` to reflect that phases run without confirmation, with auto-validation and retry. Mention the ESCALATED status and retry budget.

### 4. Validation

- [ ] Manual verification: Run `/sdd-ff` on a test feature to verify end-to-end autonomous execution without human prompts.

## Notes
- Each task modifies a single file (except task 6 which is manual).
- Update `decisions.md` if the plan changes during implementation.
