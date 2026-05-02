---
name: plan-feature
description: Turn a feature spec into a technical plan and task list
user-invocable: true
disable-model-invocation: true
arguments: feature-id
---

# Plan feature implementation

Feature-id: `$ARGUMENTS`

**Main Claude executes this skill body inline. You orchestrate sub-agents and synthesize results. Do NOT do the analysis work yourself — delegate to sub-agents.**

> Sub-agents you launch MUST follow the executor boundary from `.claude/skills/_shared/sdd-phase-common.md` — they do the work themselves without re-delegating.

## Pre-flight checks

Before starting, verify the spec has all required elements:
- [ ] `specs/$ARGUMENTS/spec.md` exists
- [ ] Spec has a clear **Trigger** section
- [ ] Spec has a **Happy Path** with numbered steps
- [ ] Spec has at least **2 edge cases**
- [ ] Spec has at least **2 acceptance criteria** (preferably in Given/When/Then format)
- [ ] Spec has a **Rollback Plan**

If any check fails, tell the user what's missing and suggest running `/new-feature` again to complete the spec. Do NOT proceed with an incomplete spec.

## Discovery resume check

**Before proceeding with exploration**, check if `specs/$ARGUMENTS/discovery.md` already exists.

- **If `discovery.md` exists**: The user has already reviewed the discovery findings. Skip Step 4 (Explore agents) and Step 4.5 (Discovery Checkpoint) entirely. Read `discovery.md` and inject its content as additional context into the Design + Task agents in Step 5. Record any `DISCOVERY-ACCEPTED` / `DISCOVERY-DISCARDED` user decisions from `discovery.md` into `specs/$ARGUMENTS/decisions.md`.
- **If `discovery.md` does not exist**: Proceed normally through all steps.

## Steps

**Step 0 — Session lifecycle guard** (avoids redundant session_start when invoked from sdd-next/sdd-auto):
- Call `mem_context` with `project: "{project}"`.
- If the response indicates an active session is already running → SKIP `mem_session_start` (we are inside an active orchestrator like sdd-next/sdd-auto that already opened the session).
- Else (no active session) → call `mem_session_start` with `project: "{project}"`, `description: "SDD plan-feature: $ARGUMENTS"`.
- Mirror at phase end: if this step opened a session, close it with `mem_session_end` after the result envelope. If the session was pre-existing, do NOT call `mem_session_end`.
- If Engram is unavailable, skip this step entirely.

1. **Recover prior context** — Call `mem_search` with query `sdd/$ARGUMENTS` to load observations from the spec phase and any prior research. If Engram is unavailable, skip.

2. Read `specs/$ARGUMENTS/spec.md`. If it doesn't exist, tell the user to run `/new-feature` first.

3. **Domain analysis** — Based on the spec, identify:
   - Which domains are involved (db, api, frontend, infra, auth, notifications, integrations, etc.)
   - For each domain, assess complexity: **SMALL** (trivial change), **MEDIUM** (meaningful work), **LARGE** (significant effort or risk)
   - Determine overall strategy:
     - **SMALL** (1-2 domains, all small/medium): Execute directly, minimal planning overhead
     - **MEDIUM** (2-4 domains or any large domain): Sequential execution with checkpoints between phases
     - **LARGE** (4+ domains or multiple large): Consider decomposing into sub-features first
   - Document the domain analysis at the top of the plan

4. **Delegate codebase exploration** — Launch sub-agents with fresh context:
   - For each independent domain, launch a **parallel** `sdd-explore-agent` sub-agent (thoroughness: `"very thorough"`).
   - Each agent receives ONLY the spec and its assigned domain scope — not the full conversation context.
   - Use the architecture-map skill as a starting point to know where to look.
   - Collect structured results from each agent before proceeding.

