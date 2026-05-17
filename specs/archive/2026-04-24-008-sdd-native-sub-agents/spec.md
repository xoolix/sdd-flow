# Feature: SDD pipeline → native sub-agents con context isolation

## Summary
Migrar las 9 entradas del pipeline SDD (6 fases + 3 entradas) de skills invocados vía `Task(subagent_type="general-purpose")` a native sub-agents en `.claude/agents/sdd-*.md`. Cada agent: wrapper fino con `skills: [<phase>]` preload y frontmatter declarando `model`, `effort`, `mcpServers`, `permissionMode`, `disallowedTools`. Orquestadores `/sdd-continue`, `/sdd-ff` se actualizan para invocarlos. SKILL.md quedan intactos como fuente de verdad. Motivación: context isolation, frontmatter como única fuente del modelo/tools por fase, resuelve los 2 GAPs de R-004.

## Trigger
Dev corre cualquier comando SDD (`/sdd-continue`, `/sdd-ff`, `/plan-feature`, `/implement-task`, `/research-spike`, etc.) y el runtime invoca el agent nativo correspondiente en vez del skill por Task.

## Happy Path
1. Orquestador resuelve fase actual del feature.
2. Invoca agent nativo `sdd-<phase>` (no `Task(subagent_type=...)`).
3. Agent arranca en context aislado; frontmatter define model/mcpServers/permissionMode.
4. `skills: [<phase>]` preloadea SKILL.md; `initialPrompt` inyecta `sdd-phase-common.md` + `engram-protocol.md` + feature-id + compact rules.
5. Agent ejecuta fase, produce artefactos, lanza sub-agents internos si corresponde.
6. Agent retorna envelope (Status/Summary/Artifacts/Next/Risks); hook dispara `mem_save`.
7. Orquestador valida y avanza. Invocación **directa** (`/plan-feature <id>`) también rutea al agent.

## Domains
- [x] Infrastructure / deploy (`.claude/agents/` nuevo; `bin/sdd` update)
- [x] Other: Agent layer (9 archivos), orquestadores, hooks, docs, fix symlink roto `.claude/CLAUDE.md`

## Edge Cases
- **E1 — Task tool deprecated**: si spike confirma que Task no invoca agents nativos, orquestador necesita alterno (Agent tool / `/agent` / SendMessage). Bloqueante.
- **E2 — `$ARGUMENTS` no propaga**: feature-id queda en agent, skill lee vacío → pre-flight rompe.
- **E3 — Feature en vuelo**: `/sdd-continue 007-*` con artefactos mixtos; sin detección, flujo nuevo vs viejo indefinido.
- **E4 — Engram no instalado**: agent con `mcpServers:[engram]` falla al iniciar. ¿Degrade u obligatorio?
- **E5 — Conflicto `context: fork`**: `research-spike/SKILL.md` ya declara fork; agent nativo también aísla → doble fork.
- **E6 — `bin/sdd update` en instalaciones previas**: deploy de 9 agents + fix symlink sin pisar config local.
- **E7 — Symlink `.claude/CLAUDE.md` se apunta a sí mismo** (ELOOP): fix naive puede dejar contenido incorrecto.

## Acceptance Criteria
- [ ] **AC1**: Given feature con plan.md+tasks.md, When `/sdd-continue <id>`, Then orquestador invoca `sdd-<phase>` nativo (no Task generic) y cost report muestra model del frontmatter.
- [ ] **AC2**: Given feature existente, When `/plan-feature <id>` directo, Then corre `sdd-plan-feature` en context aislado (no ve historia padre).
- [ ] **AC3**: Given comando con `<id>`, When agent arranca, Then SKILL.md preloadeado ejecuta pre-flight con `$ARGUMENTS` resuelto; `specs/$ARGUMENTS/*` paths resuelven.
- [ ] **AC4**: Given dev cambia modelo de una fase, When edita sólo `.claude/agents/sdd-<phase>.md`, Then próxima corrida usa el nuevo model sin tocar README ni orquestadores.
- [ ] **AC5**: Given fase completa con Status:success, When agent retorna envelope, Then el SKILL.md preloadeado llama `mem_save` vía protocolo Engram estándar antes del envelope final. (Reformulado en T1 — ver `decisions.md` Discovery Checkpoint Decision 2. Hook automático diferido post-merge por falta de soporte de templates en runtime v2.1.118+.)
- [ ] **AC6**: Given repo con SDD previo, When `bin/sdd update`, Then aparecen **15 agents** en `.claude/agents/` (9 públicos + 6 internos), symlink `.claude/CLAUDE.md` apunta a contenido válido (o es copy en este boilerplate repo), skills de fases no se pisan. (Corregido 2026-04-23 en T12: el count original decía 9 porque el spec se escribió antes de Decision 1 que expandió a migrar sub-agents internos. Ver decisions.md.)

## Rollback Plan
- Cambio additivo. Revert del merge commit: elimina `.claude/agents/`, revierte `sdd-continue/SKILL.md`, `sdd-ff/SKILL.md`, `sdd-new/SKILL.md`, `README.md`, `bin/sdd`. SKILL.md de fases no se tocan. Sin DB ni user data. Features en vuelo siguen con flujo viejo vía Task.

## Success Criteria
- **Adopción**: 9/9 fases con cost report mostrando model del agent frontmatter (7 días post-merge).
- **Zero regression**: `/sdd-continue` sobre copias de 005/006/007 completa sin error en los 3.
- **Time-to-change modelo**: PR que cambia model de fase toca **exactamente 1 archivo**.
- **Context isolation**: e2e test confirma que `sdd-research-spike` arranca sin historia del padre.

## Open Questions
- **OQ1** ✅ resuelto por [R-005](../../research/R-005-task-tool-vs-native-agent-invocation/research.md): Agent tool (Task alias, rename v2.1.63) con `subagent_type="sdd-<phase>"`; args por prompt injection. `sdd-plan-feature` y `sdd-review-feature` deben conservar Agent tool (orquestadores internos); los otros 7 pueden `disallowedTools: [Agent]` para bloquear recursión.
- **OQ2**: ¿Engram obligatorio o graceful degrade si no está instalado?
- **OQ3**: ¿Target correcto del symlink `.claude/CLAUDE.md`?
- **OQ4**: ¿Hooks hoy soportan derivar title/type/content del envelope, o necesita helper?
