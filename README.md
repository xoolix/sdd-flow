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

```
idea → /new-feature → refine spec → /plan-feature → /implement-task (repeat) → /review-feature
                                  ↘ /research-spike (si hay incertidumbre)
```

| Skill | Qué hace |
|---|---|
| `/init-project` | Escanea el codebase, genera architecture-map y conventions |
| `/new-feature "idea"` | Crea un spec conversacionalmente |
| `/plan-feature NNN-name` | Genera plan técnico + lista de tareas |
| `/implement-task NNN-name` | Ejecuta la próxima tarea pendiente |
| `/research-spike "topic"` | Investiga incertidumbre técnica |
| `/review-feature NNN-name` | Verifica implementación vs spec |

## Estructura

```
.claude/
  CLAUDE.md                    # Reglas operativas para Claude
  rules/                       # Convenciones del proyecto (se llenan con /init-project)
    conventions.md
    testing.md
    git.md
  skills/                      # Skills de Claude Code
    init-project/              # Inicialización automática
    new-feature/               # Crear spec desde idea
    plan-feature/              # Spec → plan + tasks
    implement-task/            # Ejecutar tarea
    research-spike/            # Investigar incertidumbre
    review-feature/            # Review vs spec
    architecture-map/          # Mapa de arquitectura (auto-generado)
.specify/
  templates/                   # Templates para specs, plans, tasks, research
  scripts/                     # Scripts helper
specs/                         # Feature specs, plans, tasks, decisions
research/                      # Research spikes
docs/adr/                      # Architecture Decision Records
docs/architecture/             # Documentación de arquitectura
```

## Uso de agentes

Los skills usan agentes de Claude Code automáticamente:

- **`/plan-feature`** y **`/review-feature`**: Lanzan Explore agents para analizar el codebase en paralelo
- **`/research-spike`**: Lanza agentes en paralelo para investigar múltiples opciones simultáneamente
- **`/implement-task`**: Corre validaciones (lint, typecheck, tests) en paralelo

## Adopción progresiva

1. **Día 1**: `sdd init` + `/init-project`. Ya podés usar `/new-feature` y `/research-spike`.
2. **Con código**: Revisar y ajustar los archivos en `.claude/rules/` a medida que el proyecto define convenciones.
3. **Con arquitectura**: Correr `/init-project` de nuevo si la arquitectura cambió significativamente.
