# Discovery Report
status: findings-present

## High-impact findings

- **[scope-expansion]** `plan-feature` y `review-feature` son orquestadores internos que lanzan **8 sub-agents adicionales NO especificados en el spec** (impact: high)
  - `plan-feature/SKILL.md:104` — Explore agents paralelos (`subagent_type: "Explore"`)
  - `plan-feature/SKILL.md:109` — Discovery Evaluator (`subagent_type: "general-purpose"`, haiku)
  - `plan-feature/SKILL.md:134` — Design agent (`subagent_type: "general-purpose"`, sonnet)
  - `plan-feature/SKILL.md:145` — Task Planner agent (`subagent_type: "general-purpose"`, sonnet)
  - `review-feature/SKILL.md:52` — 3 voters paralelos (Agent-A/B/C, `general-purpose`, sonnet)
  - `review-feature/SKILL.md:218` — Adversarial reviewer (`general-purpose`, sonnet)
  - **Total**: 4 internos en plan-feature + 4 internos en review-feature = 8 agents adicionales.
  - **Por qué HIGH**: el spec cuenta 9 agents. Si migramos los 8 internos también → 17 agents, naming scheme distinto (públicos `sdd-<phase>` vs internos `sdd-<subrole>`), impacto directo en `disallowedTools: [Agent]` (los internos no pueden delegar). Si NO los migramos → asimetría: las 9 fases externas corren en context isolation con frontmatter, pero dentro de `plan-feature`/`review-feature` la delegación interna sigue siendo `general-purpose` (sin aislamiento entre voters, sin model-per-role en frontmatter).

## Other findings

- **[edge-case]** AC5 implementation (hook → `mem_save` automático) no está validado en runtime. 4 opciones propuestas (shell script, MCP direct template, sub-agent mini, o diferir). Opción B recomendada pero no verificada — riesgo de que runtime no soporte placeholders en hook args. Fallback: dejar `mem_save` explícito en SKILL.md y diferir AC5 post-merge. (impact: medium)

- **[conflict]** `bin/sdd` no tiene detector de symlink circular (AC6 + E7). `cmd_update` L331-336 actual no maneja el caso `readlink(x) == x`. Requiere detector explícito antes del repair. (impact: medium)

- **[edge-case]** `skills: [<phase>]` preload semantics documentado pero **no validado en runtime real** para nuestro caso. Si el preload falla silenciosamente, las fases quedan sin instrucciones. Debe validarse en el pilot (task temprana) antes de rollout completo. (impact: medium)

- **[simplification]** Frontmatter semantics maduras — `skills:` preload, `$ARGUMENTS` substitution, `context: fork`, hooks MCP, todo documentado. No requiere nuevos campos, solo uso correcto de los existentes. (impact: low)

- **[simplification]** `bin/sdd` ya tiene patrón copy-not-overwrite (L207-218 para rules/) reutilizable para deploy de los agent files. Reduce implementación del installer. (impact: low)

- **[discovery]** E5 resuelto por exploración: `context: fork` en skill + native agent aislado = **NO doble-fork** (el agent prevalece). Spec 008 E5 se puede cerrar sin cambios. (impact: low)

- **[discovery]** E7 + OQ3 resueltos: symlink `.claude/CLAUDE.md` debe ser **copy no symlink** (contenido project-specific, no global). Auto-gitignored. Cambio en `bin/sdd init/update`. (impact: low)

## User decisions

<!-- Completá cada decisión alta-impacto con DISCOVERY-ACCEPTED o DISCOVERY-DISCARDED + breve razón. Los findings medium/low se aplican automáticamente en plan.md/tasks.md sin necesidad de decisión. -->

### Decision 1 — Migrar los 8 sub-agents internos de plan-feature + review-feature?

**Opciones**:

- **A. Migrar los 8 internos** (total: 17 native agents). Naming: `sdd-explore-agent`, `sdd-discovery-evaluator`, `sdd-designer`, `sdd-task-planner`, `sdd-reviewer-voter`, `sdd-adversarial-reviewer`. Los 8 internos llevan `disallowedTools: [Agent]` (no re-delegan). Simetría completa, control por frontmatter en cada sub-agent, pero **17 archivos** en lugar de 9 y cambios en `plan-feature` + `review-feature` SKILL.md para usar los nuevos `subagent_type`.

