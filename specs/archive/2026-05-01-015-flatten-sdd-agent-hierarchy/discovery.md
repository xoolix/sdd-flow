# Discovery Report
status: findings-present

## High-impact findings

- **[edge-case] Fallback path en sdd-next/sdd-auto rompe silenciosamente post-migration** [impact: high]
  
  `sdd-next/SKILL.md` (Step 3) y `sdd-auto/SKILL.md` (Step 2 item 2) tienen un fallback documentado: *"si `subagent_type: sdd-<phase>` no es reconocido por el runtime, leer el body de `.claude/agents/sdd-<phase>.md` y relanzar con `subagent_type: general-purpose`"*.
  
  Después de borrar `sdd-plan-feature.md` y `sdd-review-feature.md`, ese fallback intentará leer archivos inexistentes — fallará en silencio (file not found), sin retry ni notificación al user.
  
  **El spec no lo addressa**. EC-1 cubre `bin/sdd update`, pero no este fallback dentro de los SKILLs de routing.
  
  **Opciones para el planner**:
  - **(a) Eliminar el fallback** para orchestrator phases en sdd-next/sdd-auto, dado que ahora se ejecutan inline (no hay agent que llamar). Para leaf phases, mantenerlo (siguen siendo agents).
  - **(b) Reemplazar el fallback** para orchestrator phases: si `subagent_type` no se reconoce, leer y ejecutar el body de `plan-feature/SKILL.md` (en vez de `sdd-plan-feature.md`).
  - **(c) Eliminar el fallback completo** (incluso para leaf phases) — los agents leaf están deployados garantizadamente vía `bin/sdd update`.

## Other findings

- **[simplification] Sentinel asymmetry en SPEC-GAP-HIGH** [impact: medium] — `sdd-review-feature.md` Step 4.5 NO borra `.simplified` en SPEC-GAP-HIGH (solo en FAIL). Migration debe preservar esta asimetría — riesgo de regresión si se sobre-simplifica al refactorizar.

- **[edge-case] OQ-1 confirmado real** [impact: medium] — `mem_session_start/end` solo en `sdd-next`/`sdd-auto`. Cuando user invoca `/plan-feature` directo, no hay session. Plan debe decidir: ¿inlined logic llama session_start, o queda single-call solo en orchestrators auto?

- **[conflict] agent-frontmatter.md doc inconsistency** [impact: medium] — línea 35 dice "disallowedTools: [Agent] en 15 executors, excluyendo sdd-plan-feature y sdd-review-feature". Post-migration esa policy se invierte. Líneas 77-79 listan "9 public + 8 internal" — counts cambian.

- **[edge-case] CLAUDE.md model routing table referencias rotas** [impact: low] — columnas mencionan "plan-feature sub-agents" y "review-feature sub-agents". Post-migration esos agents no existen — los workers siguen pero no son sub-agents de un orchestrator agent.

- **[reuse] EC-1 mitigation suficiente para este repo** [impact: low] — `bin/sdd update` glob-copy sin delete logic. Verificación + ajuste local cubre. Cross-repo SDD_HOME cleanup queda fuera de scope.

## User decisions

- **DISCOVERY-ACCEPTED — Fallback path elimination (high-impact)**: opción (a) — eliminar el fallback **solo para orchestrator phases** (plan-feature, review-feature). Para leaf phases (implement-task, simplify-code, archive-feature, etc.), mantener el fallback como red de seguridad.
- **DISCOVERY-ACCEPTED — Sentinel asymmetry preservation (medium)**: el plan debe preservar la asimetría — SPEC-GAP-HIGH NO borra `.simplified`, solo FAIL lo borra.
- **DISCOVERY-ACCEPTED — OQ-1 resolution (medium)**: el plan resolverá la decisión de session lifecycle (inlined logic llama session_start, o queda single-call en orchestrators auto). Resolver al diseñar la migración.
- **DISCOVERY-ACCEPTED — agent-frontmatter.md doc update (medium)**: las líneas 35, 77, 79 deben actualizarse — counts y policy invertida.
- **DISCOVERY-ACCEPTED — CLAUDE.md model routing table update (low)**: columnas con "plan-feature sub-agents" / "review-feature sub-agents" deben reformularse post-migration.
- **DISCOVERY-ACCEPTED — bin/sdd update local-only mitigation (low)**: cross-repo SDD_HOME cleanup queda fuera de scope; verificación + ajuste local en este repo cubre EC-1.
