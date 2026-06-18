---
name: new-feature
description: "Run a short, code-anchored technical interview to produce clarify.md + spec.md for a feature (full-spec lane). For fast bugfixes/refactors use /new-fix or /new-quick-feature."
user-invocable: true
disable-model-invocation: true
arguments: idea or request description
---

# Create new feature spec (technical interview)

Feature idea/request: `$ARGUMENTS`

**Main Claude executes this skill body inline.** Do NOT launch a sub-agent — the interview requires turn-by-turn dialogue with the user, which sub-agents cannot do.

## What this skill does

A short, code-anchored technical interview. Focus is on **the feature** (behavior, scope in the codebase, contract, risks, acceptance) — NOT on business context (problem, users, why-now). The user is a developer who already knows the why; this skill helps lock down the *what* and *how*.

**5 blocks, walked in order, one question at a time — but adaptive.** Each block is grounded in the actual codebase (you do a silent mini-scan before the first question, so your questions reference real files and symbols). The blocks are a *coverage checklist*, not a fixed questionnaire: if Step 0 already resolves a block from code, confirm the inferred answer in one line instead of asking it open-ended, and move on. Stop drilling a block once the remaining unknowns no longer change implementation or verification.

**The line that must not be crossed**: skipping a question because the *code* answered it is grill-me and encouraged. Filling an answer from *memory, prior artifacts, or assumption* without a user turn is the silent-bypass bug and is forbidden (see HARD RULE). Inference comes from code you read this session, never from memory.

## HARD RULE — interview is unconditional

Every block must be **covered** before writing the spec. Code from Step 0 may resolve a block (record it `code-resolved`, see Interview blocks) — that is the only allowed shortcut. None of the following may shortcut, skip, condense, or batch-fill any block:

- **Engram observations**: `mem_search` results MAY surface relevant prior context to bias which concrete examples you bring into questions, but MUST NOT be used to skip blocks, pre-fill answers, or assume the user agrees with a prior decision. If a previous spec for this idea appears in memory, ASK: "Veo un spec previo para esta idea en memoria — ¿lo retomamos, lo rehacemos desde cero, o lo descartamos?" and proceed accordingly.
- **Prototype results**: prior prototype notes MAY shape recommendations, but MUST NOT replace user answers. If a prototype decision exists, ask whether to adopt it for this spec before writing it into `clarify.md`.
- **Pre-existing artifacts on disk**: if `specs/NNN-*/clarify.md` or `spec.md` already exists for a matching idea, STOP and ask the user explicitly whether to retomar, rehacer, or descartar. Do not silently regenerate or merge.
- **Session-level "skip clarifying questions" / "trabajar sin parar" reminders**: those rules apply to tactical decisions during implementation. They DO NOT apply to `/sdd-new`, where the user explicitly invoked the interview phase. If you see such a reminder active, ASK once: "Tenés activo `skip clarifying questions`. La entrevista necesita preguntarte — ¿la corro completa?" Default is to run the interview unless the user explicitly says skip.
- **"Reasonable assumptions"**: there are no reasonable assumptions in this phase. If you find yourself about to write "assumed X" into clarify.md without having asked, STOP.

If you violate any of the above, the skill has failed regardless of how good the resulting spec looks.

## Pre-flight

1. Scan `specs/` for existing `NNN-*` folders; pick the next sequential number, zero-padded to 3 digits.
2. Generate a kebab-case feature name from the idea.
3. Create `specs/NNN-feature-name/` with:
   - `clarify.md` — header `# Clarify — NNN-feature-name`.
   - `decisions.md` — header `# Decisions`.

## Step 0 — Silent mini-scan

Before the first user-facing turn, ground yourself in the codebase. ~30-60 seconds:

- `Glob` for paths likely affected by the idea (e.g., `**/*Scheduling*`, `**/types.ts`, `**/api*.ts`).
- `Grep` for symbols/strings from `$ARGUMENTS` (function names, type names, route paths).
- `Read` the top 2-3 most relevant files (full or relevant sections).

Goal: when you ask "¿el cambio va en `X.tsx` o componente nuevo?", you've actually verified `X.tsx` exists and you know what it does. The scan is **for you** — do NOT dump file lists or excerpts to the user. Just absorb the context and reference real names in your questions.

