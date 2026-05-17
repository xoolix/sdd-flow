# Feature: Flatten SDD agent hierarchy

## Summary
Eliminar orchestrator agents nativos (`sdd-plan-feature`, `sdd-review-feature`) y migrar lógica a sus `SKILL.md`, ejecutados inline por main Claude. Workers y leaf executors siguen como agents-hoja con `tools:` whitelist sin `Agent`. Resuelve bug bloqueante: Claude Code force-strips `Agent` de sub-agents spawned. Interfaz user-facing no cambia.

## Trigger
Manual: dev corre `/plan-feature 015-...` o `/sdd-auto 015-...`. Precondición: ningún `/plan-feature` o `/review-feature` corriendo.

## Happy Path
1. Migrar lógica `sdd-plan-feature.md` → `plan-feature/SKILL.md` (Explore, Discovery, Designer + TaskPlanner, envelope).
2. Migrar `sdd-review-feature.md` → `review-feature/SKILL.md` (tier, voters, adversarial 5.5, sentinel).
3. Borrar `.claude/agents/sdd-plan-feature.md` y `sdd-review-feature.md`.
4. `sdd-next/SKILL.md`: branch leaf-vs-orchestrator (filesystem: orchestrator = sin `.claude/agents/sdd-<phase>.md`).
5. `sdd-auto/SKILL.md` con misma branch logic.
6. Auditar 6 internal workers (`sdd-explore-agent`, `sdd-discovery-evaluator`, `sdd-designer`, `sdd-task-planner`, `sdd-reviewer-voter`, `sdd-adversarial-reviewer`): `tools:` sin `Agent`, prohibición literal en body, **actualizar docstrings con refs a orchestrators borrados**.
7. Actualizar `.claude/skills/_shared/agent-frontmatter.md`.
8. Verificar `bin/sdd update` no recrea archivos borrados.
9. ADR `docs/adr/NNNN-flatten-sdd-agent-hierarchy.md` (alternativas inc. "fixear recursion = imposible"; consecuencias: loss model isolation; gain coherencia + bug fixed).
10. E2E: `/plan-feature 014-fast-lane-visibility`. Validar workers spawned no pueden invocar `Agent(...)`.
11. Pipeline normal: `[x]` → simplify → review → archive.

## Domains
| Domain | Touches |
|---|---|
| SDD agents | Borrar 2 orchestrators; auditar 6 workers |
| SDD skills | `plan-feature`, `review-feature`, `sdd-next`, `sdd-auto` |
| Shared docs | `agent-frontmatter.md` |
| Distribution | `bin/sdd update` (verificar) |
| ADR | Nuevo |

**Out of scope**: 7 leaf executors, user-facing behavior, feature 014, `.claude/rules/*.md`.

## Edge Cases
- **EC-1 (crítico)** — `bin/sdd update` recrea agents borrados desde upstream. Mitigación: paso 8.
- **EC-4 (informativo)** — Engram memorias huérfanas con `topic_key` apuntando a agents borrados. Engram tolera; no actuar.
- **EC-5 (procedural)** — Verificación 014 falla por contenido propio (no refactor). Checkpoint: ¿fallo de orquestación o contenido? Si contenido, refactor pasa.

## Acceptance Criteria
- [ ] **AC-1** — Given `sdd-plan-feature.md` borrado y lógica en `plan-feature/SKILL.md`, When dev corre `/plan-feature 014-fast-lane-visibility`, Then main Claude ejecuta body inline, spawnea workers (Explore, Discovery, Designer, TaskPlanner) vía Agent calls, y produce `plan.md` + `tasks.md` con misma estructura que el orchestrator previo.
- [ ] **AC-2** — Given `sdd-review-feature.md` borrado y lógica en `review-feature/SKILL.md`, When dev corre `/review-feature <id>` con tasks completos y `.simplified` fresco, Then main Claude ejecuta body inline, spawnea voters (1 o 3 según tier) y opcionalmente adversarial vía Agent calls, y produce envelope (PASS / PASS WITH WARNINGS / FAIL) con misma forma.
- [ ] **AC-3** — Given `sdd-next/SKILL.md` y `sdd-auto/SKILL.md` con branch leaf-vs-orchestrator (filesystem-side), When `/sdd-next <id>` o `/sdd-auto <id>` detecta fase `plan-feature` o `review-feature`, Then main Claude ejecuta inline el SKILL.md (no `Agent(subagent_type=sdd-plan-feature|sdd-review-feature)`); para otras fases, spawnea leaf agent vía Agent call. **`sdd-auto` exhibe mismo routing que `sdd-next`**.
- [ ] **AC-4** — Given 6 internal workers auditados, When cualquiera es spawned durante orchestration inline, Then tiene `tools:` sin `Agent` (o `disallowedTools: [Agent]`), prohibición literal en body, y verificable en runtime que no puede invocar `Agent(...)`.
- [ ] **AC-5** — Given refactor completo (agents borrados, SKILLs migrados, sdd-next/sdd-auto actualizados, workers auditados, ADR escrito), When dev corre `/plan-feature 014-fast-lane-visibility` e2e, Then completa sin errores de orquestación (no `blocked` por imposibilidad de delegar, no inline-mode fallback), genera `plan.md` + `tasks.md` válidos, y diferencias versus salida histórica se deben solo a contenido de 014.

## Rollback Plan
- **Pre-merge**: descartar branch.
- **Post-merge**: `git revert <merge-commit>` restaura 2 agents + 4 SKILLs + workers. <5 min (revert + push + smoke).
- **No feature flag** (refactor estructural).
- **`bin/sdd update` post-revert**: si propagó a otros repos, quedan en estado nuevo. Tolerable.
- **ADR**: si revert, suplemento `Status: Reverted` + razón. No borrar.

## Success Criteria
Los 3 son hard-blocking:
1. **SC-1 (funcional)**: `/plan-feature 014` completa e2e sin errores de orquestación, generando `plan.md` + `tasks.md` válidos en una pasada. Coincide con AC-5.
2. **SC-2 (estructural)**: 0 refs a agents borrados. `grep -rn "sdd-plan-feature\|sdd-review-feature" .claude/ docs/ bin/`. Excepción: contexto histórico en `decisions.md`/ADR.
3. **SC-3 (estructural)**: 0 ocurrencias `Agent(` en 6 internal workers. `grep -n "Agent(" .claude/agents/sdd-{explore-agent,discovery-evaluator,designer,task-planner,reviewer-voter,adversarial-reviewer}.md`.

## Open Questions
- **OQ-1 — SKILL.md context manual vs inline**: mismo body en dos contextos (manual: main Claude caller directo; auto: `sdd-next`/`sdd-auto` ya activo). Riesgo: `mem_session_start` redundante o setup que pisa estado. Resolver en `/plan-feature`: qué pasos (session lifecycle) skipear o delegar cuando detecta orchestrator activo.
