# Starter kit para repo agentic con SDD + Claude Code + Codex

## Árbol sugerido

```text
repo/
├─ .claude/
│  ├─ CLAUDE.md
│  ├─ commands/
│  │  ├─ new-feature.md
│  │  ├─ research-spike.md
│  │  ├─ implement-task.md
│  │  └─ review-feature.md
│  └─ skills/
│     ├─ shared -> ../../skills/shared
│     ├─ teams -> ../../skills/teams
│     └─ project -> ../../skills/project
│
├─ .codex/
│  ├─ CODEX.md
│  ├─ prompts/
│  │  ├─ new-feature.md
│  │  ├─ research-spike.md
│  │  ├─ implement-task.md
│  │  └─ review-feature.md
│  └─ skills/
│     ├─ shared -> ../../skills/shared
│     ├─ teams -> ../../skills/teams
│     └─ project -> ../../skills/project
│
├─ .specify/
│  ├─ memory/
│  │  └─ constitution.md
│  ├─ templates/
│  │  ├─ spec-template.md
│  │  ├─ plan-template.md
│  │  ├─ tasks-template.md
│  │  ├─ clarify-template.md
│  │  ├─ decisions-template.md
│  │  └─ research-template.md
│  └─ scripts/
│     ├─ create-feature.sh
│     ├─ create-research.sh
│     ├─ validate-spec.sh
│     └─ sync-skills.sh
│
├─ specs/
│  ├─ 001-example-feature/
│  │  ├─ spec.md
│  │  ├─ clarify.md
│  │  ├─ plan.md
│  │  ├─ tasks.md
│  │  ├─ decisions.md
│  │  ├─ acceptance-checklist.md
│  │  └─ artifacts/
│  │     ├─ diagrams/
│  │     └─ examples/
│  └─ index.md
│
├─ research/
│  ├─ backlog/
│  ├─ active/
│  │  └─ R-001-example/
│  │     ├─ brief.md
│  │     ├─ questions.md
│  │     ├─ sources.md
│  │     ├─ findings.md
│  │     ├─ experiments.md
│  │     └─ recommendation.md
│  └─ archive/
│
├─ skills/
│  ├─ shared/
│  │  ├─ feature-spec/
│  │  │  └─ SKILL.md
│  │  ├─ technical-plan/
│  │  │  └─ SKILL.md
│  │  ├─ task-breakdown/
│  │  │  └─ SKILL.md
│  │  ├─ research-spike/
│  │  │  └─ SKILL.md
│  │  ├─ implement-task-safely/
│  │  │  └─ SKILL.md
│  │  └─ review-against-spec/
│  │     └─ SKILL.md
│  ├─ teams/
│  │  ├─ frontend-team/
│  │  │  └─ SKILL.md
│  │  ├─ backend-team/
│  │  │  └─ SKILL.md
│  │  ├─ data-ai-team/
│  │  │  └─ SKILL.md
│  │  └─ platform-team/
│  │     └─ SKILL.md
│  └─ project/
│     ├─ repo-conventions/
│     │  └─ SKILL.md
│     ├─ architecture-map/
│     │  └─ SKILL.md
│     └─ stack-rules/
│        └─ SKILL.md
│
├─ docs/
│  ├─ architecture/
│  ├─ adr/
│  ├─ product/
│  └─ runbooks/
│
├─ src/
├─ tests/
├─ scripts/
├─ package.json
└─ README.md
```

---

## `.claude/CLAUDE.md`

```md
# Operating rules for Claude Code

## Source of truth
- Feature requirements live in `/specs/<feature-id>/spec.md`.
- Clarifications live in `/specs/<feature-id>/clarify.md`.
- Technical design lives in `/specs/<feature-id>/plan.md`.
- Execution details live in `/specs/<feature-id>/tasks.md`.
- Deep investigation lives in `/research/active/<research-id>/`.
- Architecture decisions live in `/docs/adr/` or `decisions.md` inside the feature.

## Work mode
- Never implement substantial changes without an existing spec or research recommendation.
- Prefer small, verifiable increments.
- Validate the implementation against the spec before considering work done.
- When implementation diverges from the plan, update `decisions.md`.
- Avoid inventing APIs, contracts, or schema details if they are not grounded in the repo.

## Output expectations
- Keep edits minimal and coherent.
- Prefer concrete file changes over long explanations.
- Add or update tests when business logic changes.
- Add docs when behavior, architecture, or operations change.

## Skill routing
- Use `feature-spec` to draft or refine a feature spec.
- Use `technical-plan` to turn a spec into an implementation approach.
- Use `task-breakdown` to create execution tasks.
- Use `research-spike` when uncertainty is high.
- Use `implement-task-safely` when executing a specific task.
- Use `review-against-spec` before marking work complete.
```

