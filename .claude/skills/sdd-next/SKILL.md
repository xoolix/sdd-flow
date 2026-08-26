---
name: sdd-next
description: Detect current SDD phase and run the next one (one step at a time)
user-invocable: true
disable-model-invocation: true
arguments: feature-id - optional — auto-detects if only one active feature exists
---

# SDD next phase

You are the **orchestrator**. Detect where the feature is in the pipeline and launch the next phase.

## Step 0: Engram session init

1. **Resolve project name**: Run `git remote get-url origin` → extract repo name (e.g., `github.com/user/my-app` → `my-app`). Fallback: current directory name. Cache this for the entire session.
2. Call `mem_session_start` with `project: "{project}"`, description: `SDD pipeline: continuing feature`
3. Call `mem_context` with `project: "{project}"` to load prior context.

If Engram tools are unavailable, skip this step. Still resolve the project name — pass it to sub-agents.

## Step 1: Resolve feature-id and flags

Feature-id (optional, with optional flags): `$ARGUMENTS`

**Flag extraction** (before resolving feature-id):
- Split `$ARGUMENTS` on whitespace.
- Extract the exact token `--minimal` if present (NOT substring match — `--minimal-foo` must NOT match).
- The remaining tokens (non-flag parts) form the raw feature-id string.
- Cache `has_minimal_flag = true/false` for Step 3.

**Feature-id resolution** (from the non-flag tokens):
If non-empty after stripping flags, use it as the feature-id. Otherwise:
1. List folders in `specs/` (excluding `archive/`).
2. If exactly one folder exists, use it.
3. If multiple folders exist, ask the user which one.
4. If none exist, tell the user to run `/sdd-new` first and STOP.

## Step 2: Detect current phase

Check which artifacts exist in `specs/<feature-id>/`:

| Check | How |
|-------|-----|
| Has `quick-spec.md`? | File exists and is not empty/template |
| Has `spec.md`? | Read file — verify it's not empty/template |
| Has `plan.md`? | File exists |
| Has `tasks.md`? | File exists |
| All tasks checked? | Full-flow: read `tasks.md`; fast-lane: read `quick-spec.md` `## Tasks` section; count `- [ ]` vs `- [x]` |
| Has **fresh** `.simplified` sentinel? | File exists AND `git-head:` line in the sentinel equals `git rev-parse HEAD`. A stale sentinel (SHA mismatch) is treated as absent — it will be cleaned up by `/simplify-code`'s pre-flight. |

Apply the decision table:

| Lane | Artifacts | All tasks [x]? | Fresh `.simplified`? | → Action |
|---|---|:---:|:---:|---|
| none | no `spec.md`, no `quick-spec.md` | — | — | STOP: "Run `/sdd-new` first." |
| full | `spec.md`, missing `plan.md` or `tasks.md` | — | — | Launch `/plan-feature` |
| full | `spec.md` + `plan.md` + `tasks.md` | No | — | Launch `/implement-task` |
| full | `spec.md` + `plan.md` + `tasks.md` | Yes | No | Launch `/simplify-code` |
| full | `spec.md` + `plan.md` + `tasks.md` | Yes | Yes | Launch `/review-feature` |
| fast | `quick-spec.md` and no `plan.md` | No | — | Launch `/implement-task` |
| fast | `quick-spec.md` and no `plan.md` | Yes | No | Launch `/simplify-code` |
| fast | `quick-spec.md` and no `plan.md` | Yes | Yes | Launch `/review-feature` |
| any | `sdd status <feature-id>` reports `phase: archived` | — | — | STOP — pipeline complete, PR already opened |
| any | `sdd status <feature-id>` reports `phase: ready-to-pr` | — | — | Human PR gate — see Step 3a |

> **Post-archive rows key off `sdd status`, not file existence.** Once `/archive-feature` moves the folder, `specs/<feature-id>/` no longer exists — the file-existence checks above can't see it (F4 in `decisions.md`). Run `sdd status <feature-id>` and read its `phase` field; the CLI's own archive-folder fallback resolves the moved path under `specs/archive/`.

If both `quick-spec.md` and `plan.md`/`tasks.md` exist, treat this as an invalid mixed lane and STOP with `Status: blocked`; ask the user to archive one lane or normalize the feature folder.

If the detected phase is `archived`, STOP: the pipeline is already complete. Skip Step 2b and Step 3 — show a one-line summary and go straight to Step 7 (Engram session close).

If the detected phase is `ready-to-pr`, skip Step 2b and Step 3 — go directly to **Step 3a: PR gate** below.

## Step 2b: Load skill registry

If `.claude/skills/skill-registry.md` exists, read it. This file contains:
- **Trigger Table**: maps each skill to its phases
- **Compact Rules**: 5-15 lines of actionable constraints per skill