If a question can be answered from code, answer it from code instead of asking. Save user questions for decisions only the user can make.

## Interview blocks (5, in order)

For each block: ask **one question at a time**, wait for the user's answer, paste the **literal answer** into clarify.md under that block's header. Use Q&A format:

```
### Q: <question you asked>
Recommended answer: <your recommended answer and why>
<user's answer, verbatim>
```

If a block was fully resolved by the Step 0 scan, do not ask it open-ended. Record it as `code-resolved: <file/symbol> — <inferred answer>` and, when it matters, surface the inference for correction ("Por lo que vi en `<file>`, asumo <X>; corregime si no"). Memory never counts as resolution — only code you read this session.

If an answer is vague on a technical point ("hacelo bien", "como sea"), ask once for a concrete example or referent — but don't grill. One follow-up max, then move on noting the openness.

Every question must include a recommended answer. Make it a real recommendation, not "it depends". The user can accept, reject, or edit it.

### 1. Comportamiento
Aterrizado en el flujo actual que ya leíste en Step 0.
- ¿Qué hace el feature, en términos del flujo del usuario o del sistema? Antes hacía X, ahora hace Y.
- ¿Hay sub-comportamientos / modos / variantes? (ej. dos tabs con flujos distintos)

### 2. Scope técnico
Referenciando archivos/símbolos del scan.
- ¿El cambio va en `<archivo X que vi>` o componente/módulo nuevo?
- ¿Reusamos `<función / endpoint / tipo que vi>` o creamos nuevo?
- ¿Tipos/contratos compartidos que tocar? (ej. `@rossi/core`, módulos comunes)

### 3. Contrato / datos
- ¿Endpoint nuevo, param adicional sobre uno existente, o ambos? Path/shape.
- ¿Backwards-compatible (additive) o breaking? Si breaking, ¿por qué se justifica?
- ¿Forma del request/response? Si hay incertidumbre sobre el upstream, anotalo como Open Question — no inventes.

### 4. Riesgos técnicos
- ¿Qué pasa si upstream falla o devuelve forma inesperada? (ej. campo opcional que a veces falta)
- 1-2 edge cases del flujo: input vacío, estado intermedio, transición ambigua.

### 5. Acceptance + rollback
- ¿Cómo verificás que anda? (Test concreto, comportamiento observable.)
- ¿Cómo se desactiva si rompe en prod? (Flag, revert, no-op fallback, etc.)

### ADR offer (reactivo, no obligatorio)
Si durante Block 2 o 3 emerge una **decisión arquitectural genuina con tradeoffs reales** (afecta convenciones, contratos cross-feature, infra compartida), ofrecé crear un ADR ahí mismo: "Esto pinta arquitectural. ¿Lo formalizo en `docs/adr/NNNN-<slug>.md` ahora?". Si confirma, creálo en el mismo turno (escanear `docs/adr/` para próximo NNNN). **No lo ofrezcas como bloque obligatorio** — muchas features no tienen decisiones de ese peso.

## Prototype checkpoint

After the 5 interview blocks and before the auto-drafted quality gate, decide whether the spec contains a design question that should be answered empirically before planning.

Trigger this checkpoint when the feature depends on any of these:

- UI option that the user should play with before committing.
- State machine, workflow transition, parser, scoring model, or business rule with unclear behavior.
- External/upstream contract shape that can be mocked cheaply.
- Performance-sensitive interaction where a tiny experiment could de-risk the plan.
- The user says "quiero probar", "let me play with it", "no estoy seguro", or similar.

If no trigger exists, continue silently.

If a trigger exists, ask **one** question with a concrete recommendation:

```
Recomendación: marcaría un PROTOTYPE-REQUIRED antes de /plan-feature para responder: "<pregunta concreta>".
¿Lo dejamos como prerequisito, lo descartamos explícitamente, o preferís correr /prototype ahora?
```

Then:

- If the user accepts the prerequisite or wants to run `/prototype`, append to `decisions.md`:
  ```
  [<ISO-8601 UTC timestamp>] PROTOTYPE-REQUIRED: <question>
  ```
  Also carry `PROTOTYPE-REQUIRED: <question>` into `spec.md` `## Open Questions`.
