# Technical Plan — 008 SDD Native Sub-Agents

## Inputs
- Spec: `specs/008-sdd-native-sub-agents/spec.md`
- Clarifications: `specs/008-sdd-native-sub-agents/discovery.md` (decisions A + D)
- Research: OQ1 (Agent=Task alias v2.1.63), OQ3 (CLAUDE.md copy), AC5 deferred (no template engine).

## Summary

Replace skills-via-Task invocation with 17 native Claude Code agents in `.claude/agents/`. Nine public agents expose SDD commands; eight internal agents are pure executors (`disallowedTools: [Agent]`). Two orchestrators (`sdd-plan-feature`, `sdd-review-feature`) retain the Agent tool. `bin/sdd` gains a copy-not-overwrite installer for agent files and a symlink detector.

## Domain analysis

| Domain | Key decision | Complexity |
|---|---|---|
| Agent layer (17 files) | Thin frontmatter wrapper + SKILL.md preload via `skills:` | Medium |
| Orchestrators (sdd-continue, sdd-ff) | Swap `general-purpose` → `sdd-<phase>` in Agent calls | Low |
| plan-feature / review-feature | Preserve Agent tool; internal targets become named agents | Medium |
| Installer (bin/sdd) | Copy agents like rules (copy-not-overwrite, L207-218 pattern) | Low |
| CLAUDE.md symlink fix | Copy on install; add to `.gitignore`; detect circular symlink (L331-336) | Low |
| AC5 / mem_save | Defer hook auto-save; keep explicit `mem_save` in SKILL.md | Low |

## Current state

| Path | Role |
|---|---|
| `.claude/skills/*.md` | SKILL.md invoked via Task |
| `sdd-continue`/`sdd-ff` | Hardcoded `general-purpose` subagent |
| `bin/sdd` | Copies skills; no agent install logic |
| `.claude/CLAUDE.md` | Circular symlink (ELOOP); not in `.gitignore` |
| `plan-feature`/`review-feature` | Spawn internal phases via Task |

## Proposed design (pivot 2026-04-23 — router+body pattern)

Pilot reveló que slash commands NO rutean a agents. Adopción del patrón **skill-as-router + body-in-agent** (estándar gentle-ai v1.23).

**Agent**: frontmatter (`name`, `description`, `model`, `disallowedTools`) + **full phase body migrado desde SKILL.md**. NO `skills: [<phase>]` (evita recursión).

**Skill router** (~10 líneas): frontmatter mínimo + 1 línea prose `"Launch native agent sdd-<phase> with $ARGUMENTS"` + fallback note.

**17-agent mapping:**

| Agent | Type | Model |
|---|---|---|
| sdd-new-feature | public | opus |
| sdd-plan-feature | public + orchestrator | opus |
| sdd-designer | internal | opus |
| sdd-new-quick-feature | public | sonnet |
| sdd-new-fix | public | sonnet |
| sdd-implement-task | public | sonnet |
| sdd-simplify-code | public | sonnet |
| sdd-review-feature | public + orchestrator | sonnet |
| sdd-research-spike | public | sonnet |
| sdd-task-planner | internal | sonnet |
| sdd-explore-agent | internal (replaces `Explore`) | sonnet |
| sdd-reviewer-voter (×3) | internal parallel | sonnet |
| sdd-adversarial-reviewer | internal | sonnet |
| sdd-archive-feature | public | haiku |
| sdd-discovery-evaluator | internal | haiku |

**(c) Orchestrator divergence:** `sdd-plan-feature` and `sdd-review-feature` keep `disallowedTools` unset (they orchestrate). All 8 internal executor agents carry `disallowedTools: [Agent]`.

## Touched files

| Group | Files |
|---|---|
| New `.claude/agents/` (17) | Agent files, body migrado desde SKILL.md |
| Rewritten SKILL.md (9 public) | Routers de ~10 líneas |
| Renamed (T18) | `sdd-ff`→`sdd-auto`, `sdd-continue`→`sdd-next` |
| Orchestrator edits | `sdd-next` L71/82-88; `sdd-auto` L42-49; `plan-feature` L104/109/134/145; `review-feature` L52/218 |
| Installer | `bin/sdd` — agent copy + symlink detector + path updates |
| Hygiene | `.gitignore`, `README.md` |

## Data flow

1. User types `/plan-feature <id>` → skill router → main invokes `Agent(subagent_type="sdd-plan-feature", prompt="feature-id: <id>")`.
2. Runtime spawns agent con model + context aislado del frontmatter. Body tiene la lógica; `$ARGUMENTS` por literal substitution.
3. Agent retorna envelope.
4. `@agent-sdd-<phase>` y orchestrators (`/sdd-next`, `/sdd-auto`) siguen el mismo path desde step 1.

## Migration / rollout

1. Pilot `sdd-archive-feature` (haiku, simplest) — ✅ done 2026-04-23
2. Orchestrators (`sdd-next`, `sdd-auto`) — update Agent tool calls
3. plan/review-feature — rewire internal sub-agent calls
4. Installer + CLAUDE.md symlink fix
5. E2E on `008b-test` dummy + regression on 005/006/007 copies
6. Docs + T18 rename

Rollback: revert commit; skills siguen funcionando si eliminamos `.claude/agents/` y routers (git revert).

## Observability + test

- Cost report per fase vía `mem_save`. AC5 deferred (runtime v2.1.118+ sin template engine).
- Pilot/E2E/regression per migration steps 1/5/5.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| `effort`/`permissionMode` are undocumented — may break or be ignored | Omit both fields; add only after confirmed behavior in pilot |
| `skills:` preload behavior unverified in live runtime | Validate in Phase 1 pilot before wiring orchestrators |
| 17 agents = larger maintenance surface | Share a common frontmatter template; lint for drift in CI |

## Open questions

- **OQ2**: Engram graceful degrade when `mem_save` MCP unavailable inside spawned agent. Investigate in Phase 1 pilot.
