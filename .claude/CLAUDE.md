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

## Skill routing
| Need | Skill |
|---|---|
| Initialize project (first time) | `/init-project` |
| New feature from idea | `/new-feature` |
| Spec to plan + tasks | `/plan-feature` |
| Execute next task | `/implement-task` |
| Investigate uncertainty | `/research-spike` |
| Review vs spec | `/review-feature` |
| Close & archive feature | `/archive-feature` |
| RAG, embeddings, retrieval | `llm-application-dev` skills (rag-implementation, embedding-strategies, similarity-search-patterns, etc.) |

## Agent usage
- Use **Explore agents** (`subagent_type: "Explore"`) for codebase analysis in `/plan-feature` and `/review-feature`.
- Use **parallel agents** for independent research tasks in `/research-spike`.
- Run **parallel Bash calls** for independent validations (lint, typecheck, tests) in `/implement-task`.
- Always prefer launching multiple agents in parallel when tasks are independent.

## Conventions
- Project conventions live in `.claude/rules/` (conventions.md, testing.md, git.md)
- Claude Code loads these automatically — no need to reference them manually

## Workflow
```
idea -> /new-feature -> refine spec -> /plan-feature -> /implement-task (repeat) -> /review-feature -> /archive-feature
                                   \-> /research-spike (if uncertain)
```

## Result envelope
All skills output a structured result envelope at the end:
```
Status | Summary | Artifacts | Next | Risks
```
This enables consistent handoff between phases.

## Delta specs
When implementation diverges from the spec, `/implement-task` documents deltas (ADDED/MODIFIED/REMOVED) in `decisions.md`. `/archive-feature` merges these deltas into the final `spec.md` before archiving.
