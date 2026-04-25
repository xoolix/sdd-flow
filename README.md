# SDD — Spec Driven Development

Boilerplate para trabajar con Claude Code usando un flujo de spec-driven development.

## Quick start

### Instalar el CLI

```bash
# Opción 1: Symlink global
ln -s /path/to/test-sdd/bin/sdd /usr/local/bin/sdd

# Opción 2: Agregar al PATH
export PATH="/path/to/test-sdd/bin:$PATH"
```

### Inicializar un proyecto

```bash
cd tu-proyecto
sdd init          # Symlinks skills/templates (se actualizan con el repo SDD)
sdd init --copy   # Copia todo (standalone, sin auto-updates)
```

Después, abrir Claude Code y correr:
```
/init-project
```

Esto escanea el codebase y auto-genera:
- Architecture map (`.claude/skills/architecture-map/SKILL.md`)
- Conventions (`.claude/rules/conventions.md`)
- Testing config (`.claude/rules/testing.md`)
- Git conventions (`.claude/rules/git.md`)

### Verificar setup

```bash
sdd doctor   # Verifica que todo esté en orden
sdd update   # Re-sincroniza skills/templates después de un pull
```

## Workflow

Un feature en SDD tiene **tres dimensiones**: por dónde entrás, qué artefacto escribís, y cómo avanzás las fases.

### Entry points (3)

| Entry | Cuándo | Artefacto inicial |
|---|---|---|
| `/new-feature "idea"` | Feature grande, multi-domain, varias GWT | `spec.md` (+ después `plan.md` + `tasks.md`) |
| `/new-quick-feature "idea"` | Enhancement/refactor chico: single-domain, sin deps nuevas, ≤2 GWT | `quick-spec.md` (combinado spec+plan+tasks) |
| `/new-fix "bug"` | Bugfix chico con formato Kiro Current/Expected/Unchanged | `quick-spec.md` (variante fix) |

Los dos fast-lane corren un **entry gate** de 3 preguntas antes del intake; si no califica, te redirige a `/new-feature`.

### Avanzar las fases: automático vs manual

Después del entry hay 5 fases: `plan-feature` → `implement-task` (loop) → `simplify-code` → `review-feature` → `archive-feature`. Podés correrlas de dos formas:

**Automático** (solo full-flow):
```
/sdd-next         ← detecta en qué fase estás y lanza la próxima
/sdd-auto               ← fast-forward, encadena todas las fases restantes
```
El orchestrator maneja retries (2 por fase), validaciones post-fase, y pausa solo en checkpoints reales (ambigüedades en spec, discovery findings, SPEC-GAP-HIGH del adversarial, ESCALATED).

**Manual** (full-flow o fast-lane):
```
/plan-feature NNN-name         ← solo full-flow (fast-lane no tiene esta fase)
/implement-task NNN-name
/simplify-code NNN-name
/review-feature NNN-name
/archive-feature NNN-name
```
Cada envelope de cada fase incluye un campo `Next` que te dice qué invocar. `/sdd-next` y `/sdd-auto` **NO soportan fast-lane** — si tu feature tiene `quick-spec.md`, solo podés avanzar manual.

### Herramienta transversal: research-spike

```
/research-spike "topic"   →  research/R-NNN-topic/research.md
```
Standalone, no pertenece a ninguna feature. Corré esto cuando hay incertidumbre técnica (lib, arquitectura, patrón) antes o durante el entry — después usás las findings al escribir el spec.

### Resumen visual

```
                       ┌─ /sdd-next  (auto, solo full-flow)
/new-feature ──spec.md ┤
                       └─ /plan-feature → /implement-task → /simplify-code → /review-feature → /archive-feature  (manual)

/new-quick-feature ┐
                   ├── quick-spec.md ── /implement-task → /simplify-code → /review-feature → /archive-feature  (solo manual)
/new-fix ──────────┘

/research-spike  (ad-hoc, transversal)
```

### Skills

| Skill | Qué hace |
|---|---|
| `/init-project` | Escanea el codebase, genera architecture-map y conventions |
| `/sdd-new "idea"` | Entry point full-flow (delega a `/new-feature`) |
| `/sdd-next [NNN]` | Detecta la fase actual y corre la próxima |
| `/sdd-auto [NNN]` | Fast-forward: encadena todas las fases restantes |
| `/new-feature "idea"` | Crea spec.md conversacionalmente (full-flow) |
| `/new-quick-feature "idea"` | Fast-lane: enhancement/refactor → quick-spec.md |
| `/new-fix "bug"` | Fast-lane: bugfix (C/E/U) → quick-spec.md |
| `/plan-feature NNN-name` | spec.md → plan.md + tasks.md (con discovery checkpoint) |
| `/implement-task NNN-name` | Ejecuta la próxima tarea; acepta Review-Feedback para fix cycles |
| `/simplify-code NNN-name` | Aplica KISS/DRY/YAGNI al diff; revierte si rompe tests |
| `/research-spike "topic"` | Investiga incertidumbre técnica en paralelo |
| `/review-feature NNN-name` | 3-agent voting + adversarial spec review |
| `/archive-feature NNN-name` | Merge deltas al spec + mueve a `specs/archive/` |
| `/build-registry` | Compila skills de proyecto en compact rules |

