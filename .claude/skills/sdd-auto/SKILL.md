---
name: sdd-auto
description: Auto-run — chain all remaining SDD phases automatically without pausing
user-invocable: true
disable-model-invocation: true
arguments: feature-id - optional — auto-detects if only one active feature exists
---

# SDD auto pipeline

Like `/sdd-next` but runs ALL remaining phases without asking between each one. Stops only on `blocked`, `ESCALATED` status, or pipeline completion.

## Step 0: Engram session init

1. **Resolve project name**: Run `git remote get-url origin` → extract repo name (e.g., `github.com/user/my-app` → `my-app`). Fallback: current directory name. Cache this for the entire session.
2. Call `mem_session_start` with `project: "{project}"`, description: `SDD fast-forward: {feature-id}`
3. Call `mem_context` with `project: "{project}"` to load prior context.

If Engram tools are unavailable, skip this step. Still resolve the project name — pass it to sub-agents.

## Step 1: Resolve feature-id and flags

Feature-id (optional, with optional flags): `$ARGUMENTS`

**Flag extraction** (before resolving feature-id, once at pipeline start):
- Split `$ARGUMENTS` on whitespace.
- Extract the exact token `--minimal` if present (NOT substring match — `--minimal-foo` must NOT match).
- The remaining tokens (non-flag parts) form the raw feature-id string.
- Cache `has_minimal_flag = true/false` for the entire pipeline run.

**Feature-id resolution** (from the non-flag tokens):
If non-empty after stripping flags, use it as the feature-id. Otherwise:
1. List folders in `specs/` (excluding `archive/`).
2. If exactly one folder exists, use it.
3. If multiple folders exist, ask the user which one.
4. If none exist, tell the user to run `/sdd-new` first and STOP.

## Step 1b: Load skill registry

Same as `/sdd-next` Step 2b: read `.claude/skills/skill-registry.md` if it exists. Cache the trigger table and compact rules for the entire pipeline run — no need to re-read on each phase.

## Step 2: Run pipeline loop

Initialize a **per-task retry tracker**: a map of `task-id → retry_count`, starting empty.

Repeat until pipeline is complete, blocked, or escalated:

1. **Detect phase** — same logic as `/sdd-next` Step 2, including both full-flow (`spec.md` + `plan.md` + `tasks.md`) and fast-lane (`quick-spec.md`) features, plus the two post-archive rows keyed off `sdd status <feature-id>`'s `phase` field rather than file existence — post-archive, the feature-id no longer resolves under `specs/<feature-id>/` (F4 in `decisions.md`).
   - **`phase: archived`** → pipeline complete. Exit the loop and go to Step 3.
   - **`phase: ready-to-pr`** → **stop; do not confirm the gate yourself.** This is the one carve-out to "never ask for user confirmation" (see Rules). Exit the loop and go to Step 3 — tell the human to run `/sdd-next <feature-id>` to take the gate.
