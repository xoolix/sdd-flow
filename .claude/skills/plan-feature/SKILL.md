---
name: plan-feature
description: Turn a feature spec into a technical plan and task list
user-invocable: true
arguments: feature-id
---

# Plan feature implementation

Feature-id: `$ARGUMENTS`

**Main Claude executes this skill body inline. You orchestrate sub-agents and synthesize results. Do NOT do the analysis work yourself — delegate to sub-agents.**

**Invocation guard**: run this phase only when the user explicitly typed `/plan-feature`, or an SDD orchestrator (`/sdd-next`, `/sdd-auto`) detected it as the next phase and invoked it. Never start it on your own initiative — if planning seems warranted, suggest the command and let the user decide.

> Sub-agents you launch MUST follow the executor boundary from `.claude/skills/_shared/sdd-phase-common.md` — they do the work themselves without re-delegating.

## Pre-flight checks

Before starting, verify the spec has all required elements:
- [ ] `specs/$ARGUMENTS/spec.md` exists
- [ ] Spec has a clear **Trigger** section
- [ ] Spec has a **Happy Path** with numbered steps
- [ ] Spec has at least **2 edge cases**
- [ ] Spec has at least **2 acceptance criteria** (preferably in Given/When/Then format)
- [ ] Spec has a **Rollback Plan**
- [ ] If `spec.md` or `decisions.md` contains `PROTOTYPE-REQUIRED`, `decisions.md` also contains `PROTOTYPE-RESULT` or `PROTOTYPE-DISMISSED`

If any check fails, tell the user what's missing and suggest running `/new-feature` again to complete the spec. Do NOT proceed with an incomplete spec.

For an unresolved `PROTOTYPE-REQUIRED`, do not suggest `/new-feature`; tell the user to run `/prototype "$ARGUMENTS: <question>"` or explicitly add `PROTOTYPE-DISMISSED` to `decisions.md` if they accept the risk.

## Discovery resume check

**Before proceeding with exploration**, check if `specs/$ARGUMENTS/discovery.md` already exists.

