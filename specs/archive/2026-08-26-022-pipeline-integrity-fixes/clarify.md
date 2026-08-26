# Clarify — 022-pipeline-integrity-fixes

## Step 0 — code-resolved (scan de esta sesión, branch integration/sdd-020-021)

**C1 — la taxonomía vieja sobrevive en el orquestador:**
- `code-resolved: plan-feature/SKILL.md:55` — Step 3 "Domain analysis" identifica `db, api, frontend, infra, auth, notifications, integrations, etc.` Es la misma taxonomía que 021 eliminó de los templates.
- `code-resolved: plan-feature/SKILL.md:56-61` — esas categorías **dimensionan** el feature: "SMALL (1-2 domains, all small/medium)", "MEDIUM (2-4 domains or any large)", "LARGE (4+ domains)". El conteo de dominios decide la estrategia de ejecución.
- `code-resolved: plan-feature/SKILL.md:94` — el read de `## Domain rules` está en Step 5 (lanzamiento del designer), DESPUÉS del Step 3.
- `code-resolved: plan-feature/SKILL.md:96` — el designer debe incluir "Domain analysis summary (from step 3)", así que el análisis con taxonomía vieja entra al artefacto.
- `code-resolved: plan-feature/SKILL.md:37` — el discovery-resume path saltea Step 4 (Explore) y 4.5 enteros. Y el fallback de `:94` dice "the designer derives names from the exploration findings you collected in step 4" — que en ese path no existen. 021 tomó exactamente ese camino.

**C2 — el test verifica un mecanismo que producción no usa:**
- `code-resolved: tests/sdd.test.js:1230-1238` — el test de T008 sourcea `extract_section` de `bin/sdd` y lo corre contra `conventions.md`.
- `code-resolved: sdd-designer.md, sdd-research-spike.md, plan-feature/SKILL.md` — los tres consumidores dicen `grep \`.claude/rules/conventions.md\` for \`## Domain rules\``. Ninguno llama a `extract_section`.

**Defectos de /archive-feature:**
- `code-resolved: sdd-archive-feature.md` Result envelope — campos: Status, Summary, Artifacts, Commit, Next, Risks. **No hay `Validations` ni `Validations-Output`**, a diferencia de implement-task y simplify-code. No corre tests después del move.
- `code-resolved: sdd-archive-feature.md` Step 3.5 — `sdd commit-slice $ARGUMENTS --type chore --files <spec files>`. Stagea los archivos nombrados + el dir derivado (que post-move resuelve al de archive). Nada stagea el borrado del path viejo. Evidencia: el commit `34b7332` fue `6 files changed, 408 insertions(+)`, cero borrados.
- `code-resolved: sdd-archive-feature.md` — el agente corre en `model: haiku` y su propio texto dice "Keep this step to exactly one `sdd commit-slice` call with no conditional branching... Do not 'improve' this into a decision tree". Cualquier fix debe respetar eso o mover la lógica a `bin/sdd`.
- `code-resolved: tests/sdd.test.js` (fix post-021) — ya existe el helper `featureDir(id)` que resuelve `specs/<id>` o `specs/archive/*-<id>`, replicando `resolve_feature_dir`. El defecto 2 ya está mitigado para tests futuros.

## Block 1 — Comportamiento

### Q: Step 3 usa la taxonomía vieja para identificar Y dimensionar. ¿Cómo lo arreglás?
Recommended answer: Mover el grep de `## Domain rules` antes del Step 3, y que Step 3 identifique dominios con ese vocabulario. El dimensionamiento no cambia — sigue contando dominios, ahora módulos reales. Arregla de paso el fallback, que hoy apunta a findings del Step 4 inexistentes en el discovery-resume path.
> Mover el read de vocabulario antes del Step 3 (Recomendado)

### Q: ¿Dónde vive la validación post-archive, dado que el agente corre en haiku?
Recommended answer: En el orquestador. §F paso 3 pasa a nombrar archive explícitamente como NO exento de la validación ("skip if phase produces no code" es la rendija: archive no produce código, mueve archivos, y mover archivos rompe tests). El mecanismo y el presupuesto de reintentos ya viven ahí. Cero lógica nueva en haiku.
> En el orquestador, cerrando la rendija de §F (Recomendado)

## Block 2 — Scope técnico

### Q: ¿Dónde se arregla que el commit de archive incluya la mitad de borrado del move?
Recommended answer: Un flag `--moved-from` en `sdd commit-slice` que stagee explícitamente el borrado del path viejo. El agente pasa una ruta en vez de seis, es testeable con jest contra repo temporal, y el CLI puede silenciar el warning de directorio inexistente. Coherente con ADR 0002.
> Flag `--moved-from` en commit-slice (Recomendado)

## Block 3 — Contrato / datos

### Q: El test verifica `extract_section` y los consumidores grepean. ¿Cómo cerrás esa brecha?
Recommended answer: Subcomando `sdd domain-vocab` — los cuatro consumidores dejan de grepear y lo llaman; lee `conventions.md` § Domain rules e imprime el contenido, exit ≠0 si está vacío. El test ejercita entonces el camino exacto de producción, no uno adyacente. Mismo patrón que `base-branch`.
> Subcomando `sdd domain-vocab` (Recomendado)

### Q: Esto refina F1 de 021. ¿Lo formalizo en un ADR?
Recommended answer: Sí, ahora. Sin eso, en seis meses alguien lee F1 en el archive de 021 y `domain-vocab` en el código y concluye que uno de los dos es un error.
> Sí, crearlo ahora (Recomendado)
→ Creado en este turno: `docs/adr/0003-cli-resolves-content-agents-read-knobs.md`

## Block 4 — Riesgos técnicos

### Q: ¿Qué hace un consumidor si `sdd domain-vocab` no está disponible o falla?
Recommended answer: Degradar al scan, igual que sección vacía. Comando ausente, exit ≠0 o salida vacía se tratan igual — es el comportamiento de hoy cuando conventions.md está vacío, así que un CLI faltante degrada al estado actual en vez de bloquear.
> Degradar al scan, igual que sección vacía (Recomendado)

### Q: Si la validación post-archive falla, archive ya movió la carpeta y no se puede reintentar. ¿Qué hace el orquestador?
Recommended answer: Reportar blocked y no reintentar. Archive no es idempotente — su pre-flight exige `specs/<id>/spec.md`, que post-move no existe, así que un reintento daría un pre-flight fallido y confundiría el diagnóstico. El archivado en sí queda válido; lo roto son los tests.
> Reportar blocked, no reintentar (Recomendado)

## Block 5 — Acceptance + rollback

### Q: ¿La acceptance necesita un dogfood [HITL], o alcanza con los tests?
Recommended answer: Solo tests. A diferencia de 021, dos de los cinco arreglos son superficie de CLI real y se testean end-to-end. Y el archivado real de 022 ejercita ambos arreglos de archive sobre sí mismo.
> Solo tests — el propio archive es el dogfood (Recomendado)

### Rollback (code-resolved + Block 4)
Revertir el commit. La dependencia de `sdd domain-vocab` degrada sola por el fallback de AC4, así que un subcomando roto devuelve el pipeline al comportamiento pre-022 en vez de bloquear.

## Quality gate — validado por el usuario
Los 3 bloques (6 acceptance criteria en G/W/T, rollback, success metric doble) fueron presentados y el usuario respondió "ok" sin correcciones.
