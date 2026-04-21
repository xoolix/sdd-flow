---
name: sdd-continue
description: Detect current SDD phase and run the next one automatically
user-invocable: true
disable-model-invocation: true
arguments: feature-id - optional — auto-detects if only one active feature exists
---

# Continue SDD pipeline

You are the **orchestrator**. Detect where the feature is in the pipeline and launch the next phase.

## Step 0: Engram session init

1. **Resolve project name**: Run `git remote get-url origin` → extract repo name (e.g., `github.com/user/my-app` → `my-app`). Fallback: current directory name. Cache this for the entire session.
2. Call `mem_session_start` with `project: "{project}"`, description: `SDD pipeline: continuing feature`
3. Call `mem_context` with `project: "{project}"` to load prior context.

If Engram tools are unavailable, skip this step. Still resolve the project name — pass it to sub-agents.

## Step 1: Resolve feature-id

Feature-id (optional): `$ARGUMENTS`

If non-empty, use it as the feature-id. Otherwise:
1. List folders in `specs/` (excluding `archive/`).
2. If exactly one folder exists, use it.
3. If multiple folders exist, ask the user which one.
4. If none exist, tell the user to run `/sdd-new` first and STOP.

## Step 2: Detect current phase

Check which artifacts exist in `specs/<feature-id>/`:

| Check | How |
|-------|-----|
| Has `spec.md`? | Read file — verify it's not empty/template |
| Has `plan.md`? | File exists |
| Has `tasks.md`? | File exists |
| All tasks checked? | Read `tasks.md`, count `- [ ]` vs `- [x]` |

Apply the decision table:

| spec.md | plan.md + tasks.md | All tasks [x] | → Action |
|:---:|:---:|:---:|---|
| No | — | — | STOP: "Run `/sdd-new` first." |
| Yes | No | — | Launch `/plan-feature` |
| Yes | Yes | No | Launch `/implement-task` |
| Yes | Yes | Yes | Launch `/review-feature` |

## Step 2b: Load skill registry

If `.claude/skills/skill-registry.md` exists, read it. This file contains:
- **Trigger Table**: maps each skill to its phases
- **Compact Rules**: 5-15 lines of actionable constraints per skill

For the phase about to be launched, collect all compact rules from skills whose `Phases` column in the trigger table includes that phase.

If the registry does not exist, skip this step (no project skills injected). Suggest the user run `/build-registry` to generate it.

## Step 3: Launch the phase

**Do NOT use the Skill tool.** Instead, read the skill's SKILL.md file and pass its full content as the sub-agent's prompt.

For each phase:

1. Read `.claude/skills/_shared/sdd-phase-common.md` (shared rules).
2. Read `.claude/skills/<phase-skill>/SKILL.md` (phase instructions).
3. Launch a sub-agent (`subagent_type: "general-purpose"`) with a prompt that includes:
   - **First line of the prompt MUST be**: `"CRITICAL: NEVER use EnterPlanMode or Plan Mode. Write all files directly using Write/Edit tools. Do NOT propose plans for approval."`
   - The full content of `sdd-phase-common.md`
   - The full content of the phase's `SKILL.md`
   - Feature-id for the sub-agent: pass the resolved feature-id from Step 1
   - The full content of `.claude/skills/_shared/engram-protocol.md` (Engram memory protocol)
   - `Engram project name: "{project}"` (the resolved project name from Step 0)
   - If compact rules were collected in Step 2b, append them as a `## Project Standards (auto-resolved)` section with all matching compact rule blocks

Phase-specific settings:

| Phase | mode | model | Notes |
|-------|------|-------|-------|
| plan-feature | `"auto"` | `opus` | Is itself an orchestrator — will launch its own sub-agents |
| implement-task | `"auto"` | `sonnet` | Include project skills if applicable |
| review-feature | `"auto"` | `sonnet` | Is itself an orchestrator |
| archive-feature | `"auto"` | `haiku` | Executor — does the work itself |

## Step 4: Validate and retry

