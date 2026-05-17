# Technical Plan — 015 Flatten SDD Agent Hierarchy

## Inputs
- Spec: `specs/015-flatten-sdd-agent-hierarchy/spec.md`
- Decisions: D-001–D-007 (all DISCOVERY-ACCEPTED, binding)

## Current state

| Artifact | State |
|---|---|
| `.claude/agents/sdd-plan-feature.md` | ~500w orchestrator body; spawns Explore, Discovery, Designer, TaskPlanner via `Agent()` |
| `.claude/agents/sdd-review-feature.md` | ~700w orchestrator body; spawns voters + adversarial via `Agent()` |
| `.claude/skills/plan-feature/SKILL.md` | Thin wrapper (delegates to agent) |
| `.claude/skills/review-feature/SKILL.md` | Thin wrapper (delegates to agent) |
| `.claude/skills/sdd-next/SKILL.md` | Step 3: branch leaf-vs-orchestrator with fallback reading agent file |
| `.claude/skills/sdd-auto/SKILL.md` | Step 2: same fallback pattern |
| 6 internal workers (`sdd-explore-agent`, `sdd-discovery-evaluator`, `sdd-designer`, `sdd-task-planner`, `sdd-reviewer-voter`, `sdd-adversarial-reviewer`) | Have `disallowedTools: [Agent]` + body prohibition; docstrings reference orchestrators being deleted |
| `.claude/skills/_shared/agent-frontmatter.md` | Line 35: "15 executors excluding sdd-plan-feature/sdd-review-feature"; lines 77-79: "9 public + 8 internal" counts |
| `CLAUDE.md` | Model routing table rows: "plan-feature sub-agents (Explore)", "review-feature sub-agents" |

**Root cause**: Claude Code strips `Agent` from sub-agents of agents. Orchestrators as agents cannot delegate.

## Proposed design

Orchestrators become inline SKILL.md bodies executed by main Claude directly. Leaf workers remain native agents. Detection is filesystem-side (D-001).

```
main Claude
 ├─ reads plan-feature/SKILL.md inline → spawns leaf agents (Explore, Designer, etc.)
 ├─ reads review-feature/SKILL.md inline → spawns leaf agents (voters, adversarial)
 └─ sdd-next/sdd-auto: if no .claude/agents/sdd-<phase>.md → execute SKILL.md inline
                        if .claude/agents/sdd-<phase>.md exists → Agent(subagent_type=<phase>)
```

**D-005 (session guard)**: SKILL.md calls `mem_context`; skip `mem_session_start` if session already active. Engram unavailable: skip silently.

**D-003 (fallback)**: Remove fallback in sdd-next/sdd-auto for orchestrator phases; leaf fallback preserved.

**D-004 (sentinel)**: `review-feature/SKILL.md` preserves asymmetry: SPEC-GAP-HIGH does NOT delete `.simplified`; FAIL does.

## Touched files

| File | Change |
|---|---|
| `.claude/agents/sdd-plan-feature.md` | DELETE |
| `.claude/agents/sdd-review-feature.md` | DELETE |
| `.claude/skills/plan-feature/SKILL.md` | Rewrite: full orchestration body (migrate from agent) + session lifecycle guard |
| `.claude/skills/review-feature/SKILL.md` | Rewrite: full orchestration body (migrate from agent) + session lifecycle guard + sentinel asymmetry |
| `.claude/skills/sdd-next/SKILL.md` | Update Step 3: filesystem-side detection, remove orchestrator fallback |
| `.claude/skills/sdd-auto/SKILL.md` | Update Step 2: same as sdd-next |
| `.claude/agents/sdd-{explore-agent,discovery-evaluator,designer,task-planner,reviewer-voter,adversarial-reviewer}.md` | Update docstrings (remove refs to deleted orchestrators) |
| `.claude/skills/_shared/agent-frontmatter.md` | Rewrite lines 35, 77-79: invert policy, update counts |
| `CLAUDE.md` | Update model routing table context column |
| `docs/adr/NNNN-flatten-sdd-agent-hierarchy.md` | CREATE |

## Data flow

```
/plan-feature <id>
  → main Claude reads plan-feature/SKILL.md inline
  → mem_context check (D-005 guard)
  → Agent(sdd-explore-agent) ×N, Agent(sdd-discovery-evaluator)
  → Agent(sdd-designer), Agent(sdd-task-planner)
  → plan.md + tasks.md

sdd-next phase routing:
  .claude/agents/sdd-<phase>.md exists? → Agent(subagent_type=<phase>)   [leaf]
  absent?                               → execute SKILL.md inline         [orchestrator, no fallback]
```

## Migration / rollout

| Step | Action |
|---|---|
| 1 | Migrate `sdd-plan-feature.md` body → `plan-feature/SKILL.md` + session guard |
| 2 | Migrate `sdd-review-feature.md` body → `review-feature/SKILL.md` + sentinel asymmetry |
| 3 | Delete `sdd-plan-feature.md` and `sdd-review-feature.md` |
| 4 | Update `sdd-next/SKILL.md` and `sdd-auto/SKILL.md` (D-001, D-003) |
| 5 | Update 6 worker docstrings |
| 6 | Rewrite `agent-frontmatter.md` sections (D-006) |
| 7 | Update `CLAUDE.md` model routing table (D-007) |
| 8 | Verify `bin/sdd update` does not recreate deleted agents (local mitigation; cross-repo out of scope) |
| 9 | Write ADR |
| 10 | E2E: `/plan-feature 014-fast-lane-visibility` |

Rollback: `git revert <merge-commit>`. No feature flags.

## Observability

| Signal | Check |
|---|---|
| SC-2 | `grep -rn "sdd-plan-feature\|sdd-review-feature" .claude/ docs/ bin/` → 0 hits (except decisions.md/ADR) |
| SC-3 | `grep -n "Agent(" .claude/agents/sdd-{explore-agent,discovery-evaluator,designer,task-planner,reviewer-voter,adversarial-reviewer}.md` → 0 hits |
| E2E | `/plan-feature 014` completes; no `blocked`, no fallback errors |

## Test strategy

| AC | Validation |
|---|---|
| AC-1 | Run `/plan-feature 014`; verify `plan.md` + `tasks.md` produced |
| AC-2 | Run `/review-feature <id>` with fresh `.simplified`; verify PASS/FAIL envelope; verify SPEC-GAP-HIGH keeps sentinel |
| AC-3 | `sdd-next` / `sdd-auto` route plan-feature inline; SC-2 grep passes |
| AC-4 | SC-3 grep passes; runtime: workers cannot call `Agent(` |
| AC-5 | Full e2e on 014; no orchestration errors; diff vs historical = content only |

No unit tests (shell/markdown). Validation: grep + e2e smoke.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| `bin/sdd update` recreates deleted agents locally | Manual verification after step 3; document in ADR |
| Sentinel asymmetry regression during copy | Copy Step 4.5 verbatim; AC-2 validates explicitly |
| Session double-start when invoked inline inside `sdd-auto` | D-005 guard: `mem_context` check before `mem_session_start` |
| Worker docstring still references deleted orchestrator (SC-2 miss) | SC-2 grep covers `.claude/agents/` — docstring refs caught |
| EC-5: 014 e2e fails due to 014 content, not refactor | Checkpoint: if plan.md + tasks.md are produced, orchestration passed |

## Open questions

None. OQ-1 resolved via D-005.
