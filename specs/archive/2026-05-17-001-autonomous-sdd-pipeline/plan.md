# Technical Plan

## Inputs
- Spec: `specs/001-autonomous-sdd-pipeline/spec.md`
- Clarifications: None
- Research inputs: None — all changes are to prompt/skill files

## Domain Analysis

| Domain | Files | Complexity |
|--------|-------|-----------|
| sdd-continue skill | `.claude/skills/sdd-continue/SKILL.md` | MEDIUM |
| sdd-ff skill | `.claude/skills/sdd-ff/SKILL.md` | MEDIUM |
| sdd-phase-common | `.claude/skills/_shared/sdd-phase-common.md` | SMALL |
| Orchestrator rules | `.claude/CLAUDE.md` | SMALL |

**Overall**: MEDIUM — 4 files, all markdown/prompt, no runtime code.

## Current State

- `sdd-continue`: Detects phase, **asks user confirmation** before launching, asks again after completion.
- `sdd-ff`: Asks user confirmation at the start, then loops phases. No validation or retry logic.
- `sdd-phase-common`: Defines result envelope with `success | partial | blocked` statuses. No retry protocol.
- `CLAUDE.md`: Describes orchestrator delegation rules and phase pipeline. No auto-validation.

## Proposed Design

### 1. Validation + Retry Loop (core mechanism)

Add a **post-phase validation protocol** to both `sdd-continue` and `sdd-ff`:

```
After sub-agent returns:
1. Check artifacts exist on disk (Bash: ls)
2. Check envelope is complete (has Status, Summary, Artifacts, Next, Risks)
3. Run lint/typecheck/tests if applicable (parallel Bash)
4. If ALL pass → proceed
5. If ANY fail → re-launch sub-agent with error details (max 2 retries)
6. If 2 retries exhausted → ESCALATE to human with diagnostic
```

### 2. Remove confirmations

- `sdd-continue`: Remove Step 3 (user confirmation before launch) and the "Continuo?" prompt in Step 5. After phase completes, show summary only.
- `sdd-ff`: Remove Step 2 confirmation. Start running immediately.

### 3. Retry tracking

- `sdd-ff` must track retry count **per task** for implement-task phases to prevent infinite loops.
- Format: in-memory counter, no file persistence needed (resets each invocation).

### 4. Envelope extension

- Add `ESCALATED` as a valid status in `sdd-phase-common.md` return envelope.
- When orchestrator exhausts retries, it reports `ESCALATED` with diagnostic.

## Touched Areas

| Area | Change |
|------|--------|
| `.claude/skills/sdd-continue/SKILL.md` | Remove confirmations, add validation+retry loop |
| `.claude/skills/sdd-ff/SKILL.md` | Remove confirmation, add validation+retry loop with per-task tracking |
| `.claude/skills/_shared/sdd-phase-common.md` | Add ESCALATED status to envelope spec |
| `.claude/CLAUDE.md` | Update orchestrator description to reflect auto-validation behavior |

## Data Flow

1. User invokes `/sdd-continue` or `/sdd-ff`
2. Orchestrator detects phase, launches sub-agent (no confirmation)
3. Sub-agent returns result envelope
4. Orchestrator validates: artifacts on disk + envelope complete + lint/tests
5. Pass → advance | Fail → retry with errors (max 2) | Exhausted → ESCALATE

## Migration / Rollout
- **Backfill**: None
- **Compatibility**: Backward-compatible — sub-agents don't change behavior, only orchestrator does
- **Feature flags**: None — changes are to prompt files
- **Rollback**: Revert SKILL.md commits

## Test Strategy
- **Unit**: N/A (prompt files, not code)
- **Integration**: N/A
- **E2E/manual**: Run `/sdd-ff` on a test feature end-to-end without human intervention

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Retry wastes tokens on env issues (broken lint config) | Diagnostic in ESCALATE message must include error output so human can distinguish agent vs env failure |
| Removing confirmations may surprise users | `sdd-continue` still shows summary after each phase; `sdd-ff` shows progress |
