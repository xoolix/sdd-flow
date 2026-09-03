# Research Spike

## Metadata
- Research ID: R-007
- Topic: Adoptar OpenSpec (`Fission-AI/OpenSpec`) para la capa de artefactos de este SDD
- Owner: santi
- Status: complete
- Linked feature: 023-silent-degradation-fixes (clarify cortado por esta pregunta)
- Fuentes: `Fission-AI/OpenSpec` @ `main` (2026-08-28) — `README.md`, `docs/commands.md`, `docs/existing-projects.md`, `docs/opsx.md`, todas citas textuales vía `raw.githubusercontent.com`; `bin/sdd` (líneas citadas); `.claude/agents/sdd-designer.md`, `sdd-task-planner.md`, `sdd-judge.md`; `specs/archive/2026-08-25-021-project-aware-templates/spec.md`; `tests/sdd.test.js` corrido en vivo.
- Fecha corte: 2026-08-28

## Brief
Qué costaría adoptar OpenSpec para `spec.md`/`plan.md`/`tasks.md`/`decisions.md`, y si conviene — total, parcial, o solo la idea.

## Why now
Los judges de 021/022 marcaron que `/archive-feature` mergea deltas ADDED/MODIFIED/REMOVED solo a `spec.md`, nunca a `plan.md`. Al rastrear el origen de ese vocabulario apareció OpenSpec — pero solo se copió el vocabulario, no la capa de spec viva (`openspec/specs/`) que le da sentido. 023 no puede fijar scope sin resolver esto primero.

## Context gathered
- Este repo tomó el vocabulario de deltas sin la capa viva: no hay equivalente de `openspec/specs/`, los deltas mueren en el `spec.md` que `/archive-feature` está por congelar.
- `research/R-004-...` ya fijó postura sobre gentle-ai: *"el interés es en patrones/ideas, no en adoptar [...] como instalador (nuestro SDD es un boilerplate propio)"*.

## Questions
1. ¿Qué hace `/opsx:onboard` contra un repo brownfield, en fuente primaria?
2. ¿Qué sobrevive de `bin/sdd`?
3. ¿El scope angosto de OpenSpec cambia la postura de R-004 sobre "el código manda"?
4. ¿Qué tiene este repo que OpenSpec no?
5. ¿`sdd-designer`+`sdd-task-planner` solapan con `/opsx:propose`?
6. Costo de migración concreto.
7. Qué no pude verificar.

## Findings

### 1. `/opsx:onboard` en brownfield — no hace backfill
`docs/existing-projects.md`: *"You do not document your whole codebase to start [...] `openspec/specs/` [...] starts nearly empty and accumulates. Each archived change merges its delta in."* Y explícito contra backfill: *"Resist the urge to back-fill everything [...] those specs go stale."*

`/opsx:onboard` (perfil expandido) no genera specs en masa: `docs/commands.md` lo describe escaneando el código para elegir **una** mejora chica y correr propose→apply→archive sobre ella, narrando cada paso — un tutorial de un cambio, no un extractor de comportamiento actual.

**Verificado, alta confianza**: `openspec/specs/` arrancaría vacío pese a los 24 features ya construidos — nada migra ese conocimiento en bloque. Los archivados son historial de decisiones, no comportamiento navegable por dominio; OpenSpec no lo resuelve ni pretende resolverlo.

### 2. Qué sobrevive de `bin/sdd` — parcial, no entero

