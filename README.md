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
sdd update   # Re-sincroniza skills, templates, memory, CLAUDE.md y agents; prune orphans
```

## Workflow

El camino feliz es deliberadamente corto:

```
/sdd-new "idea"   # decide fix/quick/full y crea el artefacto correcto
/sdd-next NNN     # corre la proxima fase
/sdd-next NNN     # repetir hasta archive
```

El resto de los comandos existe para control fino, debugging o power users.

Un feature en SDD tiene **tres dimensiones**: por dónde entrás, qué artefacto escribís, y cómo avanzás las fases.

### Entry point principal

| Entry | Cuándo | Artefacto inicial |
|---|---|---|
| `/sdd-new "idea"` | Siempre por default. Decide fix vs quick vs full. | `quick-spec.md` para fix/quick, o `clarify.md` + `spec.md` para full |

### Lanes internas

| Lane | Cuándo | Artefacto inicial |
|---|---|---|
| `fix` | Bug chico con Current/Expected/Unchanged claro | `quick-spec.md` (variante fix) |
| `quick` | Enhancement/refactor chico: single-domain, sin deps nuevas, ≤2 GWT | `quick-spec.md` (combinado spec+plan+tasks) |
| `full` | Feature grande, multi-domain, deps nuevas, alta incertidumbre, varias GWT | `clarify.md` + `spec.md` (+ después `plan.md` + `tasks.md`; ADRs en `docs/adr/` si aplica) |

La lane `full` corre una **entrevista técnica estilo grill-me**: una pregunta por turno, cada pregunta con recomendación concreta, y anclada en código real cuando el codebase puede responder. Produce `clarify.md` con respuestas literales y formaliza en `spec.md`. Los bloques estructurados (Given/When/Then, rollback, success metric) los redacta el agente y el usuario los valida.

`/sdd-new` usa una **fast-lane confidence gate**: bug existente → candidato `fix`; cambio chico → candidato `quick`; pero solo queda fast-lane si es single-domain, sin deps, ≤2 GWT y sin risk trigger. Schema/data migration, auth/permissions, billing/payments, public API/integration contracts, background jobs, concurrency, security/privacy, perf-critical paths, rollback-hard behavior o scope incierto → `full`. Si una fast-lane no califica, escala a full sin pedirte correr otro comando.

En full-flow, `new-feature` puede marcar `PROTOTYPE-REQUIRED` cuando hay una pregunta empírica barata de UI/state/business logic. En ese caso el `Next` pasa a ser `/prototype "NNN-feature: pregunta"` y `/plan-feature` bloquea hasta que `decisions.md` tenga `PROTOTYPE-RESULT` o `PROTOTYPE-DISMISSED`.

### Avanzar las fases: automático vs manual

Después del entry, full-flow pasa por `plan-feature` → `implement-task` (loop) → `simplify-code` → `review-feature` → `archive-feature`. Fast-lane saltea `plan-feature` porque `quick-spec.md` ya incluye plan + tasks. Podés avanzar de dos formas:

**Automático**:
```
/sdd-next         ← detecta en qué fase estás y lanza la próxima
/sdd-auto               ← fast-forward, encadena todas las fases restantes
```
El orchestrator maneja retries (2 por fase), validaciones post-fase, y pausa solo en checkpoints reales (ambigüedades en spec, discovery findings, JUDGMENT-DAY-HIGH del judge, ESCALATED).
Si se desbloquea una task `[HITL]`, corrés `/sdd-hitl NNN T003 "decision"` para registrar la decisión y destrabar el próximo `/sdd-next`.

El judge no bloquea por gustos o checklist genérico: `JUDGMENT-DAY-HIGH` requiere un finding high que sea scoped, plausible y actionable. Medium/low se registra como warning y el flujo puede seguir.

**Manual** (full-flow o fast-lane):
```
/plan-feature NNN-name         ← solo full-flow (fast-lane no tiene esta fase)
/implement-task NNN-name
/simplify-code NNN-name
/review-feature NNN-name
/archive-feature NNN-name
```
Cada envelope de cada fase incluye un campo `Next` que te dice qué invocar. `/sdd-next` y `/sdd-auto` soportan full-flow y fast-lane; en fast-lane simplemente saltean `/plan-feature` porque `quick-spec.md` ya contiene plan + tasks.

Las tareas son **vertical slices** estilo tracer bullet, no tareas horizontales por capa. Cada tarea tiene ID estable, tipo `[AFK]` o `[HITL]`, dependencias `blocked_by`, acceptance `verifies`, y `touches`. `/implement-task` ejecuta una sola slice AFK desbloqueada por invocación; `/sdd-next` y `/sdd-auto` relanzan la siguiente slice con contexto limpio. Las `[HITL]` se resuelven con `/sdd-hitl`, que escribe `decisions.md` y marca la task.

### Herramienta transversal: research-spike

```
/research-spike "topic"   →  research/R-NNN-topic/research.md
```
Standalone, no pertenece a ninguna feature. Corré esto cuando hay incertidumbre técnica (lib, arquitectura, patrón) antes o durante el entry — después usás las findings al escribir el spec.

### Resumen visual

```
/sdd-new ─┬─ fix/quick ──quick-spec.md──────────────┐
          │                                          ├─ /sdd-next → /implement-task → /simplify-code → /review-feature → /archive-feature
          └─ full ──────clarify.md + spec.md────────┘
                              ├─ optional /prototype if PROTOTYPE-REQUIRED
                              └─ /sdd-next → /plan-feature → /implement-task → /simplify-code → /review-feature → /archive-feature

