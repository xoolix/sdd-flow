# R-006 — SDD flow simplification

**Question**: ¿Qué flujo SDD debe seguir un dev de un equipo de 10? ¿Los auto-orchestrators (`/sdd-next`, `/sdd-auto`) agregan valor o son ruido? ¿Cuál es el camino mínimo coherente?

**Context**: Empíricamente verificado (2026-05-01) que Claude Code force-strips `Agent` de cualquier sub-agent spawned. Eso rompe el patrón "skill router → native orchestrator → sub-agent workers" en `sdd-plan-feature` y `sdd-review-feature`. Además, el user reporta el flujo "engorroso" y poco claro para un dev nuevo.

---

## 1. Diagnóstico — qué es ruido y qué no

| Componente | Valor real | Veredicto |
|---|---|---|
| `/new-feature`, `/new-quick-feature`, `/new-fix` | Único entry point para crear specs. Sin esto, no hay SDD. | **Core** |
| `/implement-task`, `/simplify-code`, `/archive-feature` | Leaf executors, sin delegación recursiva. Hacen el trabajo. | **Core** |
| `/plan-feature`, `/review-feature` | Orchestrators que necesitan delegar a sub-agents (Explore, Discovery, Designer, TaskPlanner / Voters, Adversarial). **Roto por Agent-recursion**. | **Core (pero roto)** |
| `/sdd-next` | Auto-detecta fase + valida envelope + retry con error context. Es UNA fase a la vez. | **Útil pero opcional** |
| `/sdd-auto` | Lo mismo que `/sdd-next` pero loop continuo + evaluator-optimizer (review FAIL → fix → re-review, max 2 ciclos). | **Útil pero opcional** |

**Lo que solo los autos hacen y no se podría hacer manual igual de barato**:
- Detectar `.simplified` stale (SHA mismatch contra HEAD) y forzar re-simplify.
- Post-phase validation paralela (lint/tests).
- Retry con error context (max 2).
- Evaluator-optimizer loop completo (review FAIL → implement-task fix → simplify-code → re-review).
- Inyección de compact rules de `skill-registry.md` por phase.

**Lo que los autos hacen pero el dev podría hacer trivial**:
- Leer el `Next` field del envelope y correr ese comando.
- Detectar cuál es la próxima fase basándose en qué archivos existen.

---

## 2. Lo que el user dijo vs lo que el data dice

El user: *"deberíamos tener el flujo manual y listo. (...) los automáticos capaz generan ruido."*

El data dice: los autos NO son ruido — agregan valor concreto (evaluator-optimizer loop, validation, retry). Pero el **default visual y mental** sí es confuso para un dev nuevo. CLAUDE.md describe el pipeline en una línea ASCII; README.md lista los comandos como tabla; ningún archivo dice "como dev nuevo, corré X después Y después Z" en orden cronológico.

El "ruido" que percibe el user no es de los autos en sí — es de la **falta de una guía clara y de fricciones acumuladas** (Agent recursion broken, fast-lane semi-escondido, decision points difusos).

---

## 3. Tres caminos

### A) Manual-only — eliminar autos
- **Hacer**: deprecar `/sdd-next` y `/sdd-auto`. Cada dev corre cada fase a mano leyendo `Next` del envelope.
- **Pro**: máxima simplicidad. No hay magia. Cero recursion bug. Documentación = una lista de comandos.
- **Con**: se pierde el evaluator-optimizer loop (gran valor). Se pierde el retry automatic. Reviews manuales requieren más disciplina del dev. La validation post-phase queda al dev (probable que se la salte).
- **Costo**: refactor moderado. Borrar 2 skills + sus agents. Update CLAUDE.md/README.