| Función | Acoplamiento al layout | Veredicto |
|---|---|---|
| `resolve_feature_dir` | Solo resuelve una ruta, agnóstica del contenido | Swap de raíz trivial |
| `.parent-branch`, `.simplified`, `.pr-opened` | Un archivo dentro de `$feature_dir`, agnóstico del resto | Sobreviven sin tocar |
| `extract_section` | Mecanismo puro (`awk` por heading) | Sobrevive; el fix de fences de 023 es portable |
| `cmd_commit_slice` (`git add -- "$feature_dir"`) | Asume TODO el feature en una sola carpeta | **Rompe.** El sync de OpenSpec escribe en `openspec/specs/<dominio>/`, fuera de `changes/<name>/` |
| `build_pr_title` | H1 `# Feature: <título>` | **Reescritura.** OpenSpec usa `# Proposal: <título>` |
| `build_pr_body_file` | Headings exactos `Summary`/`Acceptance Criteria`/`Rollback Plan` | **Reescritura.** `proposal.md` trae `Intent`/`Scope`/`Approach` — sin equivalente de Rollback Plan |
| `detect_feature_phase` (+ `cmd_status`) | Vocabulario de fases completo de ESTE pipeline (`ready-to-simplify`, `ready-to-review`...) | **Reescritura real**, no shim — no tiene análogo en OpenSpec |

La capa de *mecanismo git* (branch, push, `gh pr create`, sentinels) sobrevive casi entera porque no le importa el contenido interno. Pero `detect_feature_phase`, `build_pr_title/body_file` y el supuesto de "un feature = una carpeta" de `commit_slice` sí necesitan trabajo real.

### 3. La dependencia — no cambia la postura de R-004
OpenSpec no automatiza git: único mention es *"Commit `openspec/` to git"* (práctica, no comando). Eso reduce la fricción con ADR 0002, pero no resuelve que OpenSpec seguiría siendo dueño de nombres de archivo y headings que `bin/sdd` necesita parsear — la misma tensión de R-004 con gentle-ai, en un paquete más chico. **Se sostiene: robar el patrón, no el paquete.**

Corrección a un hecho asumido: OpenSpec **sí** toca tests. `docs/commands.md` sobre `/opsx:apply`: *"Writes code, creates files, runs tests as needed."* Lo que no toca es git/commits/PRs — eso sí es correcto.

### 4. Lo que este repo tiene y OpenSpec no

| Este repo | Análogo en OpenSpec |
|---|---|
| Reviewer + judge (severidad) + cross-reviewer (modelo opuesto) | `/opsx:verify`: un pase, mismo asistente, *"does not block archive"* |
| `/simplify-code` + revert-on-regresión | `/opsx:update` edita planning, *"never edits code"* |
| Reintentos (máx. 2) + `ESCALATED` | Nada documentado |
| Tareas `[HITL]` con decisión registrada | `/opsx:update` confirma edits, sin registro de decisión de dominio |
| Discovery checkpoint (impacto alto/medio/bajo + gate humano) | `/opsx:explore`: charla libre, sin clasificación ni artefacto |
| Modelo por fase (opus/sonnet/haiku) | Mismo asistente para todo |
| `domain-vocab` (`conventions.md`) | `openspec/config.yaml`'s `context:` — mismo patrón, otro archivo |

### 5. `sdd-designer`/`sdd-task-planner` vs `/opsx:propose` — solapamiento confirmado
`sdd-designer` + `sdd-task-planner`: spec + exploration findings → `plan.md` + `tasks.md`, dos agentes (opus/sonnet). `/opsx:propose`: *"Generates artifacts needed before implementation (proposal, specs, design, tasks)"* — un flujo, grafo de dependencias en `schema.yaml`. Mismo trabajo. Diferencias reales: OpenSpec es un flujo único y editable sin tocar TypeScript; este repo separa por modelo a propósito y antepone un discovery gate que OpenSpec no tiene. Reemplazarlos exigiría reconstruir ambas cosas dentro del esquema de OpenSpec — no gratis.

### 6. Costo de migración
- **24** folders en `specs/archive/` (conteo real), ninguno migra.
- **1** feature viva, `020-commit-per-slice-pr-gate`: `implementing`, 1 tarea pendiente (`T011 [HITL]`, dogfood).
- **98 tests** pasan hoy (`npm test`); **101 líneas** tocan `specs/`/`featureDir`/nombres de archivo — reescritura parcial, no total.
- `.specify/templates/`: 6 archivos heredados de spec-kit, symlinkeados a `SDD_HOME`, quedan huérfanos si cambia el formato base.
- Esfuerzo: reescribir 3 funciones de `bin/sdd` a mano + mapear templates + tocar el subconjunto de tests — del orden de una feature MEDIUM/LARGE, no un rewrite del repo.

