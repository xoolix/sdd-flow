---
name: sdd-implement-task
description: Execute the next uncompleted task from a feature's task list
model: sonnet
disallowedTools: [Agent]
---

# Implement next task

Feature-id: `$ARGUMENTS`

> **Executor boundary**: You are an EXECUTOR. Do the work yourself. Do NOT launch sub-agents or delegate. See `.claude/skills/_shared/sdd-phase-common.md`.

> **Project skills**: If the orchestrator included `SKILL: Load` instructions in your prompt, read and follow those skills when writing code.

## Pre-flight checks

Before starting, **resolve lane** per `.claude/skills/_shared/sdd-phase-common.md` §I:
- If `specs/$ARGUMENTS/quick-spec.md` exists AND `plan.md` does NOT → **FAST_LANE = true**, **SPEC_FILE = quick-spec.md**
- Else if `plan.md` AND `tasks.md` exist → **FAST_LANE = false**, **SPEC_FILE = spec.md**
- Else → blocked: tell the user which artifact is missing and suggest `/plan-feature` or `/new-quick-feature`/`new-fix`

Then verify:
- [ ] **FAST_LANE = false**: `specs/$ARGUMENTS/spec.md`, `plan.md`, and `tasks.md` all exist
- [ ] **FAST_LANE = true**: `specs/$ARGUMENTS/quick-spec.md` exists
- [ ] There are no tasks marked as `BLOCKED` that would prevent progress

If any check fails, tell the user what's missing and suggest the appropriate step.

## TDD detection

Check if this project uses TDD:
1. Look for test framework configuration (jest.config, pytest.ini, vitest.config, .rspec, etc.)
2. Check `.claude/rules/testing.md` for TDD conventions
3. Look for existing test patterns (test files that match source files)

**If TDD is detected**, execute each task using the RED → GREEN → REFACTOR cycle:
1. **RED**: Write a failing test that captures the expected behavior for this task
2. **GREEN**: Write the minimum code to make the test pass
3. **REFACTOR**: Clean up the code while keeping tests green

**If TDD is not detected**, use the standard implementation flow below.

## Steps

1. **Recover prior context (once)** — Call `mem_search` with query `sdd/$ARGUMENTS` + domain keywords, `project: "{project}"` to recover architecture decisions, patterns, and discoveries from planning and prior tasks. If Engram is unavailable, skip. **Do this only on the first invocation** — if the orchestrator already passed context or this is a continuation, skip.

2. Read state files:
   - **FAST_LANE = false**: Read `specs/$ARGUMENTS/spec.md`, `plan.md`, and `tasks.md`.
   - **FAST_LANE = true**: Read `specs/$ARGUMENTS/quick-spec.md` (combined spec + plan + change list). Treat its `## Tasks` section as the task list.
   - If the required file(s) don't exist, tell the user which step to run first.

2b. **Review-fix cycle** — If the invoker (user or orchestrator) passed `Review-Feedback` (a structured table from `/review-feature`, with a **Task bullet** column), first **reopen** the listed tasks before planning. The `Review-Feedback` table has the form `| # | Task bullet (verbatim) | Criterion | Status | Agent(s) | Fix Required |`. For each row:
   - If the Task-bullet cell contains verbatim text matching an existing `- [x]` bullet in `tasks.md` (full-flow) or `quick-spec.md` `## Tasks` (fast-lane), flip that bullet back to `- [ ]`.
   - If the cell reads `(new task needed — not in list)`, append a new `- [ ]` bullet in the same `## Tasks` section using the Fix-Required text as the bullet body — this becomes a new atomic task.

   Manual users pass `Review-Feedback` by copying the entire `### Review-Feedback` block from `/review-feature`'s result into their `/implement-task` message. If no `Review-Feedback` was passed, skip this step.

3. **Determine batch scope** — Read the domain analysis to determine feature size:
   - **FAST_LANE = false**: from `plan.md`.
   - **FAST_LANE = true**: from `quick-spec.md` `## Plan` section. Single-domain by entry-gate construction — treat as SMALL.
   - **SMALL**: Implement **all remaining unchecked tasks** in one batch. Validate once at the end.
   - **MEDIUM/LARGE**: Implement **all unchecked tasks in the current phase** (e.g., "Phase 1 — API plumbing") in one batch. Validate at the end of each phase.
   - If the orchestrator passed a specific task or set of tasks (e.g., review fix cycle), implement only those.

4. **For each task in the batch**:
   a. Read and understand the relevant code paths.
   b. Write the code change (if TDD mode: follow RED → GREEN → REFACTOR cycle).
   c. Mark the task as completed:
      - **FAST_LANE = false**: change `- [ ]` to `- [x]` in `tasks.md`.
      - **FAST_LANE = true**: change `- [ ]` to `- [x]` in `quick-spec.md` `## Tasks` section (NOT `tasks.md` — there is no `tasks.md` for fast-lane features).
   d. If the implementation diverges from the spec, note the delta (don't write it yet — batch at the end).
   e. **Continue to the next task in the batch without pausing.**

5. **Validate once after the batch** — Run validations in parallel using separate Bash calls:
   - **Lint** → PASS/FAIL (run if linter is configured)
   - **Type check** → PASS/FAIL (run if type checker is configured)
   - **Tests** (files touched by the batch) → PASS/FAIL
   - **If ALL pass** → proceed to step 6.
   - **If ANY fail** → read the error output, fix the issue inline, and re-run validations. Repeat up to **3 inline fix attempts** per failure. If still failing after 3 attempts, stop and report `Status: blocked` with the validation output.

6. **Delta spec check**: If any tasks in the batch changed, added, or removed requirements from the original spec, document all deltas in `specs/$ARGUMENTS/decisions.md` in a single entry:
   ```
   ## Delta: [date] — Tasks [N, M, ...]
   - **ADDED**: [new requirement or behavior not in original spec]
   - **MODIFIED**: [original requirement] → [how it changed and why]
   - **REMOVED**: [requirement dropped and why]
   ```
   Only include sections (ADDED/MODIFIED/REMOVED) that apply. Skip this step if all tasks matched the spec exactly.

7. **Engram memory** (skip if Engram unavailable):
   - Save **only if** you discovered a gotcha, unexpected behavior, or non-obvious pattern during the batch → `mem_save` type: `discovery` or `pattern`, `project: "{project}"`
   - Don't save routine implementation work — if nothing surprised you, don't save anything.

## Result envelope

After completing the batch, output this summary:

```
## Result
- **Status**: success | partial | blocked
- **Summary**: [1-3 sentences — what was implemented across the batch]
- **Artifacts**: [files modified/created]
- **Validations**: Lint: PASS/FAIL/SKIP | Types: PASS/FAIL/SKIP | Tests: PASS/FAIL/SKIP
- **Validations-Output**: [paste the concrete terminal output from the final validation run]
- **Tasks completed**: [N/total — e.g., "5/12 (Phase 1 + Phase 2)"]
- **Next**: [next phase or "/review-feature $ARGUMENTS" if all complete]
- **Risks**: [blockers, questions, or spec divergences — or "None"]
```

## Rules
- Do not expand scope beyond the current batch.
- Do not refactor unrelated code.
- Keep changes minimal and coherent.
- **NEVER use Plan Mode**: Do NOT use `EnterPlanMode`. Write code and update files directly. Plan Mode breaks the SDD pipeline.
- Always validate before reporting done. Never skip validations.
- Always output the result envelope — it provides context for the next run.
- Document spec divergences as deltas in `decisions.md` — this feeds `/archive-feature` later.
- The `tasks.md` file MUST stay under 530 words. If updating it, keep it concise.
