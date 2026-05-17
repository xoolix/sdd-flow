# Decisions

## Discovery checkpoint 1 (2026-04-23)

### DISCOVERY-ACCEPTED: Decision 1 — Migrar los 8 sub-agents internos (Opción A)

**Decisión**: total 17 native agents (9 públicos + 8 internos privados).

**Nuevos nombres de agents internos**:
- `sdd-explore-agent` (reemplaza `subagent_type: "Explore"` en plan-feature L104)
- `sdd-discovery-evaluator` (reemplaza `general-purpose`/haiku en plan-feature L109)
- `sdd-designer` (reemplaza `general-purpose`/sonnet en plan-feature L134)
- `sdd-task-planner` (reemplaza `general-purpose`/sonnet en plan-feature L145)
- `sdd-reviewer-voter` (reemplaza `general-purpose`/sonnet x3 en review-feature L52)
- `sdd-adversarial-reviewer` (reemplaza `general-purpose`/sonnet en review-feature L218)

**Razón del user**: simetría completa por frontmatter, control uniforme de model/context/permissions sobre TODO el pipeline. Evita asimetría donde las 9 fases externas corren en context isolation pero los 8 internos quedan en Task layer.

**Implicaciones para plan.md/tasks.md**:
- Crear 17 archivos en `.claude/agents/` en lugar de 9.
- Editar `plan-feature/SKILL.md:104,109,134,145` y `review-feature/SKILL.md:52,218` para apuntar a los nuevos `subagent_type`.
- Los 8 internos llevan `disallowedTools: [Agent]` (no re-delegan — executores puros).
- `sdd-plan-feature` y `sdd-review-feature` (los públicos) conservan Agent tool (delegan a los internos).

### DISCOVERY-ACCEPTED: Decision 2 — Diferir AC5 post-merge (Opción D)

**Decisión**: el hook automático de `mem_save` al cierre de fase NO es alcanzable en runtime actual (v2.1.118+).

**Validación realizada** (claude-code-guide + docs oficiales):
- No hay template engine en hook args
- No hay field-extraction del envelope del agent
- No hay CLI para invocar MCP tools desde shell hook
- Changelog v2.1.118+ sin mención de template support en hooks

**Consecuencia**: mantener `mem_save` explícito en SKILL.md (estado actual). Funciona y ya implementado por `_shared/engram-protocol.md`.

**Cambio al spec**: AC5 debe reformularse. Propuesta en task temprana:
```
AC5 (reformulado): Given fase completa con Status:success, When agent retorna envelope,
Then el SKILL.md preloadeado llama mem_save vía protocolo Engram estándar antes del envelope final.
```

**Follow-up post-merge**: cuando Claude Code agregue template support en hook args (o CLI MCP), re-evaluar para migrar a hook automático.

## Delta: 2026-04-23 — Tasks [T3]

- **MODIFIED**: T3 ("Pilot sdd-archive-feature") se dividió en T3a (crear file — executor work) y T3b (runtime validation — user action). Razón: el executor de `/implement-task` no puede correr `/archive-feature` dentro de su propio flow porque la validación requiere fresh session para verificar context isolation. T3b queda como gate manual previo a T4+.
- **KNOWN INCONSISTENCY**: `spec.md:37` AC6 dice "9 agents en `.claude/agents/`" pero Decision 1 (A) expandió a 17. Fix pospuesto a la task que toque AC6 end-to-end (probablemente T12 o T16) para no expandir scope de T1.

## Delta: 2026-04-23 (pivot) — Tasks [T2, T3a, T4-T6, T7-T11, AC2]

**PIVOT ARQUITECTÓNICO** descubierto en T3b pilot: los slash commands NO rutean a native agents — siempre invocan el skill en main context. El wrapper fino con `skills: [<phase>]` preload solo funciona cuando el agent se invoca vía `@agent-<name>` o `Agent(subagent_type=...)` desde un orquestador. Evidencia del pilot:
- `/archive-feature 006` → corrió skill en main context opus, recordó "verde caca" (no isolation)
- `@agent-sdd-archive-feature 006` → spawn correcto, `/cost` mostró $0.16 en haiku vs $0.45 opus, mem_save disparado ✅