2. **Launch phase** — known-orchestrator guard, then filesystem-side branch detection.

   **Known-orchestrator guard (D-001/D-003 invariant — feature 017)**:

   Before applying the branch logic below, define:

   ```
   KNOWN_ORCHESTRATORS = ["plan-feature", "review-feature"]
   # Keep in sync with sdd-next/SKILL.md (intentional duplication per OQ-3 — DRY only when >5 entries)
   ```

   If the resolved phase ∈ KNOWN_ORCHESTRATORS AND `.claude/agents/sdd-<phase>.md` exists:
   - HARD-ERROR. Print to stderr:
     ```
     ERROR: Orchestrator phase `<phase>` must NOT have a corresponding agent file at `.claude/agents/sdd-<phase>.md`.
     This file violates the architectural invariant from feature 015 (D-001/D-003) — orchestrator
     phases live as inline SKILL.md bodies, not native agents. Remediation: delete
     `.claude/agents/sdd-<phase>.md` or fix your local fork. See feature 015 ADR for context.
     ```
   - Stop the pipeline (do not spawn, do not fall back to inline). Return Status: ESCALATED with this diagnostic.
   - Sentinel preservation: if `specs/<feature-id>/.simplified` exists, leave it intact.

   ---

   **Filesystem-side branch detection (D-001 + D-003)**: after the guard above passes, check whether `.claude/agents/sdd-<phase>.md` exists.

   ```
   if .claude/agents/sdd-<phase>.md EXISTS → Branch A: leaf phase → spawn native agent
   if .claude/agents/sdd-<phase>.md ABSENT  → Branch B: orchestrator phase → invoke skill via Skill tool (runs inline)
   ```

   This check is filesystem-only — no hardcoded list of phase names. Orchestrator phases (those whose body now lives in `.claude/skills/<phase>/SKILL.md`) have no agent file after the migration. Leaf phases (standalone executors) always have an agent file.

   ---

   ### Branch A — Leaf phase (agent file EXISTS)

   Invoke the native agent `sdd-<phase>` via the Agent tool:

   - **Do NOT pass `model=`** — the agent's frontmatter is the single source of truth (per AC4 of feature 008).
   - **Prompt content**:
     - First line: `"CRITICAL: NEVER use EnterPlanMode or Plan Mode. Write all files directly using Write/Edit tools. Do NOT propose plans for approval."`
     - `Feature-id: <feature-id>` — pass the clean feature-id (no flags) for all phases EXCEPT:
       - If `has_minimal_flag = true` AND the detected phase is `review-feature`, pass `Feature-id: <feature-id> --minimal`. All other phases receive the clean feature-id. This ensures `--minimal` is review-only (AC6 / EC5).
     - Full content of `.claude/skills/_shared/sdd-phase-common.md` + `engram-protocol.md`
     - `Engram project name: "{project}"`
     - Compact rules (from Step 1b) appended as `## Project Standards (auto-resolved)` if present

   **Fallback** (if `subagent_type: "sdd-<phase>"` is not recognized by the runtime and returns an error):

   1. Read `.claude/agents/sdd-<phase>.md` — extract the body (everything after the frontmatter).
   2. Launch `subagent_type: "general-purpose"` with a prompt that includes the agent body + all context above.
   3. This preserves behavior but loses the model-per-frontmatter benefit — degrade path only.

   ---

   ### Branch B — Orchestrator phase (agent file ABSENT)

   Invoke the `<phase>` skill via the Skill tool, passing the resolved feature-id as args (append ` --minimal` when `has_minimal_flag = true` and the phase is `review-feature`). The skill body loads into the current context and you (the main Claude instance) carry out its orchestration steps inline. Do NOT re-implement the phase from memory, and do NOT Read the SKILL.md manually as a substitute for the Skill tool — the Skill tool is the only sanctioned load path.

   If the Skill tool reports the skill does not exist, **STOP with a hard error** — do NOT fall back to a general-purpose agent (D-003: no orchestrator fallback). Report the missing skill name and the phase so the user can diagnose.

   The Branch A context still governs the inline execution: apply `sdd-phase-common.md` and `engram-protocol.md`, use the resolved Engram project name, and inject compact rules from Step 1b into any sub-agents the phase spawns.

   **Do NOT use a `model=` override** — inline execution runs in the current model context.

3. **Validate result** — apply the **Post-Phase Validation Protocol** from `sdd-phase-common.md` section F:
   - **Artifacts exist** — `ls` each path listed in the `Artifacts` field of the return envelope.
   - **Envelope complete** — verify the return envelope contains all required fields: Status, Summary, Artifacts, Next, Risks.
   - **Lint/tests pass** — run lint, typecheck, and tests in parallel Bash calls (skip if the phase produces no code, e.g., spec or plan phases).
   - For `implement-task`, extract `Task attempted` from the result envelope and parse the first task ID (`Tnnn`). Cache this as `last_attempted_task_id` for retry handling.
4. **On validation success**:
   - If `status: success` or `partial` → show a one-line summary, continue to next iteration.
5. **On validation failure** — re-launch the sub-agent with the original prompt **plus** error context (which check(s) failed, error output, retry attempt number).
   - For **non-implement-task phases**: max 2 retries per phase invocation. If exhausted → ESCALATE and STOP.
   - For **implement-task phases**: use per-task tracking (see below).
