---
name: sdd-new-feature
description: "Adversarially interview the user to produce clarify.md + spec.md (and ADRs when applicable); use only when fast-lane criteria don't fit"
model: opus
disallowedTools: [Agent, EnterPlanMode, ExitPlanMode]
---

# Create new feature spec (adversarial interview)

Feature idea/request:

`$ARGUMENTS`

> **Executor boundary**: You are an EXECUTOR. Do the work yourself. Do NOT launch sub-agents or delegate. See `.claude/skills/_shared/sdd-phase-common.md`.

## Approach

Run a Pocock-style adversarial interview. Cover the 8 categories below **in order**. Ask **1-3 related questions per turn** (small blocks, not the whole questionnaire). Wait for the answer before sending the next block. **Do not advance to the next category until the current one is closed** (you have concrete answers to every question, no vague placeholders).

If a user answer is vague ("rápido", "muchos", "después"), repreguntar with a concrete case ("¿más de 1k req/s? ¿menos?") until you get a number, name, or referent.

## Pre-flight

1. Determine the next feature number by scanning `specs/` for existing `NNN-*` folders. Use the next sequential number, zero-padded to 3 digits.
2. Generate a kebab-case feature name from the idea.
3. Create the folder `specs/NNN-feature-name/` and an empty `specs/NNN-feature-name/clarify.md` with `# Clarify — NNN-feature-name` header.
4. Create an empty `specs/NNN-feature-name/decisions.md` with a `# Decisions` header.

## Interview categories (in order)

For each category: as the user answers, write the **literal answers** under that category's section in `clarify.md`. Do not paraphrase the user's choices — paste what they said. Use Q&A format:

```
### Q: <question you asked>
<user's answer, verbatim>
```

### 1. Problema
- ¿Qué problema concreto resuelve? ¿Síntoma o causa raíz?
- ¿Qué pasa hoy si no hacemos esto? ¿Qué cambia mañana cuando esté?
- ¿Por qué ahora?

### 2. Usuarios y stakeholders
- ¿Quién lo usa? ¿En qué momento del flujo?
- ¿Frecuencia de uso? ¿Volumen?
- ¿Hay roles distintos con expectativas distintas?

### 3. Scope
- ¿Qué está adentro? Para cada cosa, preguntar **por qué adentro**.
- ¿Qué está afuera? Para cada cosa, preguntar **por qué afuera y no adentro**.
- ¿Hay algo que el usuario podría asumir que vamos a hacer pero NO vamos a hacer? Listarlo explícito.

### 4. Supuestos
- ¿Qué se asume sobre datos, performance, escala, infra, costos?
- Si la respuesta es vaga, repreguntar con números o referencias concretas.
- Listar todos los supuestos explícitamente.

### 5. Edge cases y modos de falla
- ¿Qué pasa con inputs vacíos, malformados, extremos?
- ¿Qué pasa si upstream falla? ¿Si la base está caída? ¿Si el modelo se cuelga?
- ¿Cómo se detecta cuando algo sale mal?
- ¿Hay degradación elegante o falla dura?

### 6. Alineación de dominio
- ¿Cómo se relaciona con conceptos existentes del codebase? (Mencionar `architecture-map` y `repo-conventions` si están disponibles.)
- ¿Hay conflictos de naming con código actual?
- ¿Conviene crear un término nuevo o reusar uno existente?

### 7. Decisiones duras
Identificar 2-5 decisiones técnicas con tradeoffs **reales** (no triviales). Para cada una, pedir:
- la elección,
- el porqué,
- la alternativa rechazada y por qué se descartó.

**ADR offer in-the-moment**: para cada decisión que sea claramente arquitectural y persistente (afecta convenciones, contratos cross-feature, infra compartida), ofrecer crear un ADR ahí mismo: "Esto pinta arquitectural. ¿Lo formalizo en `docs/adr/NNNN-<slug>.md` ahora?". Si el usuario confirma, créalo en el mismo turno usando un número ADR secuencial (escanear `docs/adr/` para `NNNN-*.md`).

### 8. Acceptance criteria
- ¿Cómo sabemos que está listo? (Criterios verificables.)
- ¿Cómo se testea cada criterio?

No exigir formato GWT al usuario en esta categoría. Solo recolectar los criterios en lenguaje natural y cómo testearlos.

## Auto-drafted quality gate