- **If `discovery.md` does not exist**: Proceed normally through all steps.
- **If `discovery.md` exists**: Existence alone does not mean reviewed — read its `## User decisions` section.
  - **Contains at least one `DISCOVERY-ACCEPTED` or `DISCOVERY-DISCARDED` entry**: The user has reviewed the findings. Skip Step 4 (Explore agents) and Step 4.5 (Discovery Checkpoint) entirely. Read `discovery.md` and inject its content as additional context into the Design + Task agents in Step 5. Record the `DISCOVERY-ACCEPTED` / `DISCOVERY-DISCARDED` user decisions from `discovery.md` into `specs/$ARGUMENTS/decisions.md`.
  - **Empty, or contains only the schema's placeholder line** (`- (leave blank — user fills in DISCOVERY-ACCEPTED or DISCOVERY-DISCARDED entries)`): The findings exist but nobody has decided anything yet. Do NOT treat the file as reviewed, do NOT proceed to Step 5, and do NOT fall back to re-running Step 4/4.5 as if `discovery.md` were absent — the findings already exist, only the decision is missing. Return `Status: blocked` (see the Blocked path below), telling the user to add at least one `DISCOVERY-ACCEPTED` or `DISCOVERY-DISCARDED` line under `## User decisions` in `specs/$ARGUMENTS/discovery.md`, then re-run `/plan-feature $ARGUMENTS`.

  **Ceiling on this check — state it plainly, never imply more**: this only proves *a* decision was recorded, not that every high-impact finding got one. `sdd-discovery-evaluator`'s JSON contract (`{category, description, impact, rationale}`) and `discovery.md`'s bullet schema carry no finding IDs anywhere, and `## User decisions` is free-form prose — so "one decision per high-impact finding" is not mechanically checkable here. A single `DISCOVERY-ACCEPTED` line satisfies this gate even if other high-impact findings above it were never addressed. That is a known, accepted limitation (see `spec.md`'s edge cases), not a gap this check is meant to close.

## Steps

**Step 0 — Session lifecycle guard** (avoids redundant session_start when invoked from sdd-next/sdd-auto):
- Call `mem_context` with `project: "{project}"`.
- Per "Active session detection" in `engram-protocol.md`: check whether `### Recent Sessions` is present in the response.
  - If present → an active session exists → SKIP `mem_session_start` (we are inside an active orchestrator like sdd-next/sdd-auto that already opened the session).
  - If absent, OR if `mem_context` errors / returns a response that does not contain `## Memory` (malformed) → call `mem_session_start` with `project: "{project}"`, `description: "SDD plan-feature: $ARGUMENTS"`.
- Mirror at phase end: if this step opened a session, close it with `mem_session_end` after the result envelope. If the session was pre-existing, do NOT call `mem_session_end`.
- If Engram is unavailable, skip this step entirely.

1. **Recover prior context** — Call `mem_search` with query `sdd/$ARGUMENTS` to load observations from the spec phase and any prior research. If Engram is unavailable, skip.

2. Read `specs/$ARGUMENTS/spec.md`. If it doesn't exist, tell the user to run `/new-feature` first.

2.5. **Domain vocabulary** — Resolve the project's domain vocabulary before Step 3 needs it, by running `sdd domain-vocab`:
   - Exit 0 with output ⇒ that stdout **is** the project's domain vocabulary. Step 3 identifies domains from it.
   - Exit non-zero, or the command unavailable ⇒ derive the domain list from `spec.md` instead — already read in Step 2 and always in context. Never from Step 4's exploration findings: the discovery-resume path above skips Step 4 entirely, so on that path those findings don't exist (021 took exactly this path).

   **Why this stays 2.5 instead of becoming the new Step 3** (renumbering everything after it): this file already has a `4.5` step, so a fractional insertion is the established pattern here, not a special case. Two references below are load-bearing on the *current* numbers — the discovery-resume note above ("Skip Step 4 ... and Step 4.5 ... into ... Step 5") and the designer hand-off note in Step 5 ("Domain analysis summary (from step 3)") — and both stay true untouched only because nothing was renumbered. Renumber this step and both go stale silently. Only the Domain vocabulary bullet inside Step 5 changes, into a back-pointer at this step instead of repeating the old instruction.

3. **Domain analysis** — Based on the spec, identify:
   - Which domains are involved — from Step 2.5's vocabulary, or from `spec.md` when Step 2.5 came back empty
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
   - **Domain vocabulary.** Already resolved in Step 2.5 — pass that vocabulary (or its spec-derived fallback) to `sdd-designer` unchanged; do not re-resolve it here. Per ADR 0003 (`docs/adr/0003-cli-resolves-content-agents-read-knobs.md`): the CLI resolves content (`sdd domain-vocab`), the agent reads knobs (like the `tdd` knob in `testing.md`) directly.
   - **`sdd-designer`**: Receives the spec + exploration findings (+ `discovery.md` content if resuming). Creates `specs/$ARGUMENTS/plan.md` using `.specify/templates/plan-template.md` as base. Fills in:
     - Domain analysis summary (from step 3)
     - Current state of relevant code
     - Proposed design
     - Touched areas — a `| Module / path | Change |` table, real paths only
     - Data flow
     - Migration / rollout — conditional: real content, or `N/A — <reason>` when this feature has no rollout surface
     - Observability — conditional: real content, or `N/A — <reason>` when this feature has no observability surface
     - Test strategy
     - Risks and mitigations
     - **Size budget**: The generated `plan.md` MUST be under 800 words. Prefer tables over prose.
   - **`sdd-task-planner`**: Receives the spec + exploration findings (+ `discovery.md` content if resuming). Creates `specs/$ARGUMENTS/tasks.md` using `.specify/templates/tasks-template.md` as base. Fills in:
     - Ordered vertical-slice tasks grouped by phase (foundation, core, validation)
     - Each task has stable ID, `[AFK]` or `[HITL]`, `blocked_by`, `verifies`, and `touches` metadata
     - Each AFK task should be implementable in one focused iteration and independently verifiable
     - Include test, documentation, and observability work inside the relevant vertical slice; do not create standalone horizontal validation tasks unless no behavior slice exists
     - For MEDIUM/LARGE features, add HITL checkpoint tasks only for real human decisions
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

**Blocked path**: `Status: blocked` is returned in two cases — Step 4.5 writing a fresh `discovery.md` with high-impact findings, and the Discovery resume check finding an existing `discovery.md` with no recorded decisions. In both cases:
- `Artifacts` MUST list `specs/$ARGUMENTS/discovery.md`
- `Summary` MUST summarize each high-impact finding, or — for the resume-check case — state that `discovery.md` already exists but `## User decisions` has no entries yet
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
