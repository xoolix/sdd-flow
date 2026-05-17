# Tasks

## Execution order

### 1. Foundation — Envelope extensions
- [x] Add `Validations-Output` and `Review-Feedback` optional fields to the return envelope in `.claude/skills/_shared/sdd-phase-common.md`. Update field descriptions and rules. Keep backward compatibility (fields are optional).

### 2. Core — Environment feedback in implement-task
- [x] Modify `.claude/skills/implement-task/SKILL.md`: restructure steps 4-5 into an inline validation loop. After each code change, the sub-agent runs tests/lint, checks results, and fixes inline before proceeding. Final envelope must include `Validations-Output` with concrete output.

### 3. Core — Voting review with 3 parallel agents
- [x] Modify `.claude/skills/review-feature/SKILL.md`: replace single-synthesis review with 3 independent full-review agents launched in parallel. Each agent produces a verdict + compliance matrix. Add voting logic: unanimous → use verdict; any FAIL → flag to human with dissenting rationale. Add `Review-Feedback` field to the envelope with structured list of failed criteria.

### 4. Core — Evaluator-optimizer loop in sdd-continue
- [x] Modify `.claude/skills/sdd-continue/SKILL.md`: after review-feature returns FAIL, extract failed criteria from `Review-Feedback`, re-launch implement-task with that feedback as context, then re-launch review-feature. Max 2 review→fix cycles; if still FAIL → ESCALATE. Update phase detection to handle the review→fix→re-review state.

### 5. Core — Evaluator-optimizer loop in sdd-ff
- [x] Modify `.claude/skills/sdd-ff/SKILL.md`: integrate the same evaluator-optimizer loop from task 4. Add review cycle counter. After all tasks pass and review returns FAIL, loop back to implement-task with feedback. Max 2 cycles, then ESCALATE.

### 6. Validation
- [x] Manual verification: run `/sdd-ff` on a test feature (or dry-read all modified SKILL.md files) to confirm internal consistency — envelope fields referenced correctly, voting logic described coherently, loop cap enforced, and no contradictions between skills.
- [x] Docs update: update `CLAUDE.md` Phase Pipeline diagram to reflect the new review→fix→re-review loop.

## Notes
- All changes are to markdown skill files, not application source code.
- Each task maps to one or two file edits.
- Update `decisions.md` if implementation diverges from plan.
