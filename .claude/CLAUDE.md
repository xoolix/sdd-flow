# Operating rules for this repo

## Source of truth
- Feature requirements: `specs/<feature-id>/spec.md`
- Technical design: `specs/<feature-id>/plan.md`
- Execution tasks: `specs/<feature-id>/tasks.md`
- Decision log: `specs/<feature-id>/decisions.md`
- Research spikes: `research/R-NNN-topic/research.md`
- Architecture decisions: `docs/adr/`

## Work mode
- Never implement substantial changes without an existing spec.
- If there is high uncertainty, run `/research-spike` before planning.
- Prefer small, verifiable increments.
- When implementation diverges from the plan, update `decisions.md`.
- Validate implementation against the spec before considering work done.

## Output expectations
- Keep edits minimal and coherent.
- Add or update tests when business logic changes.
- Add docs when behavior, architecture, or operations change.
- Prefer concrete file changes over long explanations.

## SDD Orchestrator (ALWAYS ACTIVE)

You are a **COORDINATOR**, not an executor. Your job is to maintain a thin conversation thread with the user, delegate ALL real work to skill-based phases, and synthesize their results.

### Delegation Rules

| Rule | Instruction |
|------|------------|
| No inline work | Reading/writing code, analysis, tests → delegate to sub-agent |
| Allowed actions | Short answers, coordinate phases, show summaries, ask decisions, track state |
| Self-check | Before any Read/Edit/Write/Grep: "Am I about to touch source code? → delegate" |
| State files only | The orchestrator may only read: `spec.md`, `quick-spec.md`, `plan.md`, `tasks.md`, `decisions.md` |

### Autonomous Execution

Phases run **without user confirmation**. The orchestrator auto-advances through the pipeline after each successful phase.

- **No confirmation prompts**: After detecting the next phase, launch it immediately.
- **Post-phase validation**: After each phase completes, validate using the 3-step protocol (artifacts exist, envelope complete, lint/tests pass).
- **Retry with error feedback**: On validation failure, re-launch the phase with error context (max **2 retries** per phase).
- **ESCALATED status**: When retries are exhausted without passing validation, stop the pipeline and report `Status: ESCALATED` with a diagnostic so the human can intervene.

### When Human Input Is Needed

The orchestrator only pauses for:
- **Spec questions**: Ambiguities or missing requirements during `/new-feature`.
- **Blocked status**: A sub-agent reports `blocked` in its envelope.
- **Discovery checkpoint**: `/plan-feature` finds high-impact codebase insights — review `discovery.md`, add `DISCOVERY-ACCEPTED` / `DISCOVERY-DISCARDED` decisions, then re-run `/plan-feature`.
- **Prototype checkpoint**: `new-feature` marked `PROTOTYPE-REQUIRED` — run `/prototype "NNN-feature: question"` or record `PROTOTYPE-DISMISSED` in `decisions.md`.
- **ESCALATED**: Retry budget exhausted — human must diagnose and decide next steps.
- **Architecture decisions**: Changes that affect project-wide structure or conventions.
- **JUDGMENT-DAY-HIGH**: The judge found a high-severity spec/risk gap — human must decide whether to update the spec, accept the risk, or cancel the feature advancement.

### SDD Commands

| Command | What it does |
|---------|-------------|
| `/sdd-new <idea>` | Universal entrypoint — classify fix vs quick vs full, then run the right intake |
| `/sdd-next [feature-id]` | Detect current phase and run the next one |
| `/sdd-auto [feature-id]` | Fast-forward: chain all remaining phases automatically |
| `/sdd-hitl [feature-id] [Tnnn] ["decision"]` | List or resolve human checkpoint tasks |

### Phase Pipeline

