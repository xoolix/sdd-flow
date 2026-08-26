---
name: sdd-implement-task
description: Execute the next uncompleted task from a feature's task list
model: sonnet
disallowedTools: [Agent, EnterPlanMode, ExitPlanMode]
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
- [ ] The task list has at least one unchecked task, or all tasks are already complete

If any check fails, tell the user what's missing and suggest the appropriate step.

Once the lane is resolved and the required files confirmed, call `sdd branch $ARGUMENTS` before any implementation work. It is idempotent — a no-op when already on `feature/$ARGUMENTS`, a checkout when the branch exists, a `checkout -b` otherwise — and prints the branch name. This is the only sanctioned way to create or switch the feature branch: never run a raw `git checkout -b` here — ADR 0002 makes `bin/sdd` the sole git-write path.

## Task graph format

`tasks.md` and fast-lane `quick-spec.md` `## Tasks` use vertical slices:

```
- [ ] **T001 [AFK] <title>**: <thin independently verifiable slice>
  - blocked_by: none
  - verifies: AC1
  - touches: api, ui, tests
  - type: feat
```

Rules:
- Task ID is the `Tnnn` token. Legacy bullets without IDs are allowed; treat them as AFK tasks with implicit order.
- Type is `[AFK]` or `[HITL]`. Missing type defaults to `[AFK]` for legacy tasks.
- `blocked_by` is `none` or comma-separated task IDs.
- `type` (`feat`/`fix`/`refactor`/`chore`/`docs`, set by the task planner) drives the commit type prefix in Step 7.5. Missing on a Step 2b auto-generated review-fix task ⇒ `fix`; missing anywhere else ⇒ `chore`.
- A task is unlocked only when all `blocked_by` IDs are completed (`- [x]`).
- `[HITL]` tasks are human checkpoints. Do not implement them. If the next unlocked work is HITL-only, return `Status: blocked` with the exact task and `Next: /sdd-hitl $ARGUMENTS <Tnnn> "<decision>"`.
- Default scope is **one unlocked AFK vertical slice** per invocation. `/sdd-next` and `/sdd-auto` will re-run you for the next unlocked slice, keeping each sub-agent context clean.
- If the orchestrator passes `FORCE_TASK_ID=Tnnn`, select exactly that task for a validation retry. If it is currently checked (`- [x]`), reopen it (`- [ ]`) before retrying because the previous completion was invalidated. Still respect `blocked_by` dependencies and never implement `[HITL]` tasks.

## TDD detection (hard rule)

Determine `TDD_MODE` deterministically. It is **ON** if ANY of these is true:

1. A test framework is configured (`jest.config*`, `vitest.config*`, `pytest.ini`/`pyproject.toml [tool.pytest]`, `.rspec`, `go.mod` with `_test.go` files, `cargo` with `#[test]`, etc.).
2. Test files already exist (any `*.test.*`, `*.spec.*`, `*_test.*`, `test_*.*`, or files under `tests/`, `__tests__/`, `spec/`).
3. `.claude/rules/testing.md` declares a TDD stance (e.g. a `tdd: strict` line or TDD conventions).

**If the repo already has tests or a test framework, `TDD_MODE` is ON — it is not a judgment call.** Run `Glob`/`Bash` to check 1 and 2 before deciding; do not infer from memory.

`.claude/rules/testing.md` provides explicit overrides that win over auto-detection: a `tdd: strict` line forces `TDD_MODE` ON (even with no tests yet — introduce the framework and write the failing test first); a `tdd: off` line forces it OFF (test-first stays preferred, not gated). Absent an explicit line, silence never turns `TDD_MODE` OFF when tests/framework exist.

When `TDD_MODE` is ON, execute each task with testable behavior using the RED → GREEN → REFACTOR cycle:
1. **RED**: Write a failing test that captures the expected behavior for this task. Run it; paste the real failure output.
2. **GREEN**: Write the minimum code to make the test pass.
3. **REFACTOR**: Clean up the code while keeping tests green.

`TDD_MODE` OFF (greenfield repo with no tests and no framework yet): still write a test-first for any testable behavior when a framework can be added trivially; otherwise follow the standard flow and record why in `decisions.md`.

