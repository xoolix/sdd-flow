---
name: sdd-ff
description: Fast-forward — chain all remaining SDD phases automatically without pausing
user-invocable: true
disable-model-invocation: true
arguments: feature-id - optional — auto-detects if only one active feature exists
---

# Fast-forward SDD pipeline

Like `/sdd-continue` but runs ALL remaining phases without asking between each one. Stops only on `blocked`, `ESCALATED` status, or pipeline completion.

## Step 0: Engram session init

1. **Resolve project name**: Run `git remote get-url origin` → extract repo name (e.g., `github.com/user/my-app` → `my-app`). Fallback: current directory name. Cache this for the entire session.
2. Call `mem_session_start` with `project: "{project}"`, description: `SDD fast-forward: {feature-id}`
3. Call `mem_context` with `project: "{project}"` to load prior context.

If Engram tools are unavailable, skip this step. Still resolve the project name — pass it to sub-agents.

## Step 1: Resolve feature-id

If `$ARGUMENTS` is provided, use it. Otherwise:
1. List folders in `specs/` (excluding `archive/`).
2. If exactly one folder exists, use it.
3. If multiple folders exist, ask the user which one.
4. If none exist, tell the user to run `/sdd-new` first and STOP.

## Step 1b: Load skill registry

Same as `/sdd-continue` Step 2b: read `.claude/skills/skill-registry.md` if it exists. Cache the trigger table and compact rules for the entire pipeline run — no need to re-read on each phase.

## Step 2: Run pipeline loop

Initialize a **per-task retry tracker**: a map of `task-id → retry_count`, starting empty.

Repeat until pipeline is complete, blocked, or escalated:

1. **Detect phase** — same logic as `/sdd-continue` Step 2.
2. **Launch phase** — **Do NOT use the Skill tool.** Read the phase's SKILL.md + `_shared/sdd-phase-common.md` and pass their full content as the sub-agent's prompt.
   - **First line of the prompt MUST be**: `"CRITICAL: NEVER use EnterPlanMode or Plan Mode. Write all files directly using Write/Edit tools. Do NOT propose plans for approval."`
   - Use `mode: "auto"`.
   - Same launch pattern as `/sdd-continue` Step 3.
   - Pass `model: "<model>"` based on the Model Routing table in CLAUDE.md.
   - Include the full content of `.claude/skills/_shared/engram-protocol.md` in the sub-agent prompt.
   - Include `Engram project name: "{project}"` (the resolved project name from Step 0).
   - If compact rules were collected for the current phase (from Step 1b), append them as a `## Project Standards (auto-resolved)` section.
3. **Validate result** — apply the **Post-Phase Validation Protocol** from `sdd-phase-common.md` section F:
   - **Artifacts exist** — `ls` each path listed in the `Artifacts` field of the return envelope.
   - **Envelope complete** — verify the return envelope contains all required fields: Status, Summary, Artifacts, Next, Risks.
   - **Lint/tests pass** — run lint, typecheck, and tests in parallel Bash calls (skip if the phase produces no code, e.g., spec or plan phases).
4. **On validation success**:
   - If `status: success` or `partial` → show a one-line summary, continue to next iteration.
5. **On validation failure** — re-launch the sub-agent with the original prompt **plus** error context (which check(s) failed, error output, retry attempt number).
   - For **non-implement-task phases**: max 2 retries per phase invocation. If exhausted → ESCALATE and STOP.
   - For **implement-task phases**: use per-task tracking (see below).
6. **For implement-task**: The skill handles batching internally (SMALL features = all tasks at once, MEDIUM/LARGE = one phase at a time). Launch implement-task once per batch — it will implement multiple tasks and return a single result envelope.
   - **Per-batch retry tracking**: when a batch fails validation, increment `retry_tracker[batch-id]`. If `retry_tracker[batch-id] >= 2` → ESCALATE and **STOP the entire loop**.
   - On retry, re-launch with the same batch context plus the error output from the failed attempt.
   - After each successful batch, re-detect remaining unchecked tasks. If more remain, launch implement-task again for the next batch.

## Step 2b: Evaluator-optimizer loop (review→fix→re-review)

After the pipeline loop (Step 2) launches `/review-feature` and validation passes (Step 2, item 3), check the review result:

- **PASS or PASS WITH WARNINGS** → continue the pipeline loop (back to phase detection).
- **FAIL** → enter the fix loop below.

### Fix loop (max 2 cycles)

Initialize `review_cycle = 1`.

1. **Extract feedback**: Read the `Review-Feedback` field from the review envelope. This contains the structured list of failed criteria and fix instructions.
2. **Re-launch `/implement-task`**: Launch the implement-task sub-agent (using the same launch pattern from Step 2, item 2) with the original prompt **plus** this additional context prepended:
   ```
   REVIEW FIX CYCLE {{review_cycle}}/2 — The review found issues. Fix ONLY the following failed criteria before proceeding:
   {{Review-Feedback content}}
   ```
   The sub-agent should address only the failed criteria, not re-implement everything.
3. **Validate implement-task result**: Apply Step 2 item 3 validation (artifacts exist, envelope complete, lint/tests pass). If validation fails, follow item 5 retry logic.
4. **Re-launch `/review-feature`**: Launch the review-feature sub-agent (using Step 2 item 2 pattern) to re-review the updated implementation.
5. **Validate review result**: Apply Step 2 item 3 validation to the review result.
6. **Check verdict**:
   - **PASS or PASS WITH WARNINGS** → exit loop, continue the pipeline (back to phase detection in Step 2).
   - **FAIL** → increment `review_cycle`. If `review_cycle > 2`, **STOP** with `Status: ESCALATED` and include a diagnostic showing the failed criteria from each review cycle so the human can intervene.

> **Note**: The review cycle counter is separate from the per-batch retry tracker. Per-batch retries handle validation failures (lint/tests); review cycles handle the evaluator-optimizer feedback loop after review-feature returns FAIL.

## Step 3: Final summary

When the pipeline completes (or is blocked/escalated), output:

```
## Fast-Forward Complete

**Feature**: <feature-id>
**Phases completed**: <list>
**Final state**: <where the feature is now>
**Status**: SUCCESS | ESCALATED | BLOCKED
**Next**: <what to do next, if anything>
```

If `ESCALATED`, include a diagnostic section with the error output from each failed attempt.

## Step 4: Engram session close

After producing the final summary:
1. Call `mem_session_summary` with `project: "{project}"` — all phases completed, final status, total tasks implemented, any blockers.
2. Call `mem_session_end`.

If Engram tools are unavailable, skip this step.

## Rules
- You are the ORCHESTRATOR — never read source code, never edit code.
- You may only read state files: `spec.md`, `plan.md`, `tasks.md`, `decisions.md`.
- Do NOT skip phases — run them in order.
- **Never ask for user confirmation** — run all phases and advance automatically.
- Always validate sub-agent results using the Post-Phase Validation Protocol (section F of `sdd-phase-common.md`).
- If implement-task returns `partial` or has remaining tasks, re-launch for the next batch.
- Show progress between batches: "Batch done: 5/12 tasks (Phase 1 + 2). Launching next batch..."
- If any phase returns `blocked`, STOP immediately and show the reason.
- If validation exhausts retries (`ESCALATED`), show the diagnostic and STOP.
- Include matched compact rules (from Step 1b) when launching each phase.
- Per-batch retry budget is **2 attempts** — tracked across the entire pipeline run.
- **Review cycle cap**: After `/review-feature` returns FAIL, the evaluator-optimizer loop (Step 2b) allows at most **2 fix→re-review cycles**. If the review still fails after 2 cycles, ESCALATE.