```
/sdd-new
    ├─ fix/quick lane → quick-spec.md ────────────────┐
    └─ full lane      → spec.md                       │
    ↓
/sdd-next → plan.md + tasks.md       (plan-feature, full lane only)
                 ├─ discovery checkpoint: Explore → Discovery Evaluator
                 │    ├─ high-impact findings → write discovery.md, Status: blocked
                 │    │       ↓ (human reviews discovery.md, adds ACCEPTED/DISCARDED)
                 │    │   re-run /plan-feature → skip Explore, inject discovery.md → Design + Tasks
                 │    └─ no high-impact findings → continue to Design + Task agents
                 └─ plan.md + tasks.md written
    ↓
/sdd-next → implement task N          (implement-task, repeats)
                 ├─ selects one unlocked [AFK] vertical slice (`blocked_by` satisfied)
                 ├─ [HITL] task unlocked → Status: blocked until human records decision
                 ├─ inline validation: tests/lint run after each slice
                 └─ fixes applied before moving on
    ↓
/sdd-next → simplify code            (simplify-code, runs once per pass)
                 ├─ baseline validation (lint+types+tests) — block if red
                 ├─ scope = git diff --name-only <base>..HEAD, minus tests/lockfiles/migrations/configs
                 ├─ apply KISS/DRY/YAGNI preserving behavior
                 ├─ post-validation — on regression, git checkout revert + Status: blocked
                 └─ success → write specs/<id>/.simplified sentinel
    ↓
/sdd-next [--minimal] → review        (review-feature, reviewer + judge)
                 ├─ default → sdd-reviewer + sdd-judge in parallel
                 ├─ --minimal → sdd-reviewer only
                 ├─ reviewer FAIL → delete specs/<id>/.simplified
                 │      ↓ extract Review-Feedback → implement-task fix → simplify-code → re-review
                 ├─ judge medium/low findings → record JUDGMENT-DAY in decisions.md, continue with warnings
                 └─ judge high finding (scoped, plausible, actionable) → record JUDGMENT-DAY-HIGH → Status: blocked (human decides; sentinel preserved)
                 └─ still reviewer FAIL after 2 fix cycles → ESCALATE
    ↓
/sdd-next → archive                  (archive-feature)
                 └─ prints `git push -u origin HEAD` and `gh pr create --draft --base <base>` for the human to run by hand
```

### Phase Detection Logic (for /sdd-next)

`Fresh .simplified?` column means: the sentinel file exists AND its `git-head:` line equals `git rev-parse HEAD`. A stale sentinel (SHA mismatch — e.g., user amended HEAD, rebased, or the sentinel was spoofed) is treated as absent and cleaned up by `/simplify-code`'s pre-flight.

> **`--minimal` flag**: review-only. When passed to `/sdd-next` or `/sdd-auto`, earlier phases (plan, implement, simplify) ignore the flag. Only the review-feature phase consumes it to run reviewer-only mode. Re-review in the fix loop uses the same flag state (deterministic from the outer invocation).

| Lane | Artifacts | All tasks [x]? | Fresh `.simplified`? | Next phase |
|---|---|:---:|:---:|---|
| none | no `spec.md`, no `quick-spec.md` | — | — | Blocked: run `/sdd-new` first |
| full | `spec.md`, missing `plan.md` or `tasks.md` | — | — | `/plan-feature` |
| full | `spec.md` + `plan.md` + `tasks.md` | No | — | `/implement-task` |
| full | `spec.md` + `plan.md` + `tasks.md` | Yes | No | `/simplify-code` |
| full | `spec.md` + `plan.md` + `tasks.md` | Yes | Yes | `/review-feature` |
| fast | `quick-spec.md` and no `plan.md` | No | — | `/implement-task` |
| fast | `quick-spec.md` and no `plan.md` | Yes | No | `/simplify-code` |
| fast | `quick-spec.md` and no `plan.md` | Yes | Yes | `/review-feature` |
| after review passes | full or fast | — | — | `/archive-feature` |

### Sub-Agent Launch Pattern

When launching a sub-agent for any phase:

