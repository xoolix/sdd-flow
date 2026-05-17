# Technical Plan

## Inputs
- Spec: `specs/002-evaluator-optimizer-pipeline/spec.md`
- Clarifications: None — spec is complete
- Research inputs: Anthropic patterns — environment feedback, voting, evaluator-optimizer

## Current state

The SDD pipeline has 4 key skill files:

- **implement-task/SKILL.md**: Runs validations (lint/types/tests) only AFTER implementation is complete (step 5). No mid-implementation feedback loop.
- **review-feature/SKILL.md**: Launches parallel Explore agents per domain, but produces a single verdict from one synthesis pass. No voting or structured failure feedback.
- **sdd-continue/SKILL.md**: Detects phase, launches it, validates result. Linear progression — no loop-back on review FAIL.
- **sdd-ff/SKILL.md**: Same as sdd-continue but chains all phases. Has per-task retry for implement-task, but no review→fix→re-review loop.
- **sdd-phase-common.md**: Return envelope has Status/Summary/Artifacts/Next/Risks. No fields for test output or review feedback.

## Proposed design

### 1. Environment feedback in implement-task

Add a validation checkpoint after step 4 (implementation). The sub-agent runs tests/lint mid-implementation and iterates inline (fix → re-validate) before marking the task done. The final envelope includes a `Validations-Output` field with concrete test/lint output.

### 2. Voting review with 3 agents

Replace the current single-synthesis review with 3 independent full-review agents launched in parallel. Each produces a verdict (PASS / PASS WITH WARNINGS / FAIL) plus a compliance matrix. The orchestrator applies majority vote: if all agree, use that verdict; if any FAIL exists, flag to human with the dissenting rationale.

### 3. Evaluator-optimizer loop in sdd-continue / sdd-ff

After review-feature returns FAIL, the orchestrator extracts the specific failed criteria and review feedback, then re-launches implement-task with that feedback as context. After the fix, re-launches review-feature. Max 2 review→fix cycles; if still FAIL, ESCALATE.

### 4. Envelope extensions in sdd-phase-common

Add two optional fields to the return envelope:
- `Validations-Output`: concrete test/lint output from implement-task
- `Review-Feedback`: structured list of failed criteria + fix instructions from review-feature

## Touched areas
- `.claude/skills/implement-task/SKILL.md` — add inline validation loop + envelope field
- `.claude/skills/review-feature/SKILL.md` — 3-agent voting + structured feedback output
- `.claude/skills/sdd-continue/SKILL.md` — evaluator-optimizer loop after review FAIL
- `.claude/skills/sdd-ff/SKILL.md` — same loop logic integrated into fast-forward
- `.claude/skills/_shared/sdd-phase-common.md` — new envelope fields

## Data flow

```
implement-task → [inline test/lint → fix loop] → envelope with Validations-Output
    ↓
review-feature → [3 parallel agents → vote] → envelope with Review-Feedback
    ↓ (if FAIL)
sdd-continue/sdd-ff → extract feedback → re-launch implement-task(feedback) → re-review
    ↓ (max 2 cycles)
PASS → archive  |  still FAIL → ESCALATE
```

## Migration / rollout
- No backfill needed — changes are to skill templates only
- Backward compatible: new envelope fields are optional
- No feature flags — changes apply to all future SDD runs
- Rollback: revert SKILL.md files to previous versions

## Test strategy
- Unit: Not applicable (skill files are markdown instructions, not code)
- Integration: Run a `/sdd-ff` on a test feature to verify the full loop
- E2E/manual: Verify voting produces consensus, verify FAIL triggers re-implementation

## Risks and mitigations
- **Context bloat**: 3 parallel review agents triple the context cost → mitigate by keeping each agent's scope focused (compliance matrix only, no exploratory analysis)
- **Non-deterministic voting**: Agents may disagree frequently → mitigate with clear review criteria and the "any FAIL → flag human" rule
- **Infinite loop risk**: Evaluator-optimizer could oscillate → hard cap of 2 cycles + ESCALATE