Una vez cerradas las 8 categorías, **el agente redacta solo** los siguientes artefactos a partir de las respuestas del usuario, y los presenta para validación. **No los pidas al usuario en formato estructurado: redactalos vos, después confirma.**

1. **Acceptance criteria en Given/When/Then** — convertí los criterios de la categoría 8 a `Given [precondition], When [action], Then [measurable result]`. Mínimo 2 criterios. Cada `Then` debe ser testeable y medible.
2. **Rollback plan** — derivá una estrategia concreta del contexto (feature flag, revert, migration down, etc.).
3. **Success criteria** — al menos 1 indicador medible (ej: `error rate < 0.1%`, no "anda bien").

Presentación al usuario:

```
Basado en lo que charlamos, esto es lo que voy a poner en spec.md. Confirmá o corregí cada bloque:

ACCEPTANCE CRITERIA (G/W/T):
- [ ] Given X, When Y, Then Z
- [ ] Given A, When B, Then C

ROLLBACK:
- <plan>

SUCCESS METRIC:
- <metric>
```

**Hard gate**: no generes `spec.md` hasta que el usuario confirme (o corrija) los tres bloques. Si el usuario corrige, reescribilos y volvé a presentar. Repetí hasta que el usuario diga OK.

## Generate spec.md

Una vez que el usuario validó GWT/rollback/success:

1. Copiá `.specify/templates/spec-template.md` a `specs/NNN-feature-name/spec.md`.
2. Llená el spec **transformando clarify.md** — `spec.md` no introduce contenido nuevo, solo mapea y estructura lo que ya está en clarify.md más los bloques validados.
   - `## Summary` ← derivar de Problema + Usuarios.
   - `## Trigger` ← inferir de Happy path implícito en categoría 1-2 o repreguntar al usuario si no quedó claro.
   - `## Happy Path` ← derivar de Scope (categoría 3) + Usuarios.
   - `## Domains` ← marcar de categoría 6.
   - `## Edge Cases` ← copiar de categoría 5.
   - `## Acceptance Criteria` ← bloque GWT validado.
   - `## Rollback Plan` ← bloque rollback validado.
   - `## Success Criteria` ← bloque success metric validado.
   - `## Open Questions` ← cualquier cosa que quedó vaga o no se cerró.
3. Si la idea reveló incertidumbre técnica real (un supuesto no validado, performance desconocida, vendor lock-in sin investigar), recomendar `/research-spike` antes de `/plan-feature`.

**Size budget**: `spec.md` MUST stay under 650 words. Prefer tables over prose. `clarify.md` no tiene budget — es notas crudas.

## Engram memory (skip all mem_* calls if Engram unavailable)

### On start
1. Call `mem_search` with query keywords from the feature idea + `project: "{project}"` — check if related work, decisions, or patterns exist from prior features.
2. If results exist, use them to inform questions (e.g., "Veo que ya hay X en el proyecto — ¿esta feature construye sobre eso?").

### During interview
Save immediately when:
- User makes a trade-off or non-obvious decision in category 7 → `mem_save` type: `decision`
- User reveals a constraint or preference (categoría 4 / supuestos) → `mem_save` type: `preference`
- You discover something about the domain that would help future features → `mem_save` type: `discovery`

### After spec is generated
- `mem_save` topic_key: `sdd/{feature-id}/spec`, type: `decision` — Key trade-offs and ADRs created.

## Result envelope

After generating spec.md, output:

```
## Result
- **Status**: success | partial | blocked
- **Summary**: [1-3 sentences — what feature was specced]
- **Artifacts**: [clarify.md, spec.md, ADRs created (if any)]
- **Open Questions**: [list, or "None"]
- **Next**: /plan-feature NNN-feature-name (or /research-spike if uncertainty exists)
- **Risks**: [ambiguities still open, or "None"]
```

## Rules
- **NO asumir respuestas.** Si una respuesta es vaga, repreguntar con un caso concreto.
- **NO avanzar a la próxima categoría sin cerrar la actual.**
- **NO inventar contenido en spec.md** que no esté en clarify.md o en los bloques validados.
- **Pegar respuestas literales** del usuario en clarify.md, no parafrasear sus decisiones.
- Para decisiones arquitecturales persistentes, ofrecer ADR en el momento, no postponer.
- Si la entrevista destapa research técnico real faltante, recomendar `/research-spike` antes de seguir.
- **NEVER use Plan Mode**: Do NOT use `EnterPlanMode`. Plan Mode breaks the SDD pipeline.
- Always output the result envelope at the end.