### B) Manual-default + auto opt-in para power users
- **Hacer**: posicionar manual como el flujo expected. Autos quedan documentados como "shortcut para devs experimentados que quieren validation+retry+evaluator-optimizer". Onboarding doc enseña manual primero.
- **Pro**: el dev nuevo no se choca con autos confusos. Los devs que aprovechan los autos los siguen teniendo. No se pierde valor.
- **Con**: hay que fixear igual el bug de Agent-recursion para que `/plan-feature` y `/review-feature` (manuales) funcionen correctamente. Dos sistemas vivos = más superficie de mantenimiento.
- **Costo**: bajo en docs. Medio en fix de recursion (ver §4).

### C) Auto-only refactored — fixear recursion + simplificar autos
- **Hacer**: hacer que `/sdd-next` sea el único entry point post-spec. Refactorear plan-feature y review-feature a top-level orchestration (en el SKILL.md mismo, ejecutado por main Claude). Manual queda como fallback/escape hatch.
- **Pro**: un solo flujo a aprender. Todos los autos funcionan.
- **Con**: contradice la intuición del user ("manual y listo"). Magia para devs. Refactor mayor.
- **Costo**: alto.

---

## 4. Fix del bug de Agent-recursion (común a B y C)

Solo afecta a `sdd-plan-feature` y `sdd-review-feature` (los únicos orchestrators con sub-agent delegation).

| Sub-fix | Descripción | Costo |
|---|---|---|
| **Inline en SKILL.md** | Mover el body de orchestration al SKILL.md. Main Claude (top-level, tiene Agent) ejecuta + delega. El native agent `sdd-plan-feature.md` se borra. | Bajo. Walk-back parcial del "T3 pilot 2026-04-23". |
| **Flat agent** | Mantener native agent pero hacer que NO delegue — ejecuta Explore, Discovery, Designer, TaskPlanner inline en su propio contexto opus. Pierde model-per-step (todos corren en opus) y paralelismo. | Bajo en esfuerzo, alto en costo de tokens (todo opus). |
| **Top-level slash command** | Skill router invoca el agent en top-level, no como sub. Requiere soporte de Claude Code que no existe hoy. | Bloqueado. |

Recomendado: **Inline en SKILL.md**. Pierde modelo-per-step para los workers internos pero recupera la delegación + paralelismo. El `sdd-plan-feature.md` agent file se mantiene como referencia pero el flujo va por el SKILL.

---

## 5. Recomendación

**Camino B — Manual-default + auto opt-in.**

Razones:
1. Honra la intuición del user ("manual y listo") sin tirar el valor concreto de los autos.
2. Los autos NO son ruido — son shortcuts. Ocultan complejidad. Re-posicionarlos como "power user" los saca del default visual.
3. El fix de recursion es necesario igual para que `/plan-feature` y `/review-feature` manuales funcionen. Sin ese fix, manual-only tampoco funciona.
4. El "ruido" que percibe el user es real pero se cura con docs claras (1-pager onboarding) + fast-lane visibility (014) + fix de recursion. No requiere romper la arquitectura.

**Concretamente, deliverables propuestos** (en orden de prioridad):

1. **Fix Agent-recursion** (nueva feature, full-spec): refactor de `/plan-feature` y `/review-feature` skills a inline orchestration en main Claude. Borrar (o conservar como fallback) los native agent files de orquestadores. Sin esto, ni manual ni auto funcionan completamente.
2. **014 fast-lane visibility** (ya en spec): seguir adelante. CLAUDE.md decision tree + skill descriptions claras.
3. **Onboarding 1-pager** (nueva feature, fast-lane): "como dev nuevo, corré X después Y", manual flow como default expected, autos mencionados como shortcut opcional.
4. **Update README/CLAUDE.md** para reposicionar autos como opt-in (parte de feature 014 o aparte).

**Lo que NO hacer**:
- No deprecar `/sdd-next` y `/sdd-auto`. Tienen valor único (evaluator-optimizer loop). Solo cambiar su posicionamiento.
- No mantener el patrón native-agent-orchestrator. Empíricamente roto. Walk-back targeted.