4.5. **Discovery Checkpoint** — Launch `sdd-discovery-evaluator` sub-agent:
   - Pass the spec content and the combined raw results from all Explore agents.
   - Collect the JSON response with classified findings.
   - **Branching logic**:
     - **High-impact findings present** (`has_high_impact: true`):
       1. Write `specs/$ARGUMENTS/discovery.md` using the schema below.
       2. Return `Status: blocked` result envelope with a summary of high-impact findings.
       3. Do NOT proceed to Step 5.
     - **No high-impact findings** (`has_high_impact: false`):
       1. Do NOT write `discovery.md`.
       2. Continue to Step 5 with medium/low findings available as informational context.

   **`discovery.md` schema** (write only on high-impact findings):
   ```
   # Discovery Report
   status: findings-present
   ## High-impact findings
   - [category] [description] [impact: high]
   ## Other findings
   - [category] [description] [impact: medium|low]
   ## User decisions
   - (leave blank — user fills in DISCOVERY-ACCEPTED or DISCOVERY-DISCARDED entries)
   ```

5. **Delegate design and tasks in parallel** — Launch **both sub-agents simultaneously in a single message** with two `Agent` tool calls:
   - **`sdd-designer`**: Receives the spec + exploration findings (+ `discovery.md` content if resuming). Creates `specs/$ARGUMENTS/plan.md` using `.specify/templates/plan-template.md` as base. Fills in:
     - Domain analysis summary (from step 3)
     - Current state of relevant code
     - Proposed design
     - Touched files/modules, APIs, DB/schema, jobs, UI
     - Data flow
     - Migration / rollout strategy
     - Observability plan
     - Test strategy
     - Risks and mitigations
     - **Size budget**: The generated `plan.md` MUST be under 800 words. Prefer tables over prose.
   - **`sdd-task-planner`**: Receives the spec + exploration findings (+ `discovery.md` content if resuming). Creates `specs/$ARGUMENTS/tasks.md` using `.specify/templates/tasks-template.md` as base. Fills in:
     - Ordered, atomic tasks grouped by phase (foundation, core, validation)
     - Each task should be implementable in one focused iteration
     - Include test and documentation tasks
     - For MEDIUM/LARGE features, add checkpoint tasks between phases
     - **Size budget**: The generated `tasks.md` MUST be under 530 words. Keep tasks concise.

   **IMPORTANT**: Launch both agents in the same message to maximize parallelism. Do NOT wait for one to finish before launching the other.

6. **Review and present** — Read the artifacts created by sub-agents. Validate coherence between plan and tasks. Present summary to user: domain analysis, plan overview, and task list.

7. **Engram memory** (skip if Engram unavailable):
   - **During planning**: If sub-agents discover gotchas or non-obvious codebase patterns, save immediately with `mem_save` type: `discovery`
   - **After planning**: `mem_save` topic_key: `sdd/$ARGUMENTS/plan`, type: `decision` — Architecture trade-offs and why this approach was chosen over alternatives (not a plan summary)
   - If risks identified: `mem_save` topic_key: `sdd/$ARGUMENTS/plan`, type: `discovery` — Risks, unknowns, or codebase surprises that would help future features

## Result envelope

After completing, output:

```
## Result
- **Status**: success | partial | blocked
- **Summary**: [1-3 sentences describing the plan and tasks created, OR the discovery findings if blocked]
- **Artifacts**: [files created/modified — include discovery.md if written]
- **Next**: /implement-task $ARGUMENTS  (or: resolve findings in discovery.md then re-run /plan-feature $ARGUMENTS)
- **Risks**: [unknowns, complexity concerns, or "None"]
```

**Blocked path**: When `Status: blocked` is returned due to high-impact discovery findings:
- `Artifacts` MUST list `specs/$ARGUMENTS/discovery.md`
- `Summary` MUST summarize each high-impact finding
- `Next` MUST instruct the user to review `discovery.md`, add `DISCOVERY-ACCEPTED` or `DISCOVERY-DISCARDED` decisions under `## User decisions`, then re-run `/plan-feature $ARGUMENTS`

## Rules
- **Delegate, don't execute**: Your role is to orchestrate sub-agents and synthesize results, not to do the analysis yourself.
- **NEVER use Plan Mode**: Do NOT use `EnterPlanMode`. Write `plan.md` and `tasks.md` directly as files. Plan Mode breaks the SDD pipeline.
- Ground every decision in the actual repo structure.
- Prefer incremental rollout over big-bang rewrites.
- Surface unknowns that may require `/research-spike`.
- Each task must be concrete and independently verifiable.
- If overall complexity is LARGE, suggest decomposition before proceeding.
- Always output the result envelope at the end.
