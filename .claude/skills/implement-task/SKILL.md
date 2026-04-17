---
name: implement-task
description: Execute the next uncompleted task from a feature's task list
user-invocable: true
disable-model-invocation: true
arguments: feature-id
---

# Implement next task

You received a feature-id in `$ARGUMENTS`.

> **Executor boundary**: You are an EXECUTOR. Do the work yourself. Do NOT launch sub-agents or delegate. See `.claude/skills/_shared/sdd-phase-common.md`.

> **Project skills**: If the orchestrator included `SKILL: Load` instructions in your prompt, read and follow those skills when writing code.

## Pre-flight checks

Before starting, verify:
- [ ] `specs/$ARGUMENTS/plan.md` exists
- [ ] `specs/$ARGUMENTS/tasks.md` exists
- [ ] There are no tasks marked as `BLOCKED` that would prevent progress

If any check fails, tell the user what's missing and suggest the appropriate step (e.g., `/plan-feature`).

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

2. Read `specs/$ARGUMENTS/spec.md`, `specs/$ARGUMENTS/plan.md`, and `specs/$ARGUMENTS/tasks.md`.
   - If any of these don't exist, tell the user which step to run first.

3. **Determine batch scope** — Read the domain analysis in `plan.md` to determine feature size:
   - **SMALL**: Implement **all remaining unchecked tasks** in one batch. Validate once at the end.
   - **MEDIUM/LARGE**: Implement **all unchecked tasks in the current phase** (e.g., "Phase 1 — API plumbing") in one batch. Validate at the end of each phase.
   - If the orchestrator passed a specific task or set of tasks (e.g., review fix cycle), implement only those.

4. **For each task in the batch**:
   a. Read and understand the relevant code paths.
   b. Write the code change (if TDD mode: follow RED → GREEN → REFACTOR cycle).
   c. Mark the task as completed: change `- [ ]` to `- [x]` in `tasks.md`.
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