For the phase about to be launched, collect all compact rules from skills whose `Phases` column in the trigger table includes that phase.

If the registry does not exist, skip this step (no project skills injected). Suggest the user run `/build-registry` to generate it.

## Step 3: Launch the phase

**Known-orchestrator guard (D-001/D-003 invariant — feature 017)**:

Before applying the branch logic below, define:

```
KNOWN_ORCHESTRATORS = ["plan-feature", "review-feature"]
# Keep in sync with sdd-auto/SKILL.md (intentional duplication per OQ-3 — DRY only when >5 entries)
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

**Filesystem-side branch (D-001 + D-003)**: after the guard above passes, check whether `.claude/agents/sdd-<phase>.md` exists.

```
if .claude/agents/sdd-<phase>.md EXISTS → leaf phase → spawn native agent
if .claude/agents/sdd-<phase>.md ABSENT  → orchestrator phase → invoke skill via Skill tool (runs inline)
```

This check is filesystem-only — no hardcoded list of phase names. Orchestrator phases (those whose body now lives in `.claude/skills/<phase>/SKILL.md`) have no agent file after the migration. Leaf phases (standalone executors) always have an agent file.

---

### Branch A — Leaf phase (agent file EXISTS)

Invoke the native agent `sdd-<phase>` via the Agent tool:

```
Agent(
  subagent_type: "sdd-<phase>",
  prompt: "<context: see below>"
)
```

**The agent declares model, disallowedTools, context, and mcpServers in its own frontmatter** (`.claude/agents/sdd-<phase>.md`). Do NOT pass `model=` from the orchestrator — the frontmatter is the single source of truth (per AC4 of feature 008).

**Prompt content** (pass to the agent as the full message):

- **First line**: `"CRITICAL: NEVER use EnterPlanMode or Plan Mode. Write all files directly using Write/Edit tools. Do NOT propose plans for approval."`
- `Feature-id: <feature-id>` (the resolved feature-id from Step 1, clean — no flags)
  - **Exception**: if `has_minimal_flag = true` AND the detected phase is `review-feature`, pass `Feature-id: <feature-id> --minimal` instead. All other phases receive the clean feature-id with no flags. This ensures `--minimal` is review-only (AC6 / EC5).
- The full content of `.claude/skills/_shared/sdd-phase-common.md` (shared rules)
- The full content of `.claude/skills/_shared/engram-protocol.md` (engram memory protocol)
- `Engram project name: "{project}"` (resolved in Step 0)
- If compact rules were collected in Step 2b, append them as a `## Project Standards (auto-resolved)` section

**Fallback** (if `subagent_type: "sdd-<phase>"` is not recognized by the runtime and returns an error):

1. Read `.claude/agents/sdd-<phase>.md` — extract the body (everything after the frontmatter).
2. Launch `subagent_type: "general-purpose"` with a prompt that includes the agent body + all context above.
3. This preserves behavior but loses the model-per-frontmatter benefit — degrade path only.

---

### Branch B — Orchestrator phase (agent file ABSENT)

Invoke the `<phase>` skill via the Skill tool, passing the resolved feature-id as args (append ` --minimal` when `has_minimal_flag = true` and the phase is `review-feature`). The skill body loads into the current context and you (the main Claude instance) carry out its orchestration steps inline. Do NOT re-implement the phase from memory, and do NOT Read the SKILL.md manually as a substitute for the Skill tool — the Skill tool is the only sanctioned load path.

If the Skill tool reports the skill does not exist, **STOP with a hard error** — do NOT fall back to a general-purpose agent (D-003: no orchestrator fallback). Report the missing skill name and the phase so the user can diagnose.

The Branch A context still governs the inline execution: apply `sdd-phase-common.md` and `engram-protocol.md`, use the resolved Engram project name, and inject compact rules from Step 2b into any sub-agents the phase spawns.

**Do NOT use a `model=` override** — inline execution runs in the current model context.

## Step 3a: PR gate (`ready-to-pr` only)

Reached only when Step 2 detects `phase: ready-to-pr`. This is the one exception to "never ask for user confirmation" (see Rules) — it mirrors the pause/resume shape `/sdd-hitl` uses for `[HITL]` task checkpoints: pause, wait for an explicit human answer, resume via a command.