/research-spike  (ad-hoc, transversal)
```

### Skills

| Skill | Qué hace |
|---|---|
| `/init-project` | Escanea el codebase, genera architecture-map y conventions |
| `/sdd-new "idea"` | Entry point universal: decide fix/quick/full y corre el intake correcto |
| `/sdd-next [NNN]` | Detecta la fase actual y corre la próxima |
| `/sdd-auto [NNN]` | Fast-forward: encadena todas las fases restantes |
| `/sdd-hitl [NNN] [Tnnn] ["decision"]` | Lista o resuelve checkpoints humanos `[HITL]` |
| `/new-feature "idea"` | Control explícito: full-spec grill-style → `clarify.md` + `spec.md` |
| `/new-quick-feature "idea"` | Control explícito: fast-lane enhancement/refactor → quick-spec.md |
| `/new-fix "bug"` | Control explícito: fast-lane bugfix (C/E/U) → quick-spec.md |
| `/plan-feature NNN-name` | spec.md → plan.md + tasks.md (con discovery checkpoint) |
| `/implement-task NNN-name` | Ejecuta la próxima tarea con test-first gate + self-review pre-cierre + validación con output real; acepta Review-Feedback para fix cycles |
| `/simplify-code NNN-name` | Aplica KISS/DRY/YAGNI al diff; revierte si rompe tests |
| `/research-spike "topic"` | Investiga incertidumbre técnica en paralelo |
| `/review-feature NNN-name` | Reviewer + judge adversarial review |
| `/archive-feature NNN-name` | Merge deltas al spec + mueve a `specs/archive/` |
| `/build-registry` | Compila skills de proyecto en compact rules |
| `/tdd` | Red-green-refactor vertical por comportamiento y public interfaces |
| `/grill-me` | Entrevista de diseño/plan: una pregunta por vez con recomendación |
| `/prototype` | Prototipo throwaway para validar UI, state machine o modelo; si es feature-bound escribe `PROTOTYPE-RESULT` en `decisions.md` |

### Cuándo usar cada combinación

| Situación | Entry | Modo |
|---|---|---|
| No estás seguro si una lib/patrón sirve | `/research-spike` | — (standalone) |
| No sabés qué lane corresponde | `/sdd-new` | Automático (`/sdd-next` o `/sdd-auto`) |
| Feature grande, querés checkpoints entre fases | `/sdd-new` | Manual (invocar cada fase) |
| Se desbloqueó una task `[HITL]` | `/sdd-hitl NNN Tnnn "decision"` | Desbloqueo puntual, después `/sdd-next` |
| UI/state/business logic incierto antes de planear | `/prototype "NNN-feature: pregunta"` | Standalone o prerequisito marcado por `new-feature` |
| Querés forzar full-spec | `/new-feature` | Automático o manual |
| Querés forzar fast-lane enhancement/refactor | `/new-quick-feature` | Automático o manual |
| Querés forzar fast-lane bugfix | `/new-fix` | Automático o manual |

## Principios

La constitución vive en `.specify/memory/constitution.md` (8 principios). Los más operacionales:

1. **Specs drive changes** — todo cambio material arranca de una spec o research recommendation.
2. **Research before architecture when uncertainty is high** — abrí `/research-spike` antes de comprometer arquitectura.
3. **Plans must be executable** — el plan menciona módulos, contratos, data, migración, observabilidad y estrategia de testing.
4. **Tasks are vertical slices** — cada task debe ser AFK/HITL, tener dependencias explícitas y validar un comportamiento end-to-end cuando aplica.
5. **Decisions must remain traceable** — divergencias van a `decisions.md` o ADR.
6. **Done means verified** — sin acceptance checkeado y validación registrada, no está hecho.
7. **Test-first cuando aplica** — si el cambio tiene comportamiento testeable, el test va antes que el código (`/implement-task` lo enforce con un test-first gate).
8. **Evidence over claims** — done significa salida real de comandos pegada (`===== 4 passed =====`), no afirmaciones sobre cómo debería funcionar.

## Estructura

```
.claude/
  CLAUDE.md                    # Reglas operativas para Claude
  rules/                       # Convenciones del proyecto (se llenan con /init-project)
    conventions.md
    testing.md
    git.md
    model-overrides.md         # Overrides de model routing por proyecto
  skills/                      # Skills de Claude Code (routers de slash commands)
    _shared/                   # Protocolo común + lane resolution (§I)
    init-project/              # Inicialización automática
    sdd-new/                   # Entry point universal (fix/quick/full)
    sdd-next/                  # Orchestrator: detecta y corre próxima fase
    sdd-auto/                  # Orchestrator: fast-forward
    sdd-hitl/                  # Resolver checkpoints humanos [HITL]
    new-feature/               # Full-flow: grill-style technical interview
    new-quick-feature/         # Fast-lane: enhancement/refactor
    new-fix/                   # Fast-lane: bugfix (C/E/U)
    plan-feature/              # Spec → plan + tasks
    implement-task/            # Ejecutar tarea (test-first + self-review)
    simplify-code/             # KISS/DRY/YAGNI post-implement
    research-spike/            # Investigar incertidumbre
    review-feature/            # Reviewer + judge adversarial review
    archive-feature/           # Cerrar y archivar feature
    architecture-map/          # Mapa de arquitectura (auto-generado)
    build-registry/            # Compila skills de proyecto en compact rules
    feature-spec/              # Doc-mirror del flow Pocock (no invocable; ref para humanos)
    diagnose-bug/              # Skill discoverable: el modelo la invoca al toparse con bugs duros
    tdd/                       # Red-green-refactor vertical por comportamiento
    grill-me/                  # Entrevista agresiva de planes/disenos
    prototype/                 # Prototipos throwaway para decidir rapido