## `.codex/CODEX.md`

```md
# Operating rules for Codex

## Source of truth
- Read specs before editing code.
- Use `/specs/<feature-id>/spec.md` as requirement source.
- Use `/specs/<feature-id>/plan.md` as implementation source.
- Use `/research/active/<research-id>/recommendation.md` for unresolved technical choices.

## Execution style
- Be autonomous in exploring the codebase.
- Do not stop after describing a plan when the task is clear.
- Make the smallest complete set of changes that satisfies the spec.
- Run validations relevant to the touched area when possible.
- Summarize what changed, what was verified, and what still needs human review.

## Guardrails
- Do not create parallel architectures without documenting the reason.
- Do not silently diverge from the spec.
- When uncertainty blocks implementation, push the work back into research or clarify docs.
```

---

## `.specify/memory/constitution.md`

```md
# Repository Constitution

## 1. Specs drive changes
All material changes should start from a feature spec or a research recommendation.

## 2. Research before architecture when uncertainty is high
If feasibility, scalability, security, model choice, or user experience is unclear, create a research spike before implementation.

## 3. Plans must be executable
Technical plans should mention touched modules, contracts, data model impact, migration impact, observability, and test strategy.

## 4. Tasks must be atomic
Each task should be small enough to implement and validate in one focused iteration.

## 5. Decisions must remain traceable
When implementation changes direction, update `decisions.md` or publish an ADR.

## 6. Done means verified
A feature is not done until acceptance criteria are checked and validation is recorded.
```

---

## Templates

### `.specify/templates/spec-template.md`

```md
# Feature Spec

## Metadata
- Feature ID:
- Title:
- Status:
- Owner:
- Related research:
- Related ADRs:

## Problem
What problem are we solving?

## Users / stakeholders
Who benefits from this?

## Goals
-

## Non-goals
-

## Scope
### In scope
-

### Out of scope
-

## Functional requirements
1.
2.
3.

## Non-functional requirements
- Performance:
- Security:
- Reliability:
- Observability:
- UX constraints:

## Acceptance criteria
- [ ]
- [ ]
- [ ]

## Risks
-

## Open questions
-
```

### `.specify/templates/plan-template.md`

```md
# Technical Plan

## Inputs
- Spec:
- Clarifications:
- Research inputs:

## Current state
Describe current architecture and relevant modules.

## Proposed design
Describe the target design.

## Touched areas
- Files/modules:
- APIs/contracts:
- DB/schema:
- Jobs/workers:
- UI surfaces:

## Data flow
Describe read/write paths.

## Migration / rollout
- Backfill:
- Compatibility:
- Feature flags:
- Rollback:

## Observability
- Logs:
- Metrics:
- Alerts:

## Test strategy
- Unit:
- Integration:
- E2E/manual:

## Risks and mitigations
-
```

### `.specify/templates/tasks-template.md`

```md
# Tasks

## Execution order

### 1. Foundation
- [ ]
- [ ]

### 2. Core implementation
- [ ]
- [ ]

### 3. Validation
- [ ] Tests
- [ ] Manual verification
- [ ] Docs update

## Notes
- Each task should map to a concrete change.
- Update `decisions.md` if the plan changes.
```

### `.specify/templates/research-template.md`

```md
# Research Spike

## Metadata
- Research ID:
- Topic:
- Owner:
- Status:
- Linked feature:

## Brief
What are we trying to learn?

## Why now
Why is this blocking or de-risking future work?

## Questions
1.
2.
3.

## Options to evaluate
-
-
-

## Evaluation criteria
- Complexity
- Cost
- Performance
- Reliability
- Security
- Team fit
- Vendor lock-in

## Experiments
-

## Expected output
- Recommendation
- Tradeoffs
- Next step
```

---

## Skills iniciales

### `skills/shared/feature-spec/SKILL.md`

```md
---
name: feature-spec
summary: Draft or refine a feature spec from an idea, bug, or product need.
---

# Purpose
Turn a rough request into a concrete feature spec under `/specs/<feature-id>/spec.md`.

# Use when
- A new feature starts from a vague request.
- Existing requirements are incomplete.
- A feature needs acceptance criteria before planning.

# Inputs
- Problem statement
- User context
- Existing architecture/docs
- Relevant research, if any

# Output
Produce or update a spec with:
- problem
- goals / non-goals
- scope
- functional requirements
- non-functional requirements
- acceptance criteria
- risks
- open questions

# Rules
- Keep the spec implementation-agnostic when possible.
- Separate requirements from proposed technical solutions.
- Flag ambiguity explicitly.
```

### `skills/shared/technical-plan/SKILL.md`