**Decisión del user**: adoptar patrón **skill-as-router + body-in-agent** (Opción 1, igual que gentle-ai v1.23). Razones: el flujo SDD típico es paso a paso (el dev usa `/plan-feature`, `/implement-task` directamente), no auto-pipeline. Relajar AC2 hubiera reducido el valor del feature al 10% (solo orquestadores se beneficiarían).

**Cambios al diseño**:

- **MODIFIED**: patrón de los 17 agents. Antes: frontmatter + 3 líneas body + `skills: [<phase>]` preload. Ahora: frontmatter (sin `skills:`) + **full body content migrado desde SKILL.md**. No hay preload recursivo.
- **MODIFIED**: los 17 (o 9 públicos) SKILL.md se reescriben como **routers de ~10 líneas** — "Launch native agent `sdd-<phase>` with `$ARGUMENTS`. Fallback: execute inline if agent unavailable". Los 8 internos no necesitan skill router (no son user-facing — spawn desde plan-feature/review-feature).
- **MODIFIED**: `.claude/skills/_shared/agent-frontmatter.md` (creado en T2) describe la nueva convención router+body, no el wrapper fino.
- **MODIFIED**: AC2 del spec se reformula — el user accede al agent por slash (via router skill) o por @mention. El slash rutea automáticamente al agent via una línea de prose en el skill. Tarea dedicada para editar el spec.
- **ADDED**: T18 — renombrar `sdd-ff` → `sdd-auto` y `sdd-continue` → `sdd-next` en `.claude/skills/`, `bin/sdd`, README, y en cualquier referencia cruzada. Orquestadores ya quedan con nombres claros.
- **REDO**: T3a — el archivo `.claude/agents/sdd-archive-feature.md` creado con wrapper pattern se reescribe con body completo. `.claude/skills/archive-feature/SKILL.md` se reescribe como router.

**Scope extra vs plan original**: ~9 reescrituras de SKILL.md (los públicos) + llenar los 17 agent bodies con contenido migrado (no contenido nuevo). Mecánico, bajo riesgo. Estimado: +2-3 horas sobre el plan previo.

**Referencia externa**: gentle-ai v1.23 (`internal/assets/claude/`) usa este mismo patrón — los slash commands de gentle-ai son skills que dicen en prosa *"If the native sdd-orchestrator agent is available, delegate to it"*. No es un pattern exótico.

## Delta: 2026-04-23 (Phase 3 finding) — Tasks [T7, T8, T11] + RISK

**CRITICAL FINDING during T7-T11 execution**: el Agent tool de Claude Code (v2.1.119, tested en esta sesión) **NO reconoce native agents como `subagent_type`**. Al invocar `Agent(subagent_type="sdd-implement-task", ...)` el runtime responde `"Agent type 'sdd-implement-task' not found. Available agents: claude-code-guide, Explore, general-purpose, Plan, statusline-setup"`.

**Implicancia**: el mecanismo de spawning desde sesión (usado por los orquestadores `sdd-continue`, `sdd-ff`, `sdd-new`) puede fallar en runtime. El patrón `@agent-X` desde user input SÍ funciona (validado en T3b pilot) pero `Agent(subagent_type="sdd-X")` desde código del orquestador puede no funcionar.

**Uncertainties**:
- Esta sesión tiene tool allowlist restringido — puede no ser representativo de la CLI normal del user.
- El user validó `@agent-sdd-archive-feature` spawning en su CLI, así que algún mecanismo existe. Puede ser que la CLI resuelva `@agent-X` de forma distinta al Agent tool programático.
- Sin test en CLI normal del user, no podemos confirmar si T7/T8/T11 funcionarán al correr `/sdd-continue`, `/sdd-ff`, `/sdd-new`.

**Mitigación aplicada**: los 3 orchestrators editados (T7, T8, T11) incluyen explícitamente un **fallback**: si `subagent_type: "sdd-<phase>"` no es reconocido, leer el body del agent file y pasarlo a `subagent_type: "general-purpose"`. Esto degrada (pierde model-per-frontmatter + isolation) pero mantiene la funcionalidad.

**User action requerida**: en T16 (E2E test), verificar que el primer `/sdd-continue` o `/sdd-ff` en CLI normal spawea los native agents correctamente. Si no lo hace, todos los orchestrator paths caen al fallback — el feature funciona pero pierde su valor principal (model override, isolation) para el flujo orchestrated. El flujo directo (`/plan-feature` → router → agent spawn) tiene la misma incertidumbre.