.specify/
  memory/
    constitution.md            # 8 principios del repo
  templates/                   # spec-template, plan-template, tasks-template,
                               # quick-spec-template, fix-spec-template, research-template
  scripts/                     # Scripts helper
specs/                         # Features en curso
  NNN-name/
    clarify.md                 # Q&A crudas (full-flow, salida de /new-feature)
    spec.md                    # Spec formalizado (full-flow)
    plan.md, tasks.md          # Después de /plan-feature
    decisions.md               # Deltas y test-skip rationale
    quick-spec.md              # Fast-lane (en lugar de spec/plan/tasks)
  archive/                     # Features cerradas (YYYY-MM-DD-NNN-name/)
research/                      # Research spikes
docs/adr/                      # Architecture Decision Records (creados por /new-feature in-the-moment)
docs/architecture/             # Documentación de arquitectura
```

## Uso de agentes

El patrón correcto es **orquestador inline + sub-agents leaf**.

SDD usa native sub-agents de Claude Code solo para fases leaf no conversacionales. Hoy hay 10 agents:

- 4 públicos: `research-spike`, `implement-task`, `simplify-code`, `archive-feature`.
- 6 internos: `explore-agent`, `discovery-evaluator`, `designer`, `task-planner`, `reviewer`, `judge`.

`sdd-new`, `new-feature`, `new-quick-feature`, `new-fix`, `plan-feature` y `review-feature` corren inline en el `SKILL.md`: los intakes necesitan diálogo multi-turn con el usuario, `sdd-new` decide lane, y `plan-feature`/`review-feature` necesitan lanzar sub-agents. Claude Code quita `Agent` a sub-agents spawneados, por eso esos orquestadores no pueden ser agents nativos.

**Modelo por fase**: los agents leaf declaran `model:` en `.claude/agents/sdd-<phase>.md`. Las fases inline (`sdd-new`, intakes, `plan-feature`, `review-feature`) corren en el contexto principal y el model routing vive en `.claude/CLAUDE.md` / `.claude/rules/model-overrides.md`.

**Contexto aislado**: las fases leaf corren en context window separado del padre, por lo que no contaminan la conversación principal. Las fases inline hacen conversación/coordinación; cuando hay trabajo pesado, lanzan workers y reciben solo envelopes.

**Orchestrators** (`/sdd-next` para paso a paso, `/sdd-auto` para auto-chain): detectan si la fase tiene `.claude/agents/sdd-<phase>.md`. Si existe, lanzan el agent leaf. Si no existe, ejecutan el `SKILL.md` inline.

## Engram

Engram se usa como memoria auxiliar, no como source of truth. La prioridad es: mensaje actual del usuario → state files del repo → código actual → memoria.

- Se consulta al inicio de cada fase con `sdd/{feature-id}` y 2-4 keywords del dominio.
- Sirve para mejores preguntas, gotchas y patrones reutilizables; no puede saltar gates, rellenar `clarify.md` ni contradecir la spec.
- Se guarda solo conocimiento durable: tradeoffs, decisiones humanas, gotchas, patrones cross-feature, blockers y verdicts útiles para recuperación.
- No se guardan secretos, PII, URLs privadas, specs copiadas, logs crudos, listas de archivos ni detalles de manejo de sesión.

## Adopción progresiva

1. **Día 1**: `sdd init` + `/init-project`. Ya podés usar `/sdd-new` y `/research-spike`. `.claude/CLAUDE.md` queda como symlink a SDD_HOME — los updates propagan vía `git pull` sin acción tuya.
2. **Proyecto pre-symlink**: si ya tenías SDD instalado antes de esta migración, `sdd update` convierte `.claude/CLAUDE.md` de copy a symlink (con backup a `.claude/CLAUDE.md.backup`). Si editaste el CLAUDE.md con overrides custom, muévelos a `.claude/rules/model-overrides.md` (auto-cargado por Claude Code). Ambos archivos se agregan automáticamente a `.gitignore` — los symlinks absolutos no portan entre máquinas.
3. **Con código**: Revisar y ajustar los archivos en `.claude/rules/` a medida que el proyecto define convenciones.
4. **Primer cambio chico**: Probá `/sdd-new "<bug o mejora>"`. El entry gate decide fix/quick/full y escala si no califica.
5. **Con arquitectura**: Correr `/init-project` de nuevo si la arquitectura cambió significativamente.
6. **Con skills de stack** (React, Python, etc.): Instalar en `.claude/skills/`, correr `/build-registry` para compilar compact rules que se inyectan automáticamente en sub-agents.