### 7. Abierto — no verificado
- Si OpenSpec tiene un equivalente de `prompts:check` (falla verificable si el paquete diverge de lo documentado).
- Adopción real en brownfield a escala (no revisé issues del proyecto — toda la evidencia es de docs oficiales).
- Si `openspec/config.yaml`'s `context:` es tan expresivo como `conventions.md` § Domain rules.

## Recommendation

**Robar la idea, no la dependencia.** Construir una capa de spec viva propia (`specs/live/<dominio>.md`) dentro de este SDD, con el vocabulario ADDED/MODIFIED/REMOVED ya existente, alimentada por `/archive-feature` en vez de morir en `spec.md`. Sin tocar `bin/sdd`.

Por qué no full-adopt: el backfill no se resuelve (hallazgo 1), `detect_feature_phase`/`build_pr_title`/`build_pr_body_file` necesitan reescritura real (hallazgo 2), y lo que hace fuerte a este pipeline (review adversarial, simplify, discovery gate, model routing — hallazgo 4) no tiene equivalente, hay que reconstruirlo igual dentro del esquema de OpenSpec.

Por qué no adopt parcial (`/opsx:propose` reemplazando `sdd-designer`+`sdd-task-planner`): el solapamiento es real (hallazgo 5), pero el valor de la separación actual se perdería o se reconstruye con el mismo esfuerzo que escribir la mejora propia, más una dependencia externa de yapa.

**Qué tendría que ser cierto para "adoptar entero"**: necesidad real de interoperar con otros repos vía la feature "stores" de OpenSpec, o que `context:` resultara tan expresivo como `conventions.md` (abierto #7) y el equipo prefiriera mantenimiento externo sobre control total.

**Esfuerzo estimado**: feature MEDIUM — nuevo espacio por dominio + cambio en `/archive-feature`, cero cambios en `bin/sdd`.

## Qué hacer con 023

| Arreglo diferido | ¿Se pierde con esta recomendación? |
|---|---|
| `cmd_base_branch` capa 1 → `resolve_feature_dir` | Seguro — capa de git, ortogonal |
| Cablear `cmd_base_branch` en `open-pr` + procedencia | Seguro — mismo motivo |
| `extract_section` fence-aware | Seguro — portable a cualquier archivo destino |
| `cmd_commit_slice`: avisar sin bloquear | Seguro — capa de git |
| `sdd-designer` cae a findings inexistentes | Seguro — este research NO recomienda tocar `sdd-designer` |
| Cobertura por ejes (evitar 4º ciclo de fix) | Seguro — práctica de testing, no depende de la capa de artefactos |

Los seis siguen siendo trabajo válido; nada de lo diferido apunta a superficie que esta recomendación reemplace.

## Result
- **Status**: success
- **Summary**: No adoptar OpenSpec — su planning layer no resuelve el backfill de 24 features archivados y no cubre lo que hace fuerte a este pipeline (review adversarial, simplify, discovery gate, model routing). Construir una capa de spec viva propia, alimentada por `/archive-feature`, sin tocar `bin/sdd`.
- **Artifacts**: `/Users/santi/Proyectos/rossi/repos/test-sdd/research/R-007-openspec-adoption/research.md`
- **Next**: retomar 023 con los seis arreglos intactos (ninguno depende de esta decisión); abrir feature MEDIUM separada para "spec viva" cuando haya lugar — no bloquea 023.
- **Risks**: preguntas abiertas #7 sin verificar (equivalente de `prompts:check` en OpenSpec, expresividad de `context:`) — no cambian la recomendación pero podrían matizarla.
