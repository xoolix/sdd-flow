# Tasks

## Execution order

### 1. Foundation

- [x] **T1 — Spec adjust**: Reformular AC5 en `specs/008-sdd-native-sub-agents/spec.md:36` con el texto aceptado en `decisions.md`.
- [x] **T2 — Agent template (router+body pattern)**: `.claude/skills/_shared/agent-frontmatter.md` documenta el patrón skill-router + agent-body (actualizado post-pivot 2026-04-23).
- [x] **T3a — Pilot agent + skill router (archive-feature)**: `.claude/agents/sdd-archive-feature.md` con body completo migrado desde SKILL.md. `.claude/skills/archive-feature/SKILL.md` reescrito como router de ~10 líneas.
- [x] **T3b — Pilot runtime validation (router+body pattern)**: Validado 2026-04-23: `@agent-sdd-archive-feature 006` → haiku ($0.16), mem_save ✅, context isolation ✅, `$ARGUMENTS` resuelto ✅. Pivot confirmó: slash direct no rutea al agent (por eso se adopta router pattern).

### 2. Core — 17 agents (body) + 9 skill routers

- [x] **T4 — 5 public phases**: agents + routers para research-spike, plan-feature, implement-task, simplify-code, review-feature (body migrado, frontmatter con model/disallowedTools correctos).
- [x] **T5 — 3 public entries**: agents + routers para new-feature, new-quick-feature, new-fix.
- [x] **T6 — 6 internal agents** (body only, sin skill router): sdd-explore-agent, sdd-discovery-evaluator, sdd-designer, sdd-task-planner, sdd-reviewer-voter, sdd-adversarial-reviewer — todos con `disallowedTools: [Agent]`. Body extracted/crafted desde prompts inline de plan-feature/review-feature. **Nota**: 6 archivos únicos (sdd-reviewer-voter es un archivo, invocado 3x en paralelo por sdd-review-feature — no son 3 files).

### 3. Core — orchestrators

- [x] **T7 — `sdd-continue/SKILL.md`**: Step 3 reescrito — `subagent_type: "sdd-<phase>"`, tabla modelo/fase eliminada (delegada a frontmatter). Fallback a `general-purpose` si runtime no reconoce native agent.
- [x] **T8 — `sdd-ff/SKILL.md`**: Step 2 item 2 reescrito análogamente, con mismo fallback.
- [x] **T9 — `plan-feature/SKILL.md`**: NO-OP. La lógica se movió al agent body durante Phase 2. `.claude/agents/sdd-plan-feature.md` ya referencia correctamente `sdd-explore-agent`, `sdd-discovery-evaluator`, `sdd-designer`, `sdd-task-planner` (verificado grep).
- [x] **T10 — `review-feature/SKILL.md`**: NO-OP. `.claude/agents/sdd-review-feature.md` ya referencia `sdd-reviewer-voter` y `sdd-adversarial-reviewer` (verificado grep).
- [x] **T11 — `sdd-new/SKILL.md`**: Reescrito para invocar directamente `sdd-new-feature` agent (bypass de routing doble), con fallback inline.

### 4. Validation / Infra

- [x] **T12 — `bin/sdd` install**: bloques en `cmd_init` y `cmd_update` para copy-not-overwrite de `.claude/agents/sdd-*.md`.
- [x] **T13 — `bin/sdd update`**: protección target==SDD_HOME + comentario en broken-symlink branch que cubre circular.
- [x] **T14 — Fix `.claude/CLAUDE.md`**: symlink circular eliminado, restaurado desde backup. Ya estaba en `.gitignore`.
- [x] **T15 — `README.md`**: sección "Uso de agentes" reescrita (router+body, 15 agents, delega model a frontmatter). AC6 count corregido a 15.
- [x] **T16 — E2E test** ✅ (2026-04-24: dummy `010-hello-world` pipeline 6 fases SUCCESS, ~200K tokens. Findings en decisions.md).
- [x] **T17 — Regression** ✅ (covered by T16 dogfood + T3b pilot: pipeline completo sin errores, detect-already-archived también OK. No regression separada necesaria).
- [x] **T18 — Rename commands**: `sdd-ff`→`sdd-auto`, `sdd-continue`→`sdd-next`. Dirs movidos, `name:` frontmatter actualizado, `CORE_SKILLS` en `bin/sdd`, refs cruzadas reemplazadas en 8 archivos. Grep final = 0 refs fuera de specs/008.

## Notes

- T1 antes de T3 (spec coherente antes del pilot).
- T2 antes de T4-T6 (template antes de los agents).
- T3 antes de T4-T10 (pilot valida antes de escalar).
- T12-T14 pueden paralelizarse con T4-T11 (distintos archivos).
- T16-T17 son gate de merge — correr al final.
- T18 al final (rename toca muchos archivos — menos risk hacerlo cuando todo el contenido ya esté consolidado).
- Actualizar `decisions.md` si el plan cambia durante la implementación.