### Cuándo usar cada combinación

| Situación | Entry | Modo |
|---|---|---|
| No estás seguro si una lib/patrón sirve | `/research-spike` | — (standalone) |
| Feature grande, querés que Claude maneje todo | `/new-feature` | Automático (`/sdd-next` o `/sdd-auto`) |
| Feature grande, querés checkpoints entre fases | `/new-feature` | Manual (invocar cada fase) |
| Cambio chico single-domain, sin deps nuevas, ≤2 GWT | `/new-quick-feature` | Manual (único modo) |
| Bug chico con Current/Expected/Unchanged claros | `/new-fix` | Manual (único modo) |
| Cambio chico pero tocás 2+ dominios o agregás dep | `/new-feature` | El entry gate del fast-lane te redirige automáticamente |

## Estructura

```
.claude/
  CLAUDE.md                    # Reglas operativas para Claude
  rules/                       # Convenciones del proyecto (se llenan con /init-project)
    conventions.md
    testing.md
    git.md
  skills/                      # Skills de Claude Code
    _shared/                   # Protocolo común + lane resolution (§I)
    init-project/              # Inicialización automática
    sdd-new/                   # Entry point full-flow
    sdd-next/              # Orchestrator: detecta y corre próxima fase
    sdd-auto/                    # Orchestrator: fast-forward
    new-feature/               # Full-flow: crear spec desde idea
    new-quick-feature/         # Fast-lane: enhancement/refactor
    new-fix/                   # Fast-lane: bugfix (C/E/U)
    plan-feature/              # Spec → plan + tasks
    implement-task/            # Ejecutar tarea (+ review-fix cycle)
    simplify-code/             # KISS/DRY/YAGNI post-implement
    research-spike/            # Investigar incertidumbre
    review-feature/            # 3-agent voting + adversarial
    archive-feature/           # Cerrar y archivar feature
    architecture-map/          # Mapa de arquitectura (auto-generado)
    build-registry/            # Compila skills de proyecto en compact rules
.specify/
  templates/                   # spec-template, plan-template, tasks-template,
                               # quick-spec-template, fix-spec-template, research-template
  scripts/                     # Scripts helper
specs/                         # Features en curso (spec/plan/tasks O quick-spec + decisions)
  archive/                     # Features cerradas (YYYY-MM-DD-NNN-name/)
research/                      # Research spikes
docs/adr/                      # Architecture Decision Records
docs/architecture/             # Documentación de arquitectura
```

## Uso de agentes

Desde la feature 008, SDD usa **native sub-agents** de Claude Code. Cada fase (9 públicas + 6 internas = 15 archivos) vive en `.claude/agents/sdd-*.md` con frontmatter que declara `model`, `disallowedTools`, `context`, y `mcpServers`. Los skills en `.claude/skills/*/SKILL.md` son routers finos (~10 líneas) que delegan al native agent cuando el user invoca `/plan-feature`, `/implement-task`, etc.

**Modelo por fase**: no hay tabla hardcoded — cada `.claude/agents/sdd-<phase>.md` declara su `model:` en frontmatter (fuente única de verdad). Para cambiar el modelo de una fase, editá solo ese archivo.

**Contexto aislado**: los agents corren en context window separado del padre, por lo que las fases no se contaminan entre sí. El user puede invocar directamente con `/phase <id>` (router delega al agent) o con `@agent-sdd-<phase> <id>` (mention directo).

**Orchestrators** (`/sdd-next` para paso a paso, `/sdd-auto` para auto-chain): lanzan cada fase vía Agent tool nativo apuntando al nombre del agent (`subagent_type: "sdd-<phase>"`). Fallback inline si el runtime no reconoce el agent (ej. instalación desactualizada).

## Adopción progresiva

1. **Día 1**: `sdd init` + `/init-project`. Ya podés usar `/new-feature` y `/research-spike`. `.claude/CLAUDE.md` queda como symlink a SDD_HOME — los updates propagan vía `git pull` sin acción tuya.
2. **Proyecto pre-symlink**: si ya tenías SDD instalado antes de esta migración, `sdd update` convierte `.claude/CLAUDE.md` de copy a symlink (con backup a `.claude/CLAUDE.md.backup`). Si editaste el CLAUDE.md con overrides custom, muévelos a `.claude/rules/model-overrides.md` (auto-cargado por Claude Code). Ambos archivos se agregan automáticamente a `.gitignore` — los symlinks absolutos no portan entre máquinas.
3. **Con código**: Revisar y ajustar los archivos en `.claude/rules/` a medida que el proyecto define convenciones.
4. **Primer cambio chico**: Probá el fast-lane con `/new-fix "<bug>"` o `/new-quick-feature "<mejora>"`. El entry gate te va a redirigir a `/new-feature` si el cambio no califica.
5. **Con arquitectura**: Correr `/init-project` de nuevo si la arquitectura cambió significativamente.
6. **Con skills de stack** (React, Python, etc.): Instalar en `.claude/skills/`, correr `/build-registry` para compilar compact rules que se inyectan automáticamente en sub-agents.