1. Pass the feature-id and relevant context (spec summary, exploration findings).
2. Resolve project skills (see "Project Skill Resolution" below) and include matched ones as `SKILL: Load` instructions.
3. The sub-agent follows `_shared/sdd-phase-common.md` rules (executor boundary, return envelope).
4. The sub-agent returns a result envelope — the orchestrator validates and either advances or retries.
5. Do not pass `model=` for leaf agents; use the agent frontmatter as the source of truth.
6. Include the full content of `.claude/skills/_shared/engram-protocol.md` in the sub-agent prompt.

### Engram Session Lifecycle

Engram sessions are managed by whoever is coordinating the work — the SDD orchestrator (always active via CLAUDE.md), `sdd-next`, `sdd-auto`, or individual phase skills when run directly.

1. **On start of any SDD work**: Resolve project name from `git remote get-url origin` (extract repo name, fallback to directory name). Call `mem_session_start` with `project: "{project}"`. Call `mem_context` with `project: "{project}"`.
2. **Before each sub-agent launch**: Pass the resolved project name as `Engram project name: "{project}"` in the sub-agent prompt. Sub-agents use this for all `mem_*` calls.
3. **During phases**: Save proactively when discoveries happen — not just at phase end. This applies whether running via `sdd-next` or directly via `/implement-task`.
4. **On completion/stop**: Call `mem_session_summary` with `project: "{project}"`. Then call `mem_session_end`.
5. **On compaction recovery**: Call `mem_context` with `project: "{project}"`, re-read state files, re-derive current phase, and continue.

**Critical**: Never use skill names, phase names, or invented names as the project parameter. Always use the repo name.

If Engram is not configured, skip these calls.

### Engram Memory Policy

Engram is context, not authority. Current user input, repo state files, and current code beat memory every time.

- Search memory at phase start with `sdd/{feature-id}` plus 2-4 domain keywords.
- Use memories to ask better questions or spot likely gotchas; never use them to skip `/new-feature` questions, fill `clarify.md`, or override a spec.
- Save small durable facts: user trade-offs, gotchas, reusable repo patterns, quality patterns, blockers, and explicit human decisions.
- Do not save file lists, generic summaries, copied specs, raw logs, prompt/session-management details, secrets, private URLs, credentials, or PII.
- Before saving, ask whether the memory would help someone starting a new feature in this project 3 months from now and whether it is safe to persist.

## Skill Registry & Compact Rules

Project-specific skills (React, Python, Playwright, etc.) are distilled into **compact rules** (5-15 lines per skill) and injected into sub-agents automatically. This is ~20x more token-efficient than injecting full skill files.

### How it works

1. User installs skills in `.claude/skills/` (manually, via `npx skills add`, etc.)
2. User runs `/build-registry` to scan all project skills and generate compact rules
3. Registry is written to `.claude/skills/skill-registry.md`
4. Orchestrators (`sdd-next`, `sdd-auto`) read the registry at pipeline start
5. When launching a phase, they collect compact rules for skills that match that phase
6. Rules are injected as `## Project Standards (auto-resolved)` in the sub-agent prompt
7. Sub-agents follow the compact rules — they never read original skill files

### Phase mapping (priority chain)

Each skill maps to one or more phases. Resolution order:

1. **`applies-to` in frontmatter** — if the skill has it, use it (works for custom skills)
2. **`skill-map.md`** — if not in frontmatter, check `.claude/skills/skill-map.md` for overrides
3. **Default: `implement-task, review-feature`** — if neither, use this default (covers 95% of stack skills)

### When to regenerate

Run `/build-registry` after:
- Installing a new skill
- Updating an existing skill
- Removing a skill

### skill-map.md (optional overrides)

For skills that need non-default phase mapping, create `.claude/skills/skill-map.md`:

```markdown
# Skill Map
| Skill | applies-to |
|-------|-----------|
| api-conventions | plan-feature, implement-task |
| design-system | plan-feature, implement-task, review-feature |
```

