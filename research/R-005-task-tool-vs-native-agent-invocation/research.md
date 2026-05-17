# Research Spike

## Metadata
- Research ID: R-005
- Topic: Task tool vs native agent invocation mechanism
- Owner: santi
- Status: complete
- Linked feature: 008-sdd-native-sub-agents
- Sources: Anthropic docs (sub-agents, skills, hooks), Claude Code changelog (v2.1.63, .118, .119), gentle-ai v1.23 source, R-001/R-004, current SDD codebase
- Date: 2026-04-23

## Brief
Resolver OQ1 de `specs/008-sdd-native-sub-agents/spec.md:49`: ¿Cuál es el mecanismo correcto para invocar un native sub-agent (`.claude/agents/sdd-<phase>.md`) desde un skill-orquestador (`sdd-continue`, `sdd-ff`, `plan-feature`, `review-feature`)? Task tool, Agent tool, SendMessage, `/agent <name>`, o algún MCP custom.

## Why now
OQ1 es bloqueante del feature 008. Sin saber el mecanismo no se puede reescribir el Step 3 del orquestador (5 sitios). Además, 2 de nuestros "phase agents" (`plan-feature`, `review-feature`) son **orchestradores internos** que delegan a sub-agents — si el mecanismo los restringe, hay que rediseñar esas fases.

## Context gathered
- **R-001** ya documentó "hub-and-spoke" como el patrón viable en Claude Code; "no nested delegation" como limitación histórica. Pero el código actual (`plan-feature/SKILL.md:104,109,133-145`) sí lanza sub-agents anidados, así que la limitación puede no aplicar cuando el parent es un skill-en-prompt (no un native agent).
- **R-004**: descartó "native agents" por duplicación. Esta research se gatilla porque esa conclusión estaba incompleta — eran primitivas distintas.
- **Superficie actual**: 5 SKILL.md con invocación Task (sdd-continue L65, sdd-ff L42, plan-feature L104/109/134/145, review-feature L52/218, + sdd-new L19-20 sin Task).

## Questions
1. ¿Task tool sigue existiendo en abril 2026 o fue reemplazado?
2. ¿Cuál es el mecanismo exacto para apuntar al native agent `sdd-<phase>` en vez de `general-purpose`?
3. ¿Cómo propagan argumentos dinámicos (feature-id) desde orquestador → agent → skill preloadeado?
4. ¿Los phase-agents que son internamente orquestadores (plan-feature, review-feature) pueden delegar a sub-agents o gentle-ai lo bloquea?
5. ¿Hooks con MCP soportan `mem_save` automático al cierre con metadata derivada del envelope?

## Options to evaluate
- **A. Task/Agent tool con `subagent_type: "sdd-<phase>"`** (rename cosmético v2.1.63, ambos viven)
- **B. `/agent <name>` slash command** programático desde skill
- **C. SendMessage** a agent recién creado
- **D. MCP tool custom** para spawnear agents
- **E. Hub explícito** via archivo de "boot" (patrón gentle-ai — prose-level delegation)

## Evaluation criteria
Compatibilidad programática · Propagación de args · Hook support · Recursive delegation (nested) · Migration cost · Documented vs inferido

## Findings

### Matriz de opciones

| Opción | Programático desde skill | Pasa args | Context isolation | Hook support | Nested delegation | Doc / Inferido | Migration cost |
|---|---|---|---|---|---|---|---|
| **A. Agent tool (Task alias)** | ✅ `Agent(subagent_type="sdd-plan", prompt="feature-id=008-x...", model=opus)` | Prompt injection | ✅ sí (frontmatter) | ✅ v2.1.118 | ⚠️ depende de `disallowedTools` del agent | Documentado oficial | **Bajo** (3-5 line change per site) |
| B. `/agent <name>` | ❌ slash interactivo | N/A | N/A | N/A | N/A | Documentado | N/A |
| C. SendMessage | ❌ solo a agents ya vivos | N/A | N/A | N/A | N/A | Documentado | N/A |
| D. MCP custom | ✅ factible | custom | custom | N/A | custom | No existe | Alto (build MCP) |
| E. Hub en prose (gentle-ai) | ✅ indirecto vía natural-language | slash `$ARGUMENTS` | ✅ si agent declarado | ✅ | ❌ gentle-ai quita Task a phase agents | Documentado (release v1.23) | Medio |

