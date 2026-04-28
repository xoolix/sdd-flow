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
| State files only | The orchestrator may only read: `spec.md`, `plan.md`, `tasks.md`, `decisions.md` |

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
- **ESCALATED**: Retry budget exhausted — human must diagnose and decide next steps.
- **Architecture decisions**: Changes that affect project-wide structure or conventions.
- **SPEC-GAP-HIGH**: Adversarial review found high-severity spec gaps — human must decide whether to update the spec, accept the gap, or cancel the feature advancement.

### SDD Commands

| Command | What it does |
|---------|-------------|
| `/sdd-new <idea>` | Start new feature — read and follow `/new-feature` skill directly |
| `/sdd-next [feature-id]` | Detect current phase and run the next one |
| `/sdd-auto [feature-id]` | Fast-forward: chain all remaining phases automatically |

### Phase Pipeline

```
/sdd-new → spec.md
    ↓
/sdd-next → plan.md + tasks.md       (plan-feature)
                 ├─ discovery checkpoint: Explore → Discovery Evaluator
                 │    ├─ high-impact findings → write discovery.md, Status: blocked
                 │    │       ↓ (human reviews discovery.md, adds ACCEPTED/DISCARDED)
                 │    │   re-run /plan-feature → skip Explore, inject discovery.md → Design + Tasks
                 │    └─ no high-impact findings → continue to Design + Task agents
                 └─ plan.md + tasks.md written
    ↓
/sdd-next → implement task N          (implement-task, repeats)
                 ├─ inline validation: tests/lint run after each change
                 └─ fixes applied before moving on
    ↓
/sdd-next → simplify code            (simplify-code, runs once per pass)
                 ├─ baseline validation (lint+types+tests) — block if red
                 ├─ scope = git diff --name-only <base>..HEAD, minus tests/lockfiles/migrations/configs
                 ├─ apply KISS/DRY/YAGNI preserving behavior
                 ├─ post-validation — on regression, git checkout revert + Status: blocked
                 └─ success → write specs/<id>/.simplified sentinel
    ↓
/sdd-next → review                   (review-feature, 3-agent voting)
                 ├─ 3 independent reviewers run in parallel
                 ├─ PASS or PASS WITH WARNINGS → adversarial review (Step 5.5)
                 │       ├─ no gaps → advance to archive
                 │       ├─ medium/low gaps → record SPEC-GAP in decisions.md → advance
                 │       └─ high-severity gaps → record SPEC-GAP-HIGH → Status: blocked (human decides; sentinel preserved)
                 └─ any FAIL        → delete specs/<id>/.simplified (forces re-simplify after fix)
                        ↓
                   extract Review-Feedback
                        ↓
                   implement-task (fix feedback)
                        ↓
                   /simplify-code (re-runs — sentinel absent)
                        ↓
                   re-review (3-agent voting)
                        ↓
                   still FAIL after 2 cycles → ESCALATE
    ↓
/sdd-next → archive                  (archive-feature)
```

### Phase Detection Logic (for /sdd-next)

`Fresh .simplified?` column means: the sentinel file exists AND its `git-head:` line equals `git rev-parse HEAD`. A stale sentinel (SHA mismatch — e.g., user amended HEAD, rebased, or the sentinel was spoofed) is treated as absent and cleaned up by `/simplify-code`'s pre-flight.

> **Fast-lane features are NOT detected by this table.** If a folder has `quick-spec.md` but no `spec.md`, `/sdd-next` will return "Blocked: run `/sdd-new` first" — this is expected per B7 (manual-only invocation). Invoke phases manually per the `Next` field in each envelope. See the Fast-lane note under Skill routing.

| Has spec.md? | Has plan.md + tasks.md? | All tasks [x]? | Fresh `.simplified`? | Next phase |
|:---:|:---:|:---:|:---:|---|
| No | — | — | — | Blocked: run `/sdd-new` first |
| Yes | No | — | — | `/plan-feature` |
| Yes | No | — | — | `/plan-feature` (if `discovery.md` exists, skip Explore — resume from discovery checkpoint) |
| Yes | Yes | No | — | `/implement-task` (next unchecked task) |
| Yes | Yes | Yes | No | `/simplify-code` |
| Yes | Yes | Yes | Yes | `/review-feature` |
| After review passes | | | | `/archive-feature` |

### Sub-Agent Launch Pattern

When launching a sub-agent for any phase:

1. Pass the feature-id and relevant context (spec summary, exploration findings).
2. Resolve project skills (see "Project Skill Resolution" below) and include matched ones as `SKILL: Load` instructions.
3. The sub-agent follows `_shared/sdd-phase-common.md` rules (executor boundary, return envelope).
4. The sub-agent returns a result envelope — the orchestrator validates and either advances or retries.
5. Pass `model: "<model>"` based on the Model Routing table below.
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

