# ADR 0001: Flatten SDD Agent Hierarchy

## Status
Accepted (2026-05-01)

## Context
The SDD framework had a two-tier agent hierarchy:
- **Tier 1 — Orchestrator agents**: `sdd-plan-feature` and `sdd-review-feature` were native agents that delegated work to internal worker agents (sdd-explore-agent, sdd-discovery-evaluator, sdd-designer, sdd-task-planner, sdd-reviewer-voter, sdd-adversarial-reviewer) via the `Agent` tool.
- **Tier 2 — Worker agents**: leaf executors with `disallowedTools: [Agent]`, doing the actual work.

The slash command pattern (`/plan-feature`, `/review-feature`) routed through SKILL.md routers that launched the orchestrator agent via `Agent(subagent_type=...)`.

**The problem**: Empirically verified on 2026-05-01 that Claude Code force-strips the `Agent` tool from all spawned sub-agents, regardless of frontmatter declarations. This means orchestrator agents could not delegate — they had no `Agent` tool at runtime. The two-tier design was structurally broken.

## Decision
Eliminate orchestrator native agents. Migrate their full body content into their respective SKILL.md files. Main Claude (which retains `Agent` because it operates at conversation top-level) reads the SKILL.md body inline and orchestrates the workers itself.

Concretely:
- Delete `.claude/agents/sdd-plan-feature.md` and `.claude/agents/sdd-review-feature.md`.
- Move their orchestration logic to `.claude/skills/plan-feature/SKILL.md` and `.claude/skills/review-feature/SKILL.md`.
- Update `sdd-next/SKILL.md` and `sdd-auto/SKILL.md` with filesystem-side detection: agent file present → spawn agent (leaf phase); agent file absent → execute SKILL.md inline (orchestrator phase).
- Worker agents remain unchanged (they were already correct as leaves).

Pattern reference: gentle-ai (https://github.com/Gentleman-Programming/gentle-ai), `internal/assets/claude/sdd-orchestrator.md` and the leaf-only agent topology in `internal/assets/claude/agents/`.

## Alternatives considered

1. **Fix Agent recursion in Claude Code** — investigated and confirmed impossible. Runtime force-strips Agent regardless of frontmatter. Out of our control.
2. **X — Agent leaf executor without internal delegation** — keep `sdd-plan-feature` and `sdd-review-feature` as agents but make them do all the work themselves (no Explore/Discovery/Designer/TaskPlanner sub-agents). Loses parallelism (serial), loses model-per-step (everything in opus), increases token cost ~3x. Rejected: too expensive.
3. **Skip orchestration, all work inline** — eliminate plan/review phases as orchestration roles. Rejected: loses the value of staged exploration + discovery checkpoint + parallel design+tasks.

## Consequences

**Positive**:
- Bug fixed: `/plan-feature` and `/review-feature` work end-to-end. The previously broken pipeline runs.
- Architectural coherence: all native agents are now leaf executors with `disallowedTools: [Agent]`. Single tier.
- Smaller surface area: 2 fewer agent files; 13 → 11 native agent files.
- Manual and automatic invocation paths share orchestration logic (DRY) — `/plan-feature` direct and `/sdd-next` both execute the same SKILL.md body.

**Negative / Trade-offs**:
- Loss of model isolation for orchestrator role: previously, `sdd-plan-feature` ran in opus context-isolated from main Claude. Now main Claude (which inherits user's session model) does the orchestration. Mitigation: workers still get model-per-step (Discovery=haiku, Designer=sonnet, etc.) — only the thin orchestration layer loses isolation.
- Loss of context isolation for orchestrator role: orchestration noise (sub-agent summaries) flows into main Claude's context. Mitigation: heavy work still lives in worker contexts; main Claude only sees envelope summaries.

**Operational**:
- `bin/sdd update` does not recreate deleted files (verified: this repo is its own SDD_HOME, and the script's algorithm has no delete logic but only adds files that exist in upstream).
- The `Agent fallback` path in `sdd-next` and `sdd-auto` was preserved for leaf phases and removed for orchestrator phases (D-003).
- OQ-1 (session lifecycle when invoked manually vs from sdd-next/sdd-auto) was resolved via D-005: SKILL.md detects active orchestrator via `mem_context` and skips redundant `mem_session_start`.

## References
- Spec: `specs/015-flatten-sdd-agent-hierarchy/spec.md`
- Plan: `specs/015-flatten-sdd-agent-hierarchy/plan.md`
- Discovery: `specs/015-flatten-sdd-agent-hierarchy/discovery.md`
- Decisions: `specs/015-flatten-sdd-agent-hierarchy/decisions.md` (D-001 through D-008)
- Research: `research/R-006-sdd-flow-simplification/research.md`
- gentle-ai pattern: https://github.com/Gentleman-Programming/gentle-ai/blob/main/internal/assets/claude/agents/sdd-explore.md