```md
---
name: technical-plan
summary: Convert an approved feature spec into an executable technical plan.
---

# Purpose
Create `/specs/<feature-id>/plan.md` from the feature spec and repository context.

# Use when
- The feature spec is clear enough to design implementation.
- Engineering needs module-level impact and rollout detail.

# Output
A plan that includes:
- current state
- proposed design
- touched files/modules
- contracts and data changes
- migration and rollout
- observability
- test strategy
- risks and mitigations

# Rules
- Ground every decision in the actual repo structure.
- Prefer incremental rollout over big-bang rewrites.
- Surface unknowns that require research before implementation.
```

### `skills/shared/task-breakdown/SKILL.md`

```md
---
name: task-breakdown
summary: Break a technical plan into atomic implementation tasks.
---

# Purpose
Create `/specs/<feature-id>/tasks.md` as an ordered set of implementable steps.

# Use when
- A plan exists and work is ready to execute.

# Output
Tasks organized by sequence:
- foundation
- core implementation
- validation
- rollout/docs

# Rules
- Each task must be concrete and testable.
- Avoid tasks that bundle unrelated concerns.
- Include validation and documentation tasks.
```

### `skills/shared/research-spike/SKILL.md`

```md
---
name: research-spike
summary: Investigate uncertain technical or product areas before implementation.
---

# Purpose
Create or update a research folder under `/research/active/<research-id>/`.

# Use when
- Requirements are clear but the technical path is not.
- There are multiple viable architectures, vendors, or models.
- Performance, scale, or feasibility is uncertain.

# Output
Create or update:
- brief.md
- questions.md
- sources.md
- findings.md
- experiments.md
- recommendation.md

# Rules
- Separate evidence from opinion.
- Compare options using explicit criteria.
- End with a recommendation and next step.
```

### `skills/shared/implement-task-safely/SKILL.md`

```md
---
name: implement-task-safely
summary: Execute one task from tasks.md with minimal, verified changes.
---

# Purpose
Implement a single task while preserving alignment with spec and plan.

# Use when
- The next task is clear.
- Scope should remain tight.

# Workflow
1. Read spec, plan, and selected task.
2. Inspect the touched code paths.
3. Implement the minimum complete change.
4. Run or describe relevant validation.
5. Update docs/tests if needed.
6. Update decisions.md if the implementation diverges.

# Rules
- Do not expand scope silently.
- Do not refactor unrelated areas unless necessary.
- Report validation clearly.
```

### `skills/shared/review-against-spec/SKILL.md`

```md
---
name: review-against-spec
summary: Review implemented changes against the feature spec and plan.
---

# Purpose
Check whether the implementation satisfies the intended behavior.

# Review checklist
- Does the change satisfy the acceptance criteria?
- Did implementation drift from the spec or plan?
- Are tests adequate?
- Are rollout and observability covered?
- Are docs and decisions updated?

# Output
A short review with:
- passes
- gaps
- risks
- required follow-ups
```

---

## Teams iniciales

### `skills/teams/frontend-team/SKILL.md`

```md
---
name: frontend-team
summary: Coordinate spec, UX constraints, implementation, and validation for frontend-heavy work.
---

# Composition
Use:
- feature-spec
- technical-plan
- task-breakdown
- implement-task-safely
- review-against-spec

# Focus
- component boundaries
- state management
- loading/error states
- accessibility
- interaction details
- regression risk
```

### `skills/teams/backend-team/SKILL.md`

```md
---
name: backend-team
summary: Coordinate backend delivery across APIs, services, data, and reliability concerns.
---

# Composition
Use:
- technical-plan
- task-breakdown
- implement-task-safely
- review-against-spec

# Focus
- contracts
- data integrity
- migrations
- idempotency
- logging and metrics
- backward compatibility
```

### `skills/teams/data-ai-team/SKILL.md`

```md
---
name: data-ai-team
summary: Coordinate research-heavy features involving ML, retrieval, ranking, evaluation, or pipelines.
---

# Composition
Use:
- research-spike
- technical-plan
- task-breakdown
- implement-task-safely
- review-against-spec

# Focus
- experimentation
- offline evaluation
- benchmarks
- cost/performance tradeoffs
- model or retrieval choice
- fallback behavior
```

---

## Skills de proyecto

### `skills/project/repo-conventions/SKILL.md`

```md
---
name: repo-conventions
summary: Apply repository-specific naming, structure, testing, and documentation conventions.
---

# Purpose
Keep changes aligned with this repo's established patterns.

# Replace this file with your repo specifics
- naming conventions
- folder ownership
- test placement
- lint/format commands
- PR conventions
- release/rollout norms
```

### `skills/project/architecture-map/SKILL.md`

```md
---
name: architecture-map
summary: Explain how this repository is structured and where changes should land.
---

# Replace this file with your repo specifics
Document:
- main apps/packages
- shared libraries
- API boundaries
- data stores
- async jobs
- external integrations
- operational entrypoints
```