## Auto-commit knob

Determine `AUTO_COMMIT` once, before Step 7.5. Grep `.claude/rules/git.md` for a line matching `^auto-commit:\s*off`. Found ⇒ `AUTO_COMMIT` is **off**: skip Step 7.5 entirely and report `Commit: none`. Absent ⇒ `AUTO_COMMIT` is **on** (the default): Step 7.5 runs. This mirrors the `tdd:` knob in `testing.md` — the agent reads the rules file directly; the CLI never reads it.

## TDD quality bar

When a task has testable behavior, apply these rules whether or not the repo is strict-TDD:

- Test through public interfaces, not private helpers or internal call shape.
- Work in vertical slices: one behavior → one failing test → minimal implementation → green. Do NOT write all tests first and then all implementation.
- A test must fail for the expected reason before implementation. Paste the real RED output in `Validations-Output` or the task notes.
- Prefer integration-style tests over mocks. Mock only slow/flaky/paid/unavailable external boundaries.
- Test names must read like behavior specs and use domain terms from the spec/plan/codebase.
- Never refactor while RED. Refactor only after the current behavior is GREEN, then rerun the relevant tests.
- Do not mark a task complete until the behavior has a passing test or a `Test-skip rationale` entry explains why no test applies.

## Steps

1. **Recover prior context (once)** — Call `mem_search` with query `sdd/$ARGUMENTS` + domain keywords, `project: "{project}"` to recover architecture decisions, patterns, and discoveries from planning and prior tasks. If Engram is unavailable, skip. **Do this only on the first invocation** — if the orchestrator already passed context or this is a continuation, skip.

2. Read state files:
   - **FAST_LANE = false**: Read `specs/$ARGUMENTS/spec.md`, `plan.md`, and `tasks.md`.
   - **FAST_LANE = true**: Read `specs/$ARGUMENTS/quick-spec.md` (combined spec + plan + change list). Treat its `## Tasks` section as the task list.
   - If the required file(s) don't exist, tell the user which step to run first.

2b. **Review-fix cycle** — If the invoker (user or orchestrator) passed `Review-Feedback` (a structured table from `/review-feature`, with a **Task bullet** column), first **reopen** the listed tasks before planning. The `Review-Feedback` table has the form `| # | Task bullet (verbatim) | Criterion | Status | Source | Fix Required |`. For each row:
   - If the Task-bullet cell contains verbatim text matching an existing `- [x]` bullet in `tasks.md` (full-flow) or `quick-spec.md` `## Tasks` (fast-lane), flip that bullet back to `- [ ]`.
   - If the cell reads `(new task needed — not in list)`, append a new AFK task in the same `## Tasks` section:
     ```
     - [ ] **Tnnn [AFK] Review fix**: <Fix Required>
       - blocked_by: none
       - verifies: review-feedback
       - touches: affected files from the feedback, or unknown
       - type: fix
     ```
     Pick the next unused task ID.

   Manual users pass `Review-Feedback` by copying the entire `### Review-Feedback` block from `/review-feature`'s result into their `/implement-task` message. If no `Review-Feedback` was passed, skip this step.

3. **Select the next vertical slice**
   - Parse all checkbox task bullets and their indented metadata.
   - Also capture each task's `type:` metadata alongside `blocked_by` — Step 7.5 needs it for the commit message. Missing `type:` on a Step 2b auto-generated review-fix task ⇒ `fix`; missing anywhere else ⇒ `chore`.
   - Build a completed-ID set from all `- [x]` tasks.
   - Parse optional `FORCE_TASK_ID=Tnnn` from the invoker prompt.
   - If `FORCE_TASK_ID` is present:
     - Locate the matching task by ID. If it does not exist, return `Status: blocked` with `Risks: FORCE_TASK_ID not found`.
     - If it is checked (`- [x]`), flip it back to unchecked (`- [ ]`) in the task list before retrying.
     - If it is `[HITL]`, return `Status: blocked` with the exact task and required decision.
     - If any `blocked_by` dependency is incomplete, return `Status: blocked` listing the missing blockers.
     - Select that task and skip normal first-unlocked selection.
   - For legacy bullets with no task ID, preserve old behavior: select only the first unchecked legacy bullet in file order.
   - Ignore locked tasks whose `blocked_by` entries are not all completed.
   - If the orchestrator passed a specific task or set of tasks (e.g., review fix cycle), restrict selection to those reopened/new tasks; still respect dependencies.
   - Select the first unlocked unchecked `[AFK]` task in file order. This is the only task for this invocation.
   - If no AFK task is unlocked but an unchecked `[HITL]` task is unlocked, return `Status: blocked` with `Next: /sdd-hitl $ARGUMENTS <Tnnn> "<decision>"`.
   - If unchecked tasks remain but all are locked, return `Status: blocked` listing the first locked task and its missing blockers.
   - If no unchecked tasks remain, return `Status: success` with `Next: /simplify-code $ARGUMENTS`.