### Evidencia clave

1. **Rename oficial Task → Agent** (v2.1.63): `Task(...)` sigue siendo alias válido. `subagent_type` apunta a native agent por `name` del frontmatter. Fuente: `code.claude.com/docs/en/sub-agents`.
2. **Nuestro Task tool actual ya es "Agent tool"**: `sdd-continue/SKILL.md:65` con `subagent_type="general-purpose"` → cambiar a `subagent_type="sdd-<phase>"` es literal un edit de string.
3. **gentle-ai v1.23** (`internal/assets/claude/sdd-orchestrator.md`): usa Agent tool, pasa feature-id por prompt injection + engram topic-key `sdd/{change-name}/...`. **Bloquea recursión** quitando `Task` del frontmatter de phase agents.
4. **Nuestra diferencia con gentle-ai**: `plan-feature` y `review-feature` necesitan **delegar** (3-voter review, parallel Explore/Design/TaskPlanner). Los agents nativos correspondientes (`sdd-plan-feature`, `sdd-review-feature`) deben **conservar** Agent tool (no listarlo en `disallowedTools`). Los otros 7 sí pueden bloquear recursión.
5. **Hooks + MCP** (v2.1.118): `mem_save` al cierre es factible declarando `hooks: Stop: type: mcp_tool`. **Derivación de title/type/content del envelope requiere parsing custom** — no hay mapeo automático. Bajo-medio esfuerzo.
6. **Context isolation real**: es propiedad del frontmatter del agent, no del mecanismo de invocación. Task/Agent tool apuntando a native agent = aislamiento nativo.

## Recommendation

**Opción A: Agent tool (con alias Task) apuntando al native agent por `name`.**

### Por qué
- Documentada, estable, costo de migración mínimo (literal cambio de string en 5 sitios).
- Mantiene compatibilidad con código existente — `Task(subagent_type="sdd-plan")` funciona idéntico.
- Soporta hooks MCP, context isolation, model-per-frontmatter, skills preload — todo lo que pide AC1-AC6 del spec 008.
- Resuelve el riesgo en el plan `creo-que-no-se-quiet-hopcroft.md`: no hay "deprecation"; es rename cosmético.

### Divergencia explícita de gentle-ai
`sdd-plan-feature.md` y `sdd-review-feature.md` deben **conservar** Agent tool en su configuración (no `disallowedTools: [Agent]`), porque delegan internamente (3-voter review, Explore+Design+TaskPlanner paralelos). Los otros 7 agents sí pueden bloquear recursión. Documentar esto en la nota de migración.

### Tradeoffs
- **Nested delegation**: depende del `disallowedTools` del agent, no hay garantía forzada por runtime. → Mitigación: unit-test que invoca `sdd-archive-feature` (no-delegator) y verifica que rechaza Agent tool si se le pide.
- **Args por prompt**: no hay campo `arguments:` estructurado en native agents. Prompt injection sigue vigente. → No hay mejor opción disponible.

### Actualizar spec
Spec 008 `OQ1`: marcar resuelto con referencia `R-005`. Reemplazar texto por: "Resuelto por R-005: Agent tool (Task alias) con `subagent_type="sdd-<phase>"`, args por prompt injection. `sdd-plan-feature` y `sdd-review-feature` conservan Agent tool por su rol de orquestadores internos."

## Next
Volver a 008 con OQ1 resuelto. Próximo paso: `/plan-feature 008-sdd-native-sub-agents` — el plan debe incorporar:
1. En `.claude/agents/sdd-plan-feature.md` y `sdd-review-feature.md`: no poner Agent tool en `disallowedTools`.
2. En los otros 7: considerar `disallowedTools: [Agent]` para bloquear recursión defensivamente (alineado con gentle-ai).
3. Task 1 del feature: escribir helper que derive `mem_save` params desde el envelope (OQ4 pendiente).