1. Ask the human to confirm: "Ready to push `feature/<feature-id>` and open a draft PR. Confirm?"
2. **If not confirmed** (declines or asks to wait): STOP. Output the result envelope with `Status: blocked`, `Next: /sdd-next <feature-id>` (re-run when ready). Do not touch git.
3. **On confirmation**: run `sdd open-pr <feature-id>` via Bash. The orchestrator never calls `git push` or `gh` itself — `sdd open-pr` owns the pre-flight, the push, the draft PR creation, and writing `.pr-opened` (ADR 0002: `bin/sdd` is the sole git-write path).
4. **Success (exit 0)**: the command printed the PR URL on stdout. Report it to the human, `Status: success`, pipeline complete.
5. **Failure (non-zero exit)**: pre-flight failed (no `gh` on PATH, not authenticated, or no remote configured). Report the manual command the CLI printed on stderr. `.pr-opened` was not written, so the gate stays resumable — re-running `/sdd-next <feature-id>` detects `ready-to-pr` again. `Status: blocked`.
6. Either outcome: go to Step 7 (Engram session close) — do not loop back to Step 2.

## Step 4: Validate and retry

When the sub-agent returns, apply the **Post-Phase Validation Protocol** from `sdd-phase-common.md` section F:

1. **Artifacts exist** — `ls` each path listed in the `Artifacts` field of the return envelope.
2. **Envelope complete** — verify the return envelope contains all required fields: Status, Summary, Artifacts, Next, Risks.
3. **Lint/tests pass** — run lint, typecheck, and tests in parallel Bash calls (skip if the phase produces no code, e.g., spec or plan phases).

If **all checks pass**, proceed to Step 5.

If **any check fails**:
- If the failed phase is `implement-task`, pin the retry to the same slice:
  - Extract the `Task attempted` field from the previous result envelope.
  - Parse the first task ID in that field (`Tnnn`).
  - If `Task attempted` is missing or no task ID can be parsed, STOP with `Status: ESCALATED`; do not risk selecting the next unlocked task.
  - Re-launch `/implement-task` with the original prompt **plus**:
    ```
    RETRY VALIDATION FAILURE
    FORCE_TASK_ID=Tnnn
    Previous Task attempted: <verbatim Task attempted field>
    Validation failure:
    <which check(s) failed + concrete error output>
    Retry attempt: <n>/2
    ```
- If the failed phase is not `implement-task`, re-launch the sub-agent with the original prompt **plus** error context (which step(s) failed, error output, retry attempt number).
- **Max 2 retries** per phase invocation.
- If 2 retries are exhausted without passing, **STOP** and report with `Status: ESCALATED`, including a diagnostic with the error output from each attempt.

## Step 5: Evaluator-optimizer loop (review→fix→re-review)

After validation passes in Step 4, check if the phase that just ran was `/review-feature`:

1. **If the phase was NOT `/review-feature`** — skip this step, go to Step 6.
2. **If the phase was `/review-feature`** — inspect the result envelope:
   - **Verdict: PASS or PASS WITH WARNINGS** → skip this step, go to Step 6.
   - **Verdict: FAIL** → enter the fix loop.
   - **Verdict: BLOCKED-JUDGMENT-DAY-HIGH** or `Status: blocked` → STOP and report the judge findings for human decision.

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
4. **Re-launch `/simplify-code`**: The prior `/review-feature` FAIL deleted `specs/<feature-id>/.simplified`, so fix code must pass through simplify before re-review. Launch the simplify-code sub-agent (using Step 3 pattern).
5. **Validate simplify-code result**: Apply Step 4 validation. If simplify-code returns `Status: blocked` (regression revert or baseline red), **STOP** the fix loop and report the blocked status — the human must resolve the regression before the loop can continue.
6. **Re-launch `/review-feature`**: Launch the review-feature sub-agent (using Step 3 pattern) to re-review the updated implementation.
7. **Validate review result**: Apply Step 4 validation to the review result.
8. **Check verdict**:
   - **Verdict: PASS or PASS WITH WARNINGS** → exit loop, go to Step 6.
   - **Verdict: BLOCKED-JUDGMENT-DAY-HIGH** or `Status: blocked` → STOP and report the judge findings for human decision.
   - **Verdict: FAIL** → increment `review_cycle`. If `review_cycle > 2`, **STOP** with `Status: ESCALATED` and include a diagnostic showing the failed criteria from each review cycle so the human can intervene.

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
- You may only read state files: `spec.md`, `quick-spec.md`, `plan.md`, `tasks.md`, `decisions.md`.
- Never ask for user confirmation — launch phases and advance automatically. **Exception: the post-archive PR gate** (Step 3a, phase `ready-to-pr`) — pushing to the remote and opening a PR are outward-facing actions that need a human's explicit go-ahead. Every other phase still advances without asking.
- Always validate sub-agent results using the Post-Phase Validation Protocol (section F of `sdd-phase-common.md`).
- If a phase returns `blocked` or validation exhausts retries (`ESCALATED`), show the diagnostic and STOP.
- **Review cycle cap**: After `/review-feature` returns FAIL, the evaluator-optimizer loop allows at most **2 fix→re-review cycles**. If the review still fails after 2 cycles, ESCALATE.
- Always output the result envelope at the end of each phase cycle.
