# Agent + skill router pattern — canonical shape

Referencia para los 13 native sub-agents de `.claude/agents/sdd-*.md` y los 9 skill routers de `.claude/skills/<phase>/SKILL.md`. Patrón validado en T3 pilot (2026-04-23) y alineado con gentle-ai v1.23. Pattern partially walked back in feature 015 for orchestrator phases — see D-001/D-003.

## Por qué dos archivos por fase

La topología es **asimétrica** tras feature 015:

- **Mayoría de fases** (research-spike, new-feature, new-quick-feature, new-fix, implement-task, simplify-code, archive-feature): el slash command → skill router (~10 líneas) → `Agent(subagent_type="sdd-<phase>")` → agent nativo corre aislado con su modelo. Así: `/archive-feature 008` → skill router → main Claude invoca el agent nativo.

- **Fases orquestadoras** (plan-feature, review-feature): el slash command → SKILL.md con la lógica completa de orquestación ejecutada **inline por main Claude** — no existe agent nativo para estas fases. Main Claude invoca los sub-agents internos directamente (sdd-explore-agent, sdd-reviewer-voter, etc.).

- **Skill** = router de ~10 líneas (fases leaf) **o** cuerpo completo de orquestación (fases orchestrator)
- **Agent** = executor con la lógica de la fase en su body + frontmatter declarando model/tools (solo para fases leaf e internos)

**Rationale de la asimetría**: Claude Code force-strips `Agent` tool de sub-agents spawneados → agents orquestadores no pueden delegar a sus propios sub-agents. Solución: los orquestadores viven en SKILL.md y corren en main Claude (que conserva `Agent`). Referencia: feature 015 + D-001/D-003.

## Agent shape

```markdown
---
name: sdd-<phase>
description: <one-line trigger hint>
model: <opus|sonnet|haiku>
disallowedTools: [Agent]
---

Feature-id: `$ARGUMENTS`

> **Executor boundary**: You are an EXECUTOR...

## Pre-flight checks
[... contenido completo migrado desde el SKILL.md original de la fase ...]
```

### Claves del agent

- **NO incluir `skills: [<phase>]`**: si el skill ahora es un router, el preload cargaría "Launch agent sdd-X..." y provocaría recursión. La lógica vive en el body del agent directamente.
- **`disallowedTools: [Agent]`** en los 13 native agents para impedir recursión. No hay excepciones — `sdd-plan-feature` y `sdd-review-feature` ya no existen como agents nativos (son SKILLs inline).
- **`$ARGUMENTS`** sigue funcionando: el orquestador (o el router skill) pasa el feature-id en el `prompt` del Agent tool call, y el body del agent lo resuelve por literal string substitution.

## Skill router shape

```markdown
---
name: <phase>
description: <same as original skill>
user-invocable: true
disable-model-invocation: true
arguments: feature-id
---

# <Phase> (router)

Launch native agent `sdd-<phase>` with `feature-id: $ARGUMENTS`.

If `.claude/agents/sdd-<phase>.md` is not present (agents directory not deployed), fall back to executing the full phase logic inline — see previous version of this SKILL.md in git history, or re-run `bin/sdd update` to deploy the agent layer.
```

### Claves del skill router

- **Preserva `name`, `description`, `user-invocable`, `arguments`** — la CLI sigue reconociendo el slash command `/phase`.
- **Body ~10 líneas**: directiva en prosa + fallback. Main Claude lee esto y, siguiendo la instrucción, invoca el agent.
- **No duplica lógica**: la lógica verdadera vive en `.claude/agents/sdd-<phase>.md`. El skill es únicamente el puente slash→agent.

## Field reference (agent frontmatter)

| Field | Obligatorio | Valores | Comentario |
|---|---|---|---|
| `name` | ✅ | kebab-case, único, prefix `sdd-` | Usado en `Agent(subagent_type="sdd-<name>")` |
| `description` | ✅ | ≤1024 chars | Una línea describiendo el trigger de la fase |
| `model` | ⭕ | `opus` \| `sonnet` \| `haiku` \| `inherit` | Default `inherit`. Ver mapping en plan 008 |
| `disallowedTools` | ⭕ | ej. `[Agent]` | Presente en todos los 13 native agents sin excepción |
| `mcpServers` | ⭕ | ej. `[engram]` | Default: hereda de `.claude/settings.json` |
| `context` | ⭕ | `fork` | Solo para `sdd-research-spike` (aislamiento fuerte) |

**Campos NO usar sin validar**: `effort`, `permissionMode`, `maxTurns`, `skills`, `initialPrompt`, `hooks` con placeholders. Estado en docs es indirecto o no soportado en runtime actual (v2.1.118+).

## Naming convention

**7 public native agents** (con skill router que delega via `Agent(subagent_type=...)`): `sdd-<phase>` donde phase = research-spike, new-feature, new-quick-feature, new-fix, implement-task, simplify-code, archive-feature. (`plan-feature` y `review-feature` son SKILLs inline — no tienen agent nativo.)

**6 internal native agents** (no skill router, spawneados por main Claude ejecutando plan-feature/SKILL.md o review-feature/SKILL.md): `sdd-explore-agent`, `sdd-discovery-evaluator`, `sdd-designer`, `sdd-task-planner`, `sdd-reviewer-voter`, `sdd-adversarial-reviewer`.

## Invocación desde orquestadores

Orquestadores (`/sdd-next`, `/sdd-auto`) y sub-agent spawns internos:
```
Agent(
  subagent_type="sdd-<phase>",
  prompt="Feature-id: <id>\n<shared rules>\n<project standards>",
  # model se toma del frontmatter del agent
)
```

No pasar `model=` desde el orquestador — el frontmatter del agent es la fuente de verdad (AC4).