## Skill routing
| Need | Skill |
|---|---|
| Initialize project (first time) | `/init-project` |
| New feature from idea | `/new-feature` (or `/sdd-new`) |
| Fast-lane: small enhancement / refactor | `/new-quick-feature` |
| Fast-lane: bugfix (Current/Expected/Unchanged) | `/new-fix` |
| Detect & run next phase | `/sdd-next` |
| Fast-forward all phases | `/sdd-auto` |
| Spec to plan + tasks | `/plan-feature` |
| Execute next task | `/implement-task` |
| Simplify code after implementation | `/simplify-code` |
| Investigate uncertainty | `/research-spike` |
| Review vs spec | `/review-feature` |
| Close & archive feature | `/archive-feature` |
| Build skill registry | `/build-registry` |
| RAG, embeddings, retrieval | `llm-application-dev` skills |

> **Fast-lane note**: `/sdd-next` and `/sdd-auto` do NOT support fast-lane (`quick-spec.md`) features. After running `/new-quick-feature` or `/new-fix`, invoke phases manually following the `Next` field in each result envelope (`/implement-task` → `/simplify-code` → `/review-feature` → `/archive-feature`).

## Agent usage
- Use **Explore agents** (`subagent_type: "Explore"`) for codebase analysis in `/plan-feature` and `/review-feature`.
- Use **parallel agents** for independent research tasks in `/research-spike`.
- Run **parallel Bash calls** for independent validations (lint, typecheck, tests) in `/implement-task`.
- Always prefer launching multiple agents in parallel when tasks are independent.

## Model Routing

Orchestrators (`sdd-next`, `sdd-auto`) MUST pass the `model` parameter when launching sub-agents, using this table:

| Role | Skill / Context | Model |
|------|----------------|-------|
| Orchestrator | sdd-next, sdd-auto | opus |
| Spec creation | new-feature | opus |
| Planning orchestrator | plan-feature | opus |
| Explore agents | plan-feature sub-agents (Explore) | sonnet |
| Discovery evaluator | plan-feature sub-agent (Discovery Evaluator) | haiku |
| Design/task agents | plan-feature sub-agents (general-purpose) | sonnet |
| Implementation | implement-task | sonnet |
| Simplify | simplify-code | sonnet |
| Review orchestrator | review-feature | sonnet |
| Review agents | review-feature sub-agents (Agent-A/B/C) | sonnet |
| Adversarial review agent | review-feature sub-agent (adversarial, Step 5.5) | sonnet |
| Archive | archive-feature | haiku |
| Research | research-spike | sonnet |

### How orchestrators apply this table

When launching a sub-agent:
- Read this table to determine the model for the phase being launched.
- Pass `model: "<model-name>"` in the Agent tool call.
- If a phase is itself an orchestrator (plan-feature, review-feature), that phase's SKILL.md specifies which model its own sub-agents use — the outer orchestrator only sets the model for the phase's top-level agent.

### Overriding model assignments

To override for a specific project, add rows to `.claude/rules/model-overrides.md` (auto-loaded by Claude Code via the `.claude/rules/*.md` convention). The orchestrator checks that file for overrides first, then falls back to the default table above. Keeping overrides in `rules/` lets this `CLAUDE.md` stay a symlink to SDD_HOME (auto-updates on SDD `git pull`) without losing per-project customization.

## Conventions
- Project conventions live in `.claude/rules/` (conventions.md, testing.md, git.md)
- Claude Code loads these automatically — no need to reference them manually
- Shared phase rules live in `.claude/skills/_shared/sdd-phase-common.md`

> **Customization**: Customize SDD behavior via `.claude/rules/*.md`. **Do NOT edit `.claude/agents/sdd-*.md` directly** — `bin/sdd update` overwrites those files using `cmp -s` byte-diff.

## Workflow
```
idea -> /new-feature -> refine spec -> /plan-feature -> /implement-task (repeat) -> /simplify-code -> /review-feature -> /archive-feature
                                   \-> /research-spike (if uncertain)
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
Status | Summary | Artifacts | Next | Risks
```
This enables consistent handoff between phases.

## Delta specs
When implementation diverges from the spec, `/implement-task` documents deltas (ADDED/MODIFIED/REMOVED) in `decisions.md`. `/archive-feature` merges these deltas into the final `$SPEC_FILE` before archiving — `spec.md` for full-flow features, `quick-spec.md` for fast-lane features.