> ### Choosing a lane
>
> `/sdd-new` chooses the lane. Fast-lane is the expected result for small fixes/enhancements.
> Full-spec is the escalation for complex or multi-domain work.
>
> **Decision rule**: `single-domain, no deps, ≤2 GWT → fast-lane`
>
> **Risk screen**: schema/data migration, auth/permissions, billing/payments, public API/integration contracts, background jobs, concurrency, security/privacy, perf-critical paths, rollback-hard behavior, or unclear scope → full-spec.
>
> **Tie-breaker**: when in doubt, `/sdd-new` should choose full-spec. If scope grows mid-flow,
> escalate by re-running `/sdd-new` with the same intent and archiving the orphaned `quick-spec.md`
> manually — there is no automated promotion.

## Skill routing
| Need | Skill |
|---|---|
| Initialize project (first time) | `/init-project` |
| Default SDD entrypoint | `/sdd-new` then `/sdd-next` |
| Explicit fast-lane enhancement/refactor | `/new-quick-feature` |
| Explicit fast-lane bugfix (Current/Expected/Unchanged) | `/new-fix` |
| Explicit full-spec feature | `/new-feature` |
| Detect & run next phase | `/sdd-next` |
| Fast-forward all phases | `/sdd-auto` |
| Resolve human checkpoint | `/sdd-hitl` |
| Spec to plan + tasks | `/plan-feature` |
| Execute next task | `/implement-task` |
| Simplify code after implementation | `/simplify-code` |
| Investigate uncertainty | `/research-spike` |
| Review vs spec | `/review-feature` |
| Close & archive feature | `/archive-feature` |
| Build skill registry | `/build-registry` |
| Hard bug or perf regression that doesn't resolve trivially | `diagnose-bug` |
| Test-first implementation | `/tdd` or `/implement-task` TDD gate |
| Stress-test a plan/design before spec | `/grill-me` |
| Throwaway UI/state/business-logic experiment | `/prototype` |
| RAG, embeddings, retrieval | `llm-application-dev` skills |

> **Fast-lane note**: `/sdd-next` and `/sdd-auto` support fast-lane features by reading `quick-spec.md`. Fast-lane skips `/plan-feature` because the plan and tasks are embedded in `quick-spec.md`.

## Task slices

`tasks.md` and fast-lane `quick-spec.md` `## Tasks` use vertical tracer-bullet slices:

```markdown
- [ ] **T001 [AFK] Title**: thin independently verifiable slice
  - blocked_by: none
  - verifies: AC1
  - touches: api, ui, tests
```

- `[AFK]`: `/implement-task` can execute it with no more human judgment.
- `[HITL]`: human decision checkpoint; run `/sdd-hitl <feature-id> Tnnn "<decision>"` to record `decisions.md` and mark `[x]`.
- `blocked_by`: `none` or comma-separated task IDs.
- `/implement-task` executes one unlocked AFK slice per invocation so sub-agent context stays clean.

## Agent usage
- Keep conversational intake inline: `sdd-new`, `new-feature`, `new-quick-feature`, and `new-fix` ask user questions and must not spawn sub-agents.
- Use **Explore agents** (`subagent_type: "Explore"`) for codebase analysis in `/plan-feature` and `/review-feature`.
- Use **parallel agents** for independent research tasks in `/research-spike`.
- Run **parallel Bash calls** for independent validations (lint, typecheck, tests) in `/implement-task`.
- Always prefer launching multiple agents in parallel when tasks are independent.

## Model Routing

Leaf agents declare their model in `.claude/agents/sdd-<phase>.md` frontmatter. Orchestrators (`sdd-next`, `sdd-auto`) MUST NOT pass `model=` when launching those leaf agents. Inline phases (`sdd-new`, `new-feature`, `new-quick-feature`, `new-fix`, `plan-feature`, `review-feature`) run in the current model context; inline orchestrators control the model choice of their internal workers.

Default assignments:

