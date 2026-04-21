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
/sdd-continue         ← detecta en qué fase estás y lanza la próxima
/sdd-ff               ← fast-forward, encadena todas las fases restantes
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
Cada envelope de cada fase incluye un campo `Next` que te dice qué invocar. `/sdd-continue` y `/sdd-ff` **NO soportan fast-lane** — si tu feature tiene `quick-spec.md`, solo podés avanzar manual.

### Herramienta transversal: research-spike

```
/research-spike "topic"   →  research/R-NNN-topic/research.md
```
Standalone, no pertenece a ninguna feature. Corré esto cuando hay incertidumbre técnica (lib, arquitectura, patrón) antes o durante el entry — después usás las findings al escribir el spec.

### Resumen visual

```
                       ┌─ /sdd-continue  (auto, solo full-flow)
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
| `/sdd-continue [NNN]` | Detecta la fase actual y corre la próxima |
| `/sdd-ff [NNN]` | Fast-forward: encadena todas las fases restantes |
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
| Feature grande, querés que Claude maneje todo | `/new-feature` | Automático (`/sdd-continue` o `/sdd-ff`) |
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
    sdd-continue/              # Orchestrator: detecta y corre próxima fase
    sdd-ff/                    # Orchestrator: fast-forward
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

Los skills usan agentes de Claude Code automáticamente:

- **`/plan-feature`**: Lanza Explore agents + discovery-evaluator para analizar el codebase en paralelo
- **`/review-feature`**: 3 agentes independientes votan el veredicto + 1 adversarial challenge al spec
- **`/research-spike`**: Agentes en paralelo para investigar múltiples opciones simultáneamente
- **`/implement-task`**: Corre validaciones (lint, typecheck, tests) en paralelo
- **Orchestrators** (`/sdd-continue`, `/sdd-ff`): lanzan las fases como sub-agents con el modelo apropiado (opus para planning, sonnet para implement/review, haiku para archive)

## Adopción progresiva

1. **Día 1**: `sdd init` + `/init-project`. Ya podés usar `/new-feature` y `/research-spike`.
2. **Con código**: Revisar y ajustar los archivos en `.claude/rules/` a medida que el proyecto define convenciones.
3. **Primer cambio chico**: Probá el fast-lane con `/new-fix "<bug>"` o `/new-quick-feature "<mejora>"`. El entry gate te va a redirigir a `/new-feature` si el cambio no califica.
4. **Con arquitectura**: Correr `/init-project` de nuevo si la arquitectura cambió significativamente.
5. **Con skills de stack** (React, Python, etc.): Instalar en `.claude/skills/`, correr `/build-registry` para compilar compact rules que se inyectan automáticamente en sub-agents.