When the sub-agent returns, apply the **Post-Phase Validation Protocol** from `sdd-phase-common.md` section F:

1. **Artifacts exist** — `ls` each path listed in the `Artifacts` field of the return envelope.
2. **Envelope complete** — verify the return envelope contains all required fields: Status, Summary, Artifacts, Next, Risks.
3. **Lint/tests pass** — run lint, typecheck, and tests in parallel Bash calls (skip if the phase produces no code, e.g., spec or plan phases).

If **all checks pass**, proceed to Step 5.

If **any check fails**:
- Re-launch the sub-agent with the original prompt **plus** error context (which step(s) failed, error output, retry attempt number).
- **Max 2 retries** per phase invocation.
- If 2 retries are exhausted without passing, **STOP** and report with `Status: ESCALATED`, including a diagnostic with the error output from each attempt.

## Step 5: Evaluator-optimizer loop (review→fix→re-review)

After validation passes in Step 4, check if the phase that just ran was `/review-feature`:

1. **If the phase was NOT `/review-feature`** — skip this step, go to Step 6.
2. **If the phase was `/review-feature`** — inspect the result envelope:
   - **PASS or PASS WITH WARNINGS** → skip this step, go to Step 6.
   - **FAIL** → enter the fix loop:

### Fix loop (max 2 cycles)

Initialize `review_cycle = 1`.

1. **Extract feedback**: Read the `Review-Feedback` field from the review envelope. This contains the structured list of failed criteria and fix instructions.
2. **Re-launch `/implement-task`**: Launch the implement-task sub-agent (using the same pattern from Step 3) with the original prompt **plus** this additional context prepended:
   ```
   REVIEW FIX CYCLE {{review_cycle}}/2 — The review found issues. Fix ONLY the following failed criteria before proceeding:
   {{Review-Feedback content}}
   ```
   The sub-agent should address only the failed criteria, not re-implement everything.
3. **Validate implement-task result**: Apply Step 4 validation to the implement-task result (artifacts exist, envelope complete, lint/tests pass). If validation fails, follow Step 4 retry logic.
4. **Re-launch `/review-feature`**: Launch the review-feature sub-agent (using Step 3 pattern) to re-review the updated implementation.
5. **Validate review result**: Apply Step 4 validation to the review result.
6. **Check verdict**:
   - **PASS or PASS WITH WARNINGS** → exit loop, go to Step 6.
   - **FAIL** → increment `review_cycle`. If `review_cycle > 2`, **STOP** with `Status: ESCALATED` and include a diagnostic showing the failed criteria from each review cycle so the human can intervene.

## Step 6: Present result and advance

After validation passes (and the evaluator-optimizer loop exits successfully, if applicable):
1. Show the result envelope summary to the user (Status, Summary, Artifacts, Next, Risks).
2. Immediately go back to Step 2 (re-detect phase with updated state) to run the next phase.
3. If the pipeline is complete (archive done) or status is `blocked`/`ESCALATED`, STOP and show the final summary.

## Step 7: Engram session close

When the pipeline stops (completion, blocked, or escalated):
1. Call `mem_session_summary` with `project: "{project}"` — phases completed, final status, and any blockers or risks.
2. Call `mem_session_end`.

If Engram tools are unavailable, skip this step.

## Rules
- You are the ORCHESTRATOR — never read source code, never edit code.
- You may only read state files: `spec.md`, `plan.md`, `tasks.md`, `decisions.md`.
- Never ask for user confirmation — launch phases and advance automatically.
- Always validate sub-agent results using the Post-Phase Validation Protocol (section F of `sdd-phase-common.md`).
- If a phase returns `blocked` or validation exhausts retries (`ESCALATED`), show the diagnostic and STOP.
- **Review cycle cap**: After `/review-feature` returns FAIL, the evaluator-optimizer loop allows at most **2 fix→re-review cycles**. If the review still fails after 2 cycles, ESCALATE.
- Always output the result envelope at the end of each phase cycle.