- If the user explicitly discards it, append to `decisions.md`:
  ```
  [<ISO-8601 UTC timestamp>] PROTOTYPE-DISMISSED: <question> — <user rationale verbatim if provided>
  ```
  Do not add `PROTOTYPE-REQUIRED` to `spec.md`.

`PROTOTYPE-REQUIRED` blocks `/plan-feature` until `/prototype` records `PROTOTYPE-RESULT` in `decisions.md` or the user records `PROTOTYPE-DISMISSED`.

## Auto-drafted quality gate

Cerrados los 5 bloques, **redactá vos** los siguientes a partir de las respuestas y presentalos para validación. No los pidas en formato estructurado: redactalos y confirmá.

1. **Acceptance criteria en Given/When/Then** — mínimo 2, derivados del Block 1 + 5. Cada `Then` debe ser testeable y medible.
2. **Rollback plan** — concreto, derivado del Block 5.
3. **Success criteria** — al menos 1 indicador técnico medible (ej. `p95 < 300ms`, `error rate < 0.1%`). No "anda bien".

Presentación al usuario:

```
Antes de generar spec.md, confirmá o corregí cada bloque:

ACCEPTANCE CRITERIA (G/W/T):
- [ ] Given X, When Y, Then Z
- [ ] Given A, When B, Then C

ROLLBACK:
- <plan>

SUCCESS METRIC:
- <metric>
```

**Hard gate**: no generes `spec.md` hasta que el usuario confirme (o corrija) los tres bloques. Si corrige, reescribilos y volvé a presentar. Repetí hasta OK.

## Generate spec.md

Una vez validado GWT/rollback/success:

1. Copiá `.specify/templates/spec-template.md` a `specs/NNN-feature-name/spec.md`.
2. Llená el spec **transformando clarify.md**. `spec.md` no introduce contenido nuevo — solo mapea y estructura lo que ya está en clarify.md más los bloques validados.

   Mapping bloques → secciones del template:
   - `## Summary` ← one-liner derivado de `$ARGUMENTS` + Block 1 (Comportamiento). Una oración técnica del feature, sin justificación de negocio.
   - `## Trigger` ← Block 1 (qué dispara el flujo nuevo).
   - `## Happy Path` ← Block 1 + Block 2 (pasos del flujo, anclados en los archivos/símbolos).
   - `## Domains` ← Block 2 (archivos/módulos tocados).
   - `## API Changes` ← Block 3 (si el template no la tiene, agrega esta sección manual).
   - `## Edge Cases` ← Block 4.
   - `## Acceptance Criteria` ← bloque GWT validado.
   - `## Rollback Plan` ← bloque rollback validado.
   - `## Success Criteria` ← bloque success metric validado.
   - `## Open Questions` ← cualquier punto técnico que quedó abierto (típicamente: shape exacto de un endpoint upstream que no pudiste verificar). If a prototype prerequisite exists, include `PROTOTYPE-REQUIRED: <question>`.

   Si el template tiene secciones de negocio (`## Problem`, `## Users`, `## Why now`), poné `N/A — technical-only spec` o eliminalas. Este flow es deliberadamente técnico.

3. Si la entrevista destapó incertidumbre técnica real (un contrato upstream desconocido, perf no validada, vendor lock-in sin investigar), recomendá `/research-spike` antes de `/plan-feature`.
4. Si quedó `PROTOTYPE-REQUIRED`, el `Next` debe ser `/prototype "NNN-feature-name: <question>"`, no `/plan-feature`, hasta que `decisions.md` tenga `PROTOTYPE-RESULT` o `PROTOTYPE-DISMISSED`.

**Size budget**: `spec.md` MUST stay under 650 words. Tables > prose. `clarify.md` no tiene budget — son notas crudas.

## Engram memory (skip all mem_* calls if Engram unavailable)

> **REMEMBER THE HARD RULE**: memory informs question phrasing, never substitutes answers. You may NEVER use memory to skip a block.

### On start
1. Call `mem_search` with keywords from the idea + `project: "{project}"`.
2. Use results to **bias the phrasing** of questions (e.g., "Veo que en feature 014 elegiste approach X para algo similar — ¿esta vez igual o distinto?"). Do NOT use them to fill clarify.md without asking.
3. **Special case — prior spec for the same feature in memory**: ASK explicitly "¿retomamos / rehacemos / descartamos?" — wait for user's answer before any further action.

