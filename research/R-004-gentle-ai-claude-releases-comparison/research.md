# Research Spike

## Metadata
- Research ID: R-004
- Topic: gentle-ai v1.18–v1.23 vs nuestro SDD — mejoras para Claude Code
- Owner: santi
- Status: complete
- Linked feature: —
- Fuentes: [gentle-ai releases](https://github.com/Gentleman-Programming/gentle-ai/releases), `docs/agents.md`, `docs/intended-usage.md`, `docs/components.md`
- Fecha corte: v1.23.0 (2026-04-23)

## Brief
Relevar las releases recientes de `Gentleman-Programming/gentle-ai` (v1.18.x → v1.23.0) e identificar qué patrones aplicables a Claude Code podemos incorporar a nuestro flujo SDD.

## Why now
El equipo usa Claude Code. gentle-ai v1.22–v1.23 liberaron features **Claude-específicas** (slash commands gestionados, native sub-agents por fase SDD, asignación de modelo por fase vía frontmatter). Nuestro SDD ya resuelve parte de esto — vale comparar antes de duplicar o desviar.

## Context gathered
- **Stack actual SDD**: skills en `.claude/skills/` por fase (plan-feature, implement-task, simplify-code, review-feature, archive-feature, research-spike). Orquestadores `/sdd-continue` y `/sdd-ff` en full-flow. Fast-lane (`/new-quick-feature`, `/new-fix`) ya implementada. Modelo por fase ya se asigna en sub-agents (opus planning, sonnet implement/review, haiku archive — ver `README.md:174`).
- **Engram**: ya integrado como MCP (ver tools desplegables `mcp__plugin_engram_engram__*`).
- **Asunción explícita**: el interés es en patrones/ideas, no en adoptar gentle-ai como instalador (nuestro SDD es un boilerplate propio).

## Questions
1. ¿Qué features **Claude-específicas** trae v1.22–v1.23 y cuáles ya cubrimos?
2. ¿Qué GAPs reales tenemos que valga la pena cerrar?
3. ¿Qué NO vale la pena portar (contexto distinto)?

## Options to evaluate
- A. Portar "native sub-agents" (`~/.claude/agents/sdd-*.md`) además de skills
- B. Portar "managed slash commands" (`~/.claude/commands/*.md`)
- C. Adoptar output-styles de Claude Code
- D. Adoptar "judgment-day" (dual adversarial judge paralelo)
- E. Reforzar tool-scopes por fase (allowlists granulares vs wildcards)
- F. Read-merge-write en memoria entre batches de `implement-task`

## Evaluation criteria
Complejidad de adopción · Impacto en UX · Duplicación con flujo actual · Vendor lock-in · Encaje en boilerplate (no-binario)

## Findings

### Resumen Claude-relevante por release

| Release | Claude-specific | Nota |
|---|---|---|
| v1.23.0 | Native sub-agents `~/.claude/agents/sdd-{phase}.md` · modelo por fase en frontmatter · tool-scopes por fase · MCP Engram scope explícito | La gran release Claude |
| v1.22.0 | Managed slash commands `~/.claude/commands` · prompt más corto por default · persona fixes | Útil |
| v1.21.0 | Kimi / OpenCode sync · docs Qwen | No-Claude |
| v1.20.x | Kiro IDE · uninstall granular · Windows fixes | No-Claude |
| v1.19.x | Qwen / Kilo · upgrade reporting | No-Claude |
| v1.18.3 | Strict TDD gate inyectado a sub-agents · **read-merge-write en apply-progress** entre batches | Aplicable |

### Comparación con nuestro SDD

| Patrón gentle-ai | Nuestro SDD hoy | Gap |
|---|---|---|
| Native sub-agents por fase (`agents/sdd-*.md`) | Skills en `.claude/skills/<phase>/SKILL.md` invocadas vía Task | **Solapa.** Claude Code trata skills como sub-agents al ser invocadas; el patrón de gentle-ai es equivalente con otro layout. Sin gap real. |
| Modelo por fase en frontmatter del sub-agent | Orquestadores pasan `model` al lanzar sub-agents (README L174) | **Sin gap**, método distinto pero mismo efecto. |
| Slash commands gestionados (`~/.claude/commands`) | Nuestros skills SON invocables como `/plan-feature`, etc. | **Sin gap.** |
| Tool-scopes granulares por fase (allowlist, no wildcards) | No verificado; CLAUDE.md + rules controlan comportamiento, no permisos duros | **GAP real.** `fewer-permission-prompts` skill existe pero no está aplicado explícitamente por fase. |
| Engram MCP tools declarados explícitamente por fase | Engram disponible globalmente | **GAP menor.** Declarar qué tools Engram usa cada fase reduce ruido y guía al modelo. |
| Read-merge-write de progreso en batches (v1.18.3) | `implement-task` corre tarea por tarea; estado en specs files | Revisar si hay caso real donde perdamos progreso entre invocaciones. **Probable no-gap** en nuestro modelo file-based. |
| Strict TDD inyectado a sub-agents (no self-discovery) | No hay modo Strict TDD explícito | **GAP conceptual**, bajo-medio valor. Ya tenemos `.claude/rules/testing.md`. |
| judgment-day (dual adversarial judge paralelo) | `review-feature` hace 3-agent voting + 1 adversarial (README L193) | **Sin gap**, ya más rico. |
| Prompt más corto / menos ritual (v1.22) | Nuestros skills son directos pero revisables | **Posible mejora continua**, no accionable como feature. |
| Managed uninstall + backups | `sdd update`, `sdd doctor` | **Sin gap** para nuestro scope. |
| Skill registry auto-descubrimiento | `build-registry` existe | **Sin gap.** |

### Lo que NO vale portar
- Instalador Go binario, homebrew, TUI — gentle-ai es un producto, nosotros somos boilerplate.
- Multi-agent (OpenCode, Kiro, Gemini, Windsurf, Antigravity, etc.) — equipo usa solo Claude Code.
- Persona Gentleman / Rioplatense — fuera de scope.
- OpenCode SDD profiles — no aplica a Claude.

## Recommendation

**Adoptar 2 mejoras puntuales. Descartar el resto.**

### 1. Tool-scopes explícitos por fase (alto ROI)
En cada `SKILL.md` declarar en el frontmatter (o en `.claude/settings.json`) el allowlist mínimo:
- `research-spike`: `Read, WebFetch, WebSearch, Bash(gh:*), mem_*` (sin Edit/Write de código)
- `plan-feature`: `Read, Write(specs/**), Edit(specs/**), mem_*` (no Bash destructivo)
- `implement-task`: amplio, con allowlist de Bash verificado
- `review-feature`: `Read, mem_*` (read-only)
- `archive-feature`: `Read, Write(specs/archive/**), Bash(git:*)`

Esto ya hay infra (`fewer-permission-prompts` skill). Solo falta aplicarlo fase-por-fase. **Próximo paso**: `/new-quick-feature "tool-scopes por fase SDD"`.

### 2. Declarar MCP Engram tools por fase (bajo costo)
En cada skill, añadir una sección "Engram tools usadas" con los exactos (`mem_search`, `mem_save`, etc.). Reduce ruido y alinea comportamiento entre sub-agents. Se puede hacer junto con (1).

### Descartar
- Native sub-agents en `~/.claude/agents/` — duplica nuestra estructura de skills sin beneficio.
- Managed slash commands — ya los tenemos.
- Strict TDD mode — puede venir más tarde si aparece dolor real.
- Read-merge-write batches — nuestro modelo file-based no sufre este bug.

### Next
`/new-quick-feature "tool-scopes + engram-tools por fase SDD"` — fast-lane porque es single-domain (`.claude/skills/*/SKILL.md` + `settings.json`), sin deps nuevas, ≤2 GWT.

### Riesgos remanentes
- Si más adelante el equipo migra a OpenCode/Cursor, re-evaluar gentle-ai como instalador de verdad.
- v1.24+ podría traer algo nuevo Claude-relevante; vale seguir el repo en background.