4. **Implement the selected task**:
   a. Read and understand the relevant code paths.
   b. **Test-first gate** — before writing implementation code:
      - **If the task has testable behavior**: write the test first, run it, paste the real failure output, only then implement. **This is mandatory whenever `TDD_MODE` is ON (see TDD detection) — i.e. always, in any repo that already has tests or a test framework.** Implementing testable behavior without a preceding failing test in `TDD_MODE` is a gate violation: stop, write the test, and redo. When `TDD_MODE` is OFF it is strongly preferred.
      - The test must exercise the public interface that users/callers rely on. Do not couple the test to private functions, transient data shape, or implementation-only collaborators.
      - Write exactly one new behavior test at a time. Get it GREEN before adding the next behavior test.
      - **If the task is not testable** (infra, config, migration, exploration, prose docs): document the reason inline in `decisions.md` under a `## Test-skip rationale` heading for that task — one line is enough.
   c. Write the code change (if TDD mode: follow RED → GREEN → REFACTOR cycle).
   d. **Self-review before marking complete** — re-read the full diff for this task and confirm:
      - (a) every change is in scope of the current task,
      - (b) nothing was added that wasn't asked for,
      - (c) the task's acceptance criteria are met.
      If any check fails, revert the out-of-scope change before continuing.
   e. Do NOT mark the task complete yet. Record it as `Task attempted`; it is only completed after validation passes.
   f. If the implementation diverges from the spec, note the delta (don't write it yet — record it in step 7).

5. **Validate after the slice** — Run lint, typecheck, and tests in parallel via separate Bash calls. **Paste the REAL terminal output** of each command into the result envelope's `Validations-Output` field — do not paraphrase, do not summarize. Valid: `===== 4 passed in 0.32s =====`. Invalid: `tests pass`.
   - **Lint** → PASS/FAIL (run if linter is configured)
   - **Type check** → PASS/FAIL (run if type checker is configured)
   - **Tests** (files touched by the slice) → PASS/FAIL
   - **If ALL pass** → proceed to step 6.
   - **If ANY fail** → read the error output, fix the issue inline, and re-run validations. Repeat up to **3 inline fix attempts** per failure. If still failing after 3 attempts, stop and report `Status: blocked` with the validation output pasted verbatim. Leave the selected task unchecked and set `Task completed: None (blocked before completion)`.

6. **Mark the validated task completed**:
   - Only after all validations pass, mark the selected task as completed.
   - **FAST_LANE = false**: change the selected task bullet from `- [ ]` to `- [x]` in `tasks.md`.
   - **FAST_LANE = true**: change the selected task bullet from `- [ ]` to `- [x]` in `quick-spec.md` `## Tasks` section (NOT `tasks.md` — there is no `tasks.md` for fast-lane features).

6b. **Record the `implemented-by` marker**: Append one line to `specs/$ARGUMENTS/decisions.md`:
    ```
    [<ISO-8601 UTC timestamp>] implemented-by: <runtime>
    ```
    - Timestamp: `date -u +%Y-%m-%dT%H:%M:%SZ`.
    - `<runtime>` is the runtime executing this task — `claude` when running in Claude Code, `codex` when the Codex port runs this same agent. Never hardcode `claude`; use whichever runtime you actually are.
    - Dedupe rule is **consecutive-only**: read the last `implemented-by:` line in the file (if any). Skip the append only when that last line's value equals the current runtime's value. Do not dedupe against earlier, non-consecutive lines — an alternating sequence like `claude` → `codex` → `claude` must record all three.
    - If `decisions.md` doesn't exist yet, create it with a `# Decisions` heading before appending.

7. **Delta spec check**: If the selected task changed, added, or removed requirements from the original spec, document all deltas in `specs/$ARGUMENTS/decisions.md` in a single entry:
   ```
   ## Delta: [date] — Task Tnnn
   - **ADDED**: [new requirement or behavior not in original spec]
   - **MODIFIED**: [original requirement] → [how it changed and why]
   - **REMOVED**: [requirement dropped and why]
   ```
   Only include sections (ADDED/MODIFIED/REMOVED) that apply. Skip this step if all tasks matched the spec exactly.

7.5. **Commit the slice** — runs after Step 6 (checkbox flip), Step 6b (`implemented-by` marker), and Step 7 (deltas), so the commit captures all three. Skip entirely if `AUTO_COMMIT` is off: set `Commit: none` and go straight to Step 8.
   - Resolve `type` for the selected task (captured in Step 3): the task's `type:` value, else `fix` for a Step 2b auto-generated review-fix task, else `chore`.
   - Call:
     ```
     sdd commit-slice $ARGUMENTS --type <type> [--task Tnnn] --title "<slice title>" --files <paths…>
     ```
     `--files` lists only the paths this slice actually touched — never `git add -A` — and goes last (it is variadic and stops at the next `--*` token). Omit `--task` for a legacy bullet with no ID.
   - **On success**: record the printed SHA as `Commit: <sha>` for the result envelope.
   - **On failure** (`sdd commit-slice` exits non-zero): flip the task bullet back from `- [x]` to `- [ ]` — the same shape as the `FORCE_TASK_ID` re-open in Step 3 — set `Task completed: None (blocked before completion)` and `Commit: none`, and return `Status: blocked` with the CLI's stderr pasted verbatim. Note which graded exit code fired so the failure is diagnosable: `2`=usage, `3`=unresolvable, `4`=git failure, `5`=nothing staged. This preserves the invariant *task complete ⟹ commit exists*, which `/simplify-code`'s committed-diff scope depends on.

8. **Engram memory** (skip if Engram unavailable):
   - Save **only if** you discovered a gotcha, unexpected behavior, or non-obvious pattern during the slice → `mem_save` type: `discovery` or `pattern`, `project: "{project}"`
   - Don't save routine implementation work — if nothing surprised you, don't save anything.

## Result envelope

After completing the selected slice, output this summary:

```
## Result
- **Status**: success | partial | blocked
- **Summary**: [1-3 sentences — what was implemented in the vertical slice]
- **Artifacts**: [files modified/created]
- **Validations**: Lint: PASS/FAIL/SKIP | Types: PASS/FAIL/SKIP | Tests: PASS/FAIL/SKIP
- **Validations-Output**: [paste the concrete terminal output from the final validation run]
- **Task attempted**: [Task ID + exact task bullet selected for this invocation]
- **Task completed**: [Task ID + exact task bullet, or "None (blocked before completion)"]
- **Commit**: [SHA printed by `sdd commit-slice`, or "none" when `AUTO_COMMIT` is off or the task was blocked before Step 7.5]
- **Tasks remaining**: [N unchecked / total, plus locked/HITL count if relevant]
- **Next**: [next phase or "/review-feature $ARGUMENTS" if all complete]
- **Risks**: [blockers, questions, or spec divergences — or "None"]
```

## Rules
- Do not expand scope beyond the selected vertical slice.
- Do not refactor unrelated code.
- Keep changes minimal and coherent.
- **NEVER use Plan Mode**: Do NOT use `EnterPlanMode`. Write code and update files directly. Plan Mode breaks the SDD pipeline.
- Always validate before reporting done. Never skip validations.
- Always output the result envelope — it provides context for the next run.
- Document spec divergences as deltas in `decisions.md` — this feeds `/archive-feature` later.
- The `tasks.md` file MUST stay under 530 words. If updating it, keep it concise.
