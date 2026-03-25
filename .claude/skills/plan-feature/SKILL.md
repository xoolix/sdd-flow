---
name: plan-feature
description: Turn a feature spec into a technical plan and task list
user-invocable: true
disable-model-invocation: true
arguments: feature-id
---

# Plan feature implementation

You received a feature-id in `$ARGUMENTS`.

**You are an orchestrator. Do NOT do the analysis work yourself — delegate to sub-agents and synthesize their results.**

## Pre-flight checks

Before starting, verify the spec has all required elements:
- [ ] `specs/$ARGUMENTS/spec.md` exists
- [ ] Spec has a clear **Trigger** section
- [ ] Spec has a **Happy Path** with numbered steps
- [ ] Spec has at least **2 edge cases**
- [ ] Spec has at least **2 acceptance criteria** (preferably in Given/When/Then format)
- [ ] Spec has a **Rollback Plan**

If any check fails, tell the user what's missing and suggest running `/new-feature` again to complete the spec. Do NOT proceed with an incomplete spec.

## Steps

1. Read `specs/$ARGUMENTS/spec.md`. If it doesn't exist, tell the user to run `/new-feature` first.

2. **Domain analysis** — Based on the spec, identify:
   - Which domains are involved (db, api, frontend, infra, auth, notifications, integrations, etc.)
   - For each domain, assess complexity: **SMALL** (trivial change), **MEDIUM** (meaningful work), **LARGE** (significant effort or risk)
   - Determine overall strategy:
     - **SMALL** (1-2 domains, all small/medium): Execute directly, minimal planning overhead
     - **MEDIUM** (2-4 domains or any large domain): Sequential execution with checkpoints between phases
     - **LARGE** (4+ domains or multiple large): Consider decomposing into sub-features first
   - Document the domain analysis at the top of the plan

3. **Delegate codebase exploration** — Launch sub-agents with fresh context:
   - For each independent domain, launch a **parallel Explore agent** (`subagent_type: "Explore"`, thoroughness: `"very thorough"`).
   - Each agent receives ONLY the spec and its assigned domain scope — not the full conversation context.
   - Use the architecture-map skill as a starting point to know where to look.
   - Collect structured results from each agent before proceeding.

4. **Delegate design and tasks in parallel** — Launch **both sub-agents simultaneously in a single message** with two `Agent` tool calls:
   - **Design agent** (`subagent_type: "general-purpose"`): Receives the spec + exploration findings. Creates `specs/$ARGUMENTS/plan.md` using `.specify/templates/plan-template.md` as base. Fills in:
     - Domain analysis summary (from step 2)
     - Current state of relevant code
     - Proposed design
     - Touched files/modules, APIs, DB/schema, jobs, UI
     - Data flow
     - Migration / rollout strategy
     - Observability plan
     - Test strategy
     - Risks and mitigations
     - **Size budget**: The generated `plan.md` MUST be under 800 words. Prefer tables over prose.
   - **Task planner agent** (`subagent_type: "general-purpose"`): Receives the spec + exploration findings. Creates `specs/$ARGUMENTS/tasks.md` using `.specify/templates/tasks-template.md` as base. Fills in:
     - Ordered, atomic tasks grouped by phase (foundation, core, validation)
     - Each task should be implementable in one focused iteration
     - Include test and documentation tasks
     - For MEDIUM/LARGE features, add checkpoint tasks between phases
     - **Size budget**: The generated `tasks.md` MUST be under 530 words. Keep tasks concise.

   **IMPORTANT**: Launch both agents in the same message to maximize parallelism. Do NOT wait for one to finish before launching the other.

5. **Review and present** — Read the artifacts created by sub-agents. Validate coherence between plan and tasks. Present summary to user: domain analysis, plan overview, and task list.

## Result envelope

After completing, output:

```
## Result
- **Status**: success | partial | blocked
- **Summary**: [1-3 sentences describing the plan and tasks created]
- **Artifacts**: [files created/modified]
- **Next**: /implement-task $ARGUMENTS
- **Risks**: [unknowns, complexity concerns, or "None"]
```

## Rules
- **Delegate, don't execute**: Your role is to orchestrate sub-agents and synthesize results, not to do the analysis yourself.
- Ground every decision in the actual repo structure.
- Prefer incremental rollout over big-bang rewrites.
- Surface unknowns that may require `/research-spike`.
- Each task must be concrete and independently verifiable.
- If overall complexity is LARGE, suggest decomposition before proceeding.
- Always output the result envelope at the end.