6. **For implement-task**: The skill implements one unlocked `[AFK]` vertical slice per invocation. Launch implement-task once per slice; it will return a single result envelope.
   - **Per-slice retry tracking**: when a slice fails validation, use `last_attempted_task_id` from `Task attempted`. If it is missing or cannot be parsed, ESCALATE and **STOP the entire loop**; do not risk selecting the next unlocked task.
   - Increment `retry_tracker[last_attempted_task_id]`. If `retry_tracker[last_attempted_task_id] >= 2` → ESCALATE and **STOP the entire loop**.
   - On retry, re-launch `/implement-task` with the original prompt plus:
     ```
     RETRY VALIDATION FAILURE
     FORCE_TASK_ID=<last_attempted_task_id>
     Previous Task attempted: <verbatim Task attempted field>
     Validation failure:
     <which check(s) failed + concrete error output>
     Retry attempt: <retry_tracker value>/2
     ```
   - After each successful slice, re-detect remaining unchecked tasks. If more remain, launch implement-task again for the next unlocked slice.

## Step 2b: Evaluator-optimizer loop (review→fix→re-review)

After the pipeline loop (Step 2) launches `/review-feature` and validation passes (Step 2, item 3), check the review result:

- **Verdict: PASS or PASS WITH WARNINGS** → continue the pipeline loop (back to phase detection).
- **Verdict: FAIL** → enter the fix loop below.
- **Verdict: BLOCKED-JUDGMENT-DAY-HIGH** or `Status: blocked` → STOP and report the judge findings for human decision.

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
4. **Re-launch `/simplify-code`**: The prior `/review-feature` FAIL deleted `specs/<feature-id>/.simplified`, so fix code must pass through simplify before re-review. Launch the simplify-code sub-agent (using Step 2 item 2 pattern).
5. **Validate simplify-code result**: Apply Step 2 item 3 validation. If simplify-code returns `Status: blocked` (regression revert or baseline red), **STOP** the fix loop and report the blocked status — the human must resolve the regression before the loop can continue.
6. **Re-launch `/review-feature`**: Launch the review-feature sub-agent (using Step 2 item 2 pattern) to re-review the updated implementation. If `has_minimal_flag = true`, pass `Feature-id: <feature-id> --minimal` (same review mode as the original review).
7. **Validate review result**: Apply Step 2 item 3 validation to the review result.
8. **Check verdict**:
   - **Verdict: PASS or PASS WITH WARNINGS** → exit loop, continue the pipeline (back to phase detection in Step 2).
   - **Verdict: BLOCKED-JUDGMENT-DAY-HIGH** or `Status: blocked` → STOP and report the judge findings for human decision.
   - **Verdict: FAIL** → increment `review_cycle`. If `review_cycle > 2`, **STOP** with `Status: ESCALATED` and include a diagnostic showing the failed criteria from each review cycle so the human can intervene.

> **Note**: The review cycle counter is separate from the per-slice retry tracker. Per-slice retries handle validation failures (lint/tests); review cycles handle the evaluator-optimizer feedback loop after review-feature returns FAIL.

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

If the loop stopped at the PR gate (`phase: ready-to-pr`), use `Status: BLOCKED` and `Next: /sdd-next <feature-id>` — the gate needs a human to confirm before anything is pushed or a PR opens.

## Step 4: Engram session close

After producing the final summary:
1. Call `mem_session_summary` with `project: "{project}"` — all phases completed, final status, total tasks implemented, any blockers.
2. Call `mem_session_end`.

If Engram tools are unavailable, skip this step.

## Rules
- You are the ORCHESTRATOR — never read source code, never edit code.
- You may only read state files: `spec.md`, `quick-spec.md`, `plan.md`, `tasks.md`, `decisions.md`.
- Do NOT skip phases — run them in order.
- **Never ask for user confirmation** — run all phases and advance automatically. **Exception: the post-archive PR gate** (phase `ready-to-pr`) — `sdd-auto` stops there instead of confirming; pushing to the remote and opening a PR are outward-facing actions that need a human's explicit go-ahead. Every other phase still runs without asking.
- Always validate sub-agent results using the Post-Phase Validation Protocol (section F of `sdd-phase-common.md`).
- If implement-task returns `partial` or has remaining tasks, re-launch for the next unlocked slice.
- Show progress between slices: "Slice done: T003 (5/12 tasks). Launching next unlocked slice..."
- If any phase returns `blocked`, STOP immediately and show the reason.
- If validation exhausts retries (`ESCALATED`), show the diagnostic and STOP.
- Include matched compact rules (from Step 1b) when launching each phase.
- Per-slice retry budget is **2 attempts** — tracked across the entire pipeline run.
- **Review cycle cap**: After `/review-feature` returns FAIL, the evaluator-optimizer loop (Step 2b) allows at most **2 fix→re-review cycles**. If the review still fails after 2 cycles, ESCALATE.