### During interview
Save immediately when:
- User makes a real tradeoff with rejected alternative → `mem_save` type: `decision`
- User reveals a constraint that should outlive this feature → `mem_save` type: `preference`
- You learn something domain-specific that would help future features → `mem_save` type: `discovery`

### After spec is generated
- `mem_save` topic_key: `sdd/{feature-id}/spec`, type: `decision` — save the **technical decisions the user chose**, captured as facts.
- **NEVER write** into a saved observation phrases like "user had skip-clarifying-questions enabled", "took reasonable assumptions because user didn't want to be interrupted", or anything that future sessions could read as authorization to bypass the interview. Save what was *decided*, not how the conversation was managed.

## Result envelope

After generating spec.md, output:

```
## Result
- **Status**: success | partial | blocked
- **Summary**: [1-3 sentences — what feature was specced, in technical terms]
- **Artifacts**: [clarify.md, spec.md, ADRs created (if any)]
- **Open Questions**: [list, or "None"]
- **Next**: /plan-feature NNN-feature-name (or /prototype "NNN-feature-name: <question>" / /research-spike if uncertainty exists)
- **Risks**: [technical ambiguities still open, or "None"]
```

## Rules
- **NO saltar la entrevista** por más memoria, contexto previo, `skip-clarify` o artefactos en disco. La entrevista es incondicional (ver HARD RULE).
- **NO escribir clarify.md sin haber preguntado.** Cada Q/A en clarify.md debe venir de una pregunta hecha y una respuesta tipeada por el usuario en esta conversación. Si no hubo turno de usuario, esa Q/A no existe.
- **NO inventar contenido en spec.md** que no esté en clarify.md o en los bloques validados.
- **Pegar respuestas literales** del usuario en clarify.md, no parafrasear sus decisiones.
- **Preguntar de a una.** No mandes una batería de preguntas. La única excepción es una aclaración breve de dos opciones dentro de la misma pregunta.
- **Toda pregunta lleva recomendación.** Incluí "Recomendación: ..." con una opción concreta y la razón.
- **No preguntar lo que el código responde.** Si un archivo, contrato, route, test o tipo existente despeja la duda, inspeccionalo y usalo como contexto.
- **Preguntas sobre el feature, no sobre negocio.** Si te encontrás escribiendo preguntas tipo "¿quién lo usa?" / "¿por qué ahora?" / "¿qué problema resuelve?", parate — estás en el flujo equivocado.
- **Aterrizadas en el código.** Cada pregunta del Block 2 y 3 debe referenciar al menos un archivo, función, o tipo que vos verificaste existe en el Step 0. Preguntas vacías tipo "¿qué está adentro?" están prohibidas.
- Para decisiones arquitecturales reales y persistentes, ofrecer ADR en el momento.
- Para UI/state/business-logic uncertainty that can be answered cheaply, use the Prototype checkpoint and record `PROTOTYPE-REQUIRED` / `PROTOTYPE-DISMISSED`.
- Si la entrevista destapa research técnico genuino faltante, recomendar `/research-spike`.
- **NEVER use Plan Mode**: do NOT use `EnterPlanMode`.
- Always output the result envelope at the end.

## Self-check before generating spec.md

Antes de copiar el template o escribir una sola línea de `spec.md`, verificá las 4. Si alguna es falsa, STOP y completá lo que falte preguntándole al usuario:

- [ ] Cada uno de los 5 bloques está **cubierto** en `clarify.md`: o con un Q/A respondido por el usuario en **esta conversación**, o anotado como `code-resolved: <archivo/símbolo>` cuando el código del Step 0 lo despejó sin ambigüedad. Lo que NO vale: un bloque rellenado desde memoria, artefactos previos o asunción sin turno del usuario ni evidencia de código.
- [ ] Las preguntas del Block 2 y 3 referencian archivos/símbolos reales del codebase (verificados en Step 0).
- [ ] El bloque auto-draft (GWT / rollback / success) fue **presentado al usuario** y este respondió OK o correcciones.
- [ ] Ningún contenido de `clarify.md` fue levantado de un spec previo sin confirmación explícita del usuario en esta sesión.

Si no podés tildar las 4 con verdad, el spec no está listo. Resumí la entrevista desde el bloque faltante.