### Update (2026-04-23, tras investigación paralela claude-code-guide + gentle-ai source inspection)

**RISK DOWNGRADED de CRITICAL a OPERATIONAL**. Investigación confirmó:

1. **Agent tool schema se popula al session init** (docs oficiales: "Subagents are loaded at session start"). Agents creados mid-sesión NO aparecen en la whitelist — requiere restart o `/agents` reload.
2. **Mi fallo fue artefacto de mid-session creation**: Phase 1-3 creó 14 de los 15 agents mid-sesión, nunca refreshé el schema. Por eso `Agent(subagent_type: "sdd-implement-task")` falló — el schema estaba cacheado antes de que el agent existiera.
3. **El flujo normal (fresh session tras deploy) funciona correctamente**: gentle-ai v1.23 usa exactamente el mismo patrón (`task(subagent_type: "sdd-<phase>", model: ...)`) y funciona end-to-end en la comunidad (ninguna issue reportando "Agent type not found").
4. **`@agent-<name>` (CLI) y `Agent(subagent_type=<name>)` (SDK) son mecanismos distintos**: el primero se resuelve dinámicamente por la CLI layer, el segundo contra schema estático capturado al init. Ambos respetan precedencia project > user scope.

**Conclusión**: el feature funciona como diseñado. La limitación es un dev-workflow issue (no se puede testear mid-sesión), no un defect arquitectónico. El fallback inline agregado en T7/T8/T11 sigue siendo valioso como insurance (gentle-ai issue #324 confirma que "orchestrator loading phase SKILLs inline" es un escenario real que vale la pena prevenir).

**Implicancia para T16**: el user debe validar en sesión fresca post-deploy. Si `/sdd-next <id>` spawnea el agent correctamente (muestra `sdd-<phase>(...)` como header y `/cost` confirma model del frontmatter), el feature está validated end-to-end. Resultado esperado según evidencia: funciona.

## T16 E2E Dogfood Result (2026-04-24)

**Outcome**: ✅ **PASS**. Feature dummy `010-hello-world` ran through full pipeline in fresh session (inside feature 009 test harness). 6 fases: spec → plan → implement → simplify → review → archive. Status: SUCCESS. Archived at `specs/archive/2026-04-24-010-hello-world/`. Total: ~200K tokens across 6 phases (spec 25K, plan 35K, implement 22K, simplify 30K, review 55K, archive 40K).

**Validates**: AC1 (orquestador invoca agents nativos), AC2 (context aislado en voters), AC3 (`$ARGUMENTS` propaga), AC4 (modelo desde frontmatter), AC6 (15 agents en place). AC5 queda diferido post-merge (per decisions.md Decision 2 = D).

## Findings discovered during T16 (external to 008's scope)

These are bugs in existing SDD skills (review-feature, simplify-code, archive-feature) that were either introduced or exposed by the native-agent migration. Logged here for follow-up — NOT deltas to spec 008, which only covered the migration itself.

1. **[medium UX bug]** `sdd-review-feature` parallel-voter monitor stalls — required SendMessage ping to resume aggregation. Likely a v2.1.119 quirk in how nested native agents report completion to an orchestrator agent that has `disallowedTools` unset. Worth investigating; may require workaround in `sdd-review-feature.md` body to poll voter completion more robustly.
2. **[medium scope bug]** `sdd-simplify-code` scope detection included pre-existing `bin/sdd` change (from 008 working tree), NOT part of 010's own diff. The `git diff <base>..HEAD ∪ git status --short` union is too permissive when the working tree has unrelated in-progress changes. Pre-existed 008, now visible. Candidate fix: scope to feature-id's own files or require a clean working tree pre-simplify.
3. **[low]** `sdd-archive-feature` directory naming convention `YYYY-MM-DD-<feature-id>` is not documented in CLAUDE.md. Should be added to the Skill routing or Archive section.
4. **[low]** `.simplified` sentinel not preserved in archive — moves to `specs/archive/YYYY-MM-DD-<feature-id>/` but doesn't retain the sentinel. If spec-gap rerun is needed post-archive, this matters. Probably intentional (archive is terminal), but should be explicit.
5. **[positive]** Adversarial review found 1 medium + 3 low SPEC-GAPs even on a trivial 2-line feature — confirms adversarial pass is not bypassed by triviality. This is healthy behavior.

**Recommendation**: file findings #1–4 as a follow-up feature (e.g., `011-sdd-dogfood-fixes`) post-merge of 008. They don't block 008's review/archive.

## SPEC-GAP — 008-sdd-native-sub-agents — adversarial review

| # | Severity | Category | Description | Suggested Action |
|---|----------|----------|-------------|-----------------|
| 1 | medium | edge-case | `sdd-research-spike` has `disallowedTools: [Agent]` which silently breaks its own parallel-investigation protocol (body step 6 instructs "Launch parallel agents"). No spec scenario covers degraded-mode research. Introduced during T4/T5 migration, not captured in decisions.md. | Add delta: "MODIFIED: sdd-research-spike now runs single-agent investigation (parallel agents blocked by disallowedTools)". Consider removing disallowedTools or rewriting body to remove parallel-agent instructions. |
| 2 | medium | uncovered-scenario | Agent version drift after upstream SDD updates: `bin/sdd update` copies missing agents but never updates existing ones. Users on old agent versions get no indication and no upgrade path except manual delete + re-run. | Document in README: "To update existing agents, delete `.claude/agents/sdd-*.md` and run `bin/sdd update`." Or add a `--force` flag to `sdd update`. |
| 3 | medium | undocumented-assumption | AC5's deferred status creates an ambiguous acceptance criterion. Spec shows AC5 as `- [ ]` (unchecked) but T16 validates behavior works from agent body. Future reviewers won't know AC5 was accepted as-is. | Add delta: "AC5 ACCEPTED as partially implemented: mem_save fires from agent body (not hook). Checkbox remains unchecked pending hook support post-merge." |
| 4 | low | uncovered-scenario | Parallel-voter stall scenario (decisions.md finding #1 from T16): no spec AC or operational guidance covers partial voter completion. | File in `011-sdd-dogfood-fixes` as already recommended. |
| 5 | low | undocumented-assumption | AC6 "symlink apunta a contenido válido (o es copy)" is vague — the boilerplate repo ends up with a typechange in git status for CLAUDE.md. Benign but confusing. | Clarify in decisions.md: "In boilerplate repo, CLAUDE.md is a tracked regular file (copy mode); typechange in git status is expected and benign." |
| 6 | low | edge-case | `.gitignore` typo: `docs.claude/CLAUDE.md` on line 4 means `docs/` is not gitignored as intended. Minor risk of accidental commit. | Fix `.gitignore` line 4: split into `docs` and the existing `.claude/CLAUDE.md` on separate lines. |

Source: adversarial review agent, review-feature phase
Date: 2026-04-24

## Delta: 2026-04-24 — Pre-archive WARN fixes (Review Round 1)

Applied the two WARN items surfaced by the 3-agent review before archiving:

- **MODIFIED — `sdd-research-spike` parallel investigation restored**: removed `disallowedTools: [Agent]` from `.claude/agents/sdd-research-spike.md` frontmatter. Resolves SPEC-GAP row 1 (medium): body step 6 explicitly instructs parallel-agent investigation — the original `disallowedTools: [Agent]` was a copy-paste from internal-executor agents and silently degraded research quality. The public spike phase is the one place where Agent re-delegation is intentional (general-purpose agents for web research + Explore agents for codebase analysis).
- **FIXED — `.gitignore` typo**: line 4 `docs.claude/CLAUDE.md` split into `docs` (line 4) and kept existing `.claude/CLAUDE.md` on line 6. Resolves SPEC-GAP row 6 (low): `docs/` was not actually gitignored due to concatenated entries.

Remaining SPEC-GAPs (rows 2–5) deferred to follow-up feature `011-sdd-dogfood-fixes` as already planned.

## Deltas merged — 2026-04-24 (archive phase)

**Status**: No spec.md changes required. The two WARN fixes (parallel investigation + .gitignore typo) were environmental hygiene, not spec-scope changes — already applied to working tree before archive. SPEC-GAPs rows 2–5 remain deferred per planning.

Merged deltas count: 0 (all spec.md requirements remain unchanged; accepted deviations documented above).
