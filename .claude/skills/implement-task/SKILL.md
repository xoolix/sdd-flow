---
name: implement-task
description: Execute the next uncompleted task from a feature's task list
user-invocable: true
disable-model-invocation: true
arguments: feature-id
---

# Implement next task

You received a feature-id in `$ARGUMENTS`.

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

1. Read `specs/$ARGUMENTS/spec.md`, `specs/$ARGUMENTS/plan.md`, and `specs/$ARGUMENTS/tasks.md`.
   - If any of these don't exist, tell the user which step to run first.
2. Find the first unchecked task (`- [ ]`) in `tasks.md`.
   - If all tasks are checked, tell the user the feature is complete and suggest `/review-feature`.
3. Read and understand the relevant code paths for this task.
4. Implement the minimum complete change that satisfies the task.
   - If TDD mode: follow RED → GREEN → REFACTOR cycle.
5. **Run validations** — execute all available validations **in parallel** using separate Bash calls:
   - **Lint** → PASS/FAIL (run if linter is configured)
   - **Type check** → PASS/FAIL (run if type checker is configured)
   - **Tests** (files touched by this task) → PASS/FAIL
   - If ANY validation FAILS → fix before proceeding. Do not mark the task done with failing validations.
   - Record validation results for the result envelope.
6. **Delta spec check**: If the implementation changes, adds, or removes requirements from the original spec, document the delta in `specs/$ARGUMENTS/decisions.md` using this format:
   ```
   ## Delta: [date] — Task [N]
   - **ADDED**: [new requirement or behavior not in original spec]
   - **MODIFIED**: [original requirement] → [how it changed and why]
   - **REMOVED**: [requirement dropped and why]
   ```
   Only include sections (ADDED/MODIFIED/REMOVED) that apply. Skip this step if the implementation matches the spec exactly.
7. Mark the task as completed: change `- [ ]` to `- [x]` in `tasks.md`.

## Result envelope

After completing the task, output this summary:

```
## Result
- **Status**: success | partial | blocked
- **Summary**: [1-3 sentences describing what was implemented]
- **Artifacts**: [files modified/created]
- **Validations**: Lint: PASS/FAIL/SKIP | Types: PASS/FAIL/SKIP | Tests: PASS/FAIL/SKIP
- **Next**: [next unchecked task description, or "/review-feature $ARGUMENTS" if all complete]
- **Risks**: [blockers, questions, or spec divergences — or "None"]
```

## Rules
- Do not expand scope beyond the current task.
- Do not refactor unrelated code.
- Keep changes minimal and coherent.
- Always validate before marking done. Never skip validations.
- Always output the result envelope — it provides context for the next `/implement-task` run.
- Document every spec divergence as a delta in `decisions.md` — this feeds `/archive-feature` later.
- The `tasks.md` file MUST stay under 530 words. If updating it, keep it concise.