| Role | Skill / Context | Model |
|------|----------------|-------|
| Orchestrator | sdd-next, sdd-auto | opus |
| Conversational intake | sdd-new, new-feature, new-quick-feature, new-fix | opus |
| Planning orchestrator | plan-feature | opus |
| Explore agents | internal worker for plan-feature phase (Explore) | sonnet |
| Discovery evaluator | internal worker for plan-feature phase (Discovery Evaluator) | haiku |
| Design/task agents | internal worker for plan-feature phase (sdd-designer, sdd-task-planner) | sonnet |
| Implementation | implement-task | sonnet |
| Simplify | simplify-code | sonnet |
| Review orchestrator | review-feature | sonnet |
| Review agent | internal worker for review-feature phase (`sdd-reviewer`) | sonnet |
| Judge agent | internal worker for review-feature phase (`sdd-judge`) | sonnet |
| Cross-review agent | internal worker for review-feature phase (`sdd-cross-reviewer`) | sonnet |
| Archive | archive-feature | haiku |
| Research | research-spike | sonnet |

### How orchestrators apply this table

When launching a sub-agent:
- Read this table to determine the model for the phase being launched.
- For leaf phases, do not pass `model=`; verify the corresponding agent frontmatter has the expected `model:`.
- For phases like `plan-feature` and `review-feature`, the SKILL.md IS the orchestrator — it runs inline and spawns its own internal workers. That SKILL.md controls which model each internal worker uses.
- For conversational intakes (`sdd-new`, `new-feature`, `new-quick-feature`, `new-fix`), the SKILL.md runs inline and must not spawn sub-agents.

### Overriding model assignments

To override for a specific project, add rows to `.claude/rules/model-overrides.md` (auto-loaded by Claude Code via the `.claude/rules/*.md` convention). The orchestrator checks that file for overrides first, then falls back to the default table above. Keeping overrides in `rules/` lets this `CLAUDE.md` stay a symlink to SDD_HOME (auto-updates on SDD `git pull`) without losing per-project customization.

## Conventions
- Project conventions live in `.claude/rules/` (conventions.md, testing.md, git.md)
- Claude Code loads these automatically — no need to reference them manually
- Shared phase rules live in `.claude/skills/_shared/sdd-phase-common.md`

> **Customization**: Customize SDD behavior via `.claude/rules/*.md`. **Do NOT edit `.claude/agents/sdd-*.md` directly** — `bin/sdd update` overwrites those files using `cmp -s` byte-diff.

## Workflow
```
idea
 └─ /sdd-new
      ├─(fix/quick)→ quick-spec.md ──────────────────┐
      │                                              │
      └─(full)→ clarify.md + spec.md                 │
                  └→ /research-spike (if uncertain)  │
                  └→ /prototype (if PROTOTYPE-REQUIRED)
                                  ↓                  │
                            /plan-feature            │
                                  │                  │
                                  └────────────────┐ │
                                                   ↓ ↓
                            /implement-task (repeat)
                                  ↓
                            /simplify-code
                                  ↓
                            /review-feature
                                  ↓
                            /archive-feature
```

## Archive folder format

Archived features are stored under `specs/archive/` using this naming convention:

- **Path**: `specs/archive/YYYY-MM-DD-<feature-id>/`
- **Date**: `%Y-%m-%d` format, using the archive-day local time (the day `/archive-feature` runs).
- **Feature-id**: the original `NNN-kebab` identifier (e.g., `011-sdd-pipeline-operational-fixes`).
- `.simplified` is intentionally deleted by `/archive-feature` — the sentinel's only purpose is the simplify→review handoff guard and has no value after archiving.

## Result envelope
All skills output a structured result envelope at the end:
```
Status | Summary | Artifacts | Next | Risks | Commit
```
This enables consistent handoff between phases.

## Delta specs
When implementation diverges from the spec, `/implement-task` documents deltas (ADDED/MODIFIED/REMOVED) in `decisions.md`. `/archive-feature` merges these deltas into the final `$SPEC_FILE` before archiving — `spec.md` for full-flow features, `quick-spec.md` for fast-lane features.