- **B. NO migrar los internos** (total: 9 native agents). Los 8 internos siguen invocados como `general-purpose` con prompt injection (estado actual). Asimetría: las 9 fases externas corren en agent layer; la delegación interna sigue en Task layer. Cambio más chico, consistente con el scope original del spec.

- **C. Migrar parcial — solo `Explore` internos** (total: 10 native agents). Reusa `sdd-research-spike` o crea `sdd-explore-agent` único. Los otros 6 (Discovery-Evaluator, Designer, TaskPlanner, 3 voters, Adversarial) quedan como `general-purpose`. Compromiso entre A y B.

**Qué agregar abajo**: `DISCOVERY-ACCEPTED: A` (o B, o C) + razón.

---

### Decision 2 — AC5 hook implementation

**Opciones**:

- **A. Hook shell script + regex parser** — parse del envelope raw, invoca `mem_save` vía MCP. Requiere ejecutar bash en el hook del agent. Frágil si el formato del envelope cambia.

- **B. Hook MCP directo con placeholders** (recomendación del explorer) — declarativo en frontmatter. **No verificado**: si el runtime no soporta placeholders con field-extraction del output del agent, B no funciona.

- **C. Sub-agent mini post-phase** — hook dispara sub-agent que parsea + llama `mem_save`. Sobrecarga de costo, overkill.

- **D. Diferir AC5 a post-merge** — dejar `mem_save` explícito en SKILL.md (como hoy). AC5 queda fuera del spec 008 y se aborda en un feature follow-up cuando se valide el runtime.

**Qué agregar abajo**: `DISCOVERY-ACCEPTED: B con fallback a D si runtime no soporta` (o la opción que prefieras).

---

<!-- Agregá tus decisiones abajo de esta línea -->

**DISCOVERY-ACCEPTED: Decision 1 = A** (migrar los 8 internos, total 17 native agents). Razón del user: simetría completa por frontmatter, control uniforme de model/context/permissions. Implicación: naming scheme agregado (`sdd-explore-agent`, `sdd-discovery-evaluator`, `sdd-designer`, `sdd-task-planner`, `sdd-reviewer-voter`, `sdd-adversarial-reviewer`), los 8 internos llevan `disallowedTools: [Agent]` (no re-delegan), cambios adicionales en `plan-feature/SKILL.md:104,109,134,145` y `review-feature/SKILL.md:52,218`.

**DISCOVERY-ACCEPTED: Decision 2 = D (diferir AC5 post-merge)**. Validación completa contra docs oficiales v2.1.118+ ([sub-agents](https://code.claude.com/docs/en/sub-agents), [hooks](https://code.claude.com/docs/en/hooks), [agent-sdk hooks](https://code.claude.com/docs/en/agent-sdk/hooks)):

- Placeholders `{{ }}` en args del hook: **NO soportado** (no template engine documentado).
- Field-extraction del output/envelope del agent: **NO soportado** (hook solo recibe `agent_transcript_path`, sin parsing nativo).
- Env vars en hook args: **NO con sintaxis `{{ env.X }}`**, solo `$VAR` en shell hooks. Y no se documenta cómo inyectar FEATURE_ID al invocar un agent.
- Shell hook con CLI a MCP: **NO existe CLI para invocar MCP tools** — no hay forma de llamar `mem_save` desde un shell script externo.
- Changelog v2.1.118+: v2.1.118 agregó "Hooks can now invoke MCP tools directly via type: mcp_tool" **sin template support**. Sin mención de placeholders/extraction en releases posteriores.

**Consecuencia para spec 008**: AC5 como está redactado ("hook dispara mem_save sin llamar explícito en SKILL.md") **NO es alcanzable** con runtime actual. Decisión: mantener `mem_save` explícito en SKILL.md (estado actual del código) — funciona y ya está implementado. Registrar AC5 como "diferido a post-merge" con follow-up: re-evaluar cuando Claude Code agregue template support en hook args.

**Cambio al spec**: AC5 debe ser reformulado o eliminado. Propuesta: cambiar AC5 a "Given fase completa, When agent retorna envelope, Then el SKILL.md preloadeado llama `mem_save` vía protocolo Engram estándar" (AC descriptivo del estado actual, no del ideal futuro). Actualizar spec.md en task temprana del feature.