### `skills/project/stack-rules/SKILL.md`

```md
---
name: stack-rules
summary: Apply stack-specific implementation rules for this repository.
---

# Replace this file with your repo specifics
Examples:
- TypeScript strictness rules
- React/Next conventions
- API layer patterns
- ORM/query rules
- background job patterns
- observability standards
```

---

## Commands / prompts sugeridos

### `.claude/commands/new-feature.md`

```md
Create a new feature spec from the user request.

Steps:
1. Identify whether this is a feature, bug, refactor, or research topic.
2. If it is a feature, use `feature-spec`.
3. If key uncertainty exists, also create a research spike.
4. Propose the feature ID and create the folder under `/specs/`.
5. Output the spec and the open questions that still need clarification.
```

### `.claude/commands/research-spike.md`

```md
Create a research spike for the current topic.

Steps:
1. Create a research ID.
2. Populate brief, questions, evaluation criteria, and expected experiments.
3. Recommend whether implementation should wait for research completion.
```

### `.claude/commands/implement-task.md`

```md
Implement the next unchecked task from `/specs/<feature-id>/tasks.md`.

Requirements:
- Read spec and plan first.
- Keep scope tight.
- Run relevant checks.
- Update decisions.md if necessary.
- Summarize files changed and validation performed.
```

### `.claude/commands/review-feature.md`

```md
Review the current implementation against the feature spec and plan.

Requirements:
- Evaluate acceptance criteria.
- Identify drift from plan.
- Flag missing tests, docs, or observability.
```

---

## Shell scripts mínimos

### `.specify/scripts/create-feature.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

FEATURE_ID="$1"
mkdir -p "specs/${FEATURE_ID}/artifacts/diagrams"
mkdir -p "specs/${FEATURE_ID}/artifacts/examples"
cp .specify/templates/spec-template.md "specs/${FEATURE_ID}/spec.md"
cp .specify/templates/plan-template.md "specs/${FEATURE_ID}/plan.md"
cp .specify/templates/tasks-template.md "specs/${FEATURE_ID}/tasks.md"
cp .specify/templates/clarify-template.md "specs/${FEATURE_ID}/clarify.md" 2>/dev/null || true
cp .specify/templates/decisions-template.md "specs/${FEATURE_ID}/decisions.md" 2>/dev/null || true
: > "specs/${FEATURE_ID}/acceptance-checklist.md"
echo "Created specs/${FEATURE_ID}"
```

### `.specify/scripts/create-research.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

RESEARCH_ID="$1"
mkdir -p "research/active/${RESEARCH_ID}"
cp .specify/templates/research-template.md "research/active/${RESEARCH_ID}/brief.md"
: > "research/active/${RESEARCH_ID}/questions.md"
: > "research/active/${RESEARCH_ID}/sources.md"
: > "research/active/${RESEARCH_ID}/findings.md"
: > "research/active/${RESEARCH_ID}/experiments.md"
: > "research/active/${RESEARCH_ID}/recommendation.md"
echo "Created research/active/${RESEARCH_ID}"
```

### `.specify/scripts/sync-skills.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

mkdir -p .claude/skills .codex/skills
rm -rf .claude/skills/shared .claude/skills/teams .claude/skills/project
rm -rf .codex/skills/shared .codex/skills/teams .codex/skills/project
ln -s ../../skills/shared .claude/skills/shared
ln -s ../../skills/teams .claude/skills/teams
ln -s ../../skills/project .claude/skills/project
ln -s ../../skills/shared .codex/skills/shared
ln -s ../../skills/teams .codex/skills/teams
ln -s ../../skills/project .codex/skills/project
echo "Skills synced"
```

---

## Flujo recomendado

1. Idea nueva -> crear `spec.md`.
2. Si hay mucha incertidumbre -> abrir `research/active/R-xxx/`.
3. Cuando el problema ya esté claro -> hacer `plan.md`.
4. Luego -> `tasks.md`.
5. Ejecutar de a una tarea con `implement-task-safely`.
6. Cerrar con `review-against-spec`.

## Qué me tendrías que pasar para personalizarlo bien

1. Tipo de repo: monorepo, app única, backend, data/AI, infra, etc.
2. Stack principal: Next, Nest, Python, Go, Postgres, AWS, etc.
3. Tipo de features avanzados: RAG, pipelines, agentes, OCR, ranking, workflows, etc.
4. Cómo querés trabajar: branch por feature, PR chicas, ADRs, tests obligatorios, feature flags.
5. Qué querés optimizar: velocidad, consistencia, research, calidad de código, documentación.

Con eso, la siguiente iteración la puedo bajar a skills realmente específicas del repo.

