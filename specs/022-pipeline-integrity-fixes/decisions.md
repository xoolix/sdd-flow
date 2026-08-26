# Decisions

## Delta: 2026-08-26 — Alcance ampliado (decisión del usuario)
- **ADDED**: sexto arreglo — detección de specs terminados sin archivar. Hoy `sdd status` sin argumentos y fuera de una rama feature devuelve `error: not on a feature branch`; no hay forma de preguntar qué features quedaron sin archivar sin correrlo uno por uno. El pipeline rutea a archive después del review, pero si alguien para antes, nada avisa: `002-evaluator-optimizer-pipeline` estuvo terminada y sin archivar tres meses.
  **Principio que lo motiva (declarado por el usuario)**: cada spec terminado se archiva. No es solo higiene del repo — un spec viejo en `specs/` es contexto falso que el modelo lee como trabajo activo.
  Fix propuesto: `sdd status` sin feature-id lista todas las carpetas de `specs/` con su fase.

[2026-08-26T10:35:50Z] CLEANUP: cuatro carpetas de mayo (001, 002, 009, 018) movidas con `git mv` a `specs/archive/2026-05-17-<id>/`, usando la fecha de su último commit real. `specs/` queda solo con 020 (dogfood [HITL] pendiente), 022 (en curso) y `archive/`.

[2026-08-26T11:34:57Z] DISCOVERY-ACCEPTED: F2 — guard `git ls-files --error-unmatch` antes del `git add` en `--moved-from`.
[2026-08-26T11:34:57Z] DISCOVERY-ACCEPTED: F3 — lista explícita de fases no reintentables en §F de `sdd-phase-common.md`, replicada en los dos orquestadores. Descartado hardcodear archive y descartado un campo de frontmatter.
[2026-08-26T11:34:57Z] DISCOVERY-ACCEPTED: F12 — séptimo AC para la detección de specs sin archivar, vía `sdd status` sin feature-id.

## Delta: 2026-08-26 — Discovery Checkpoint
- **ADDED**: guard `git ls-files --error-unmatch` en `--moved-from`. El spec prometía "never a silent no-op" pero la forma nunca-trackeado-y-presente-en-disco hacía algo peor: staging silencioso como archivo nuevo.
- **ADDED**: lista de fases no reintentables en §F. El spec asumía que "archive no se reintenta" era una redacción; §F no tiene el concepto y hay que agregarlo.
- **ADDED**: AC7 y su superficie (`sdd status` sin feature-id). El sexto arreglo entró por delta después de que el spec se escribiera con seis AC.

[2026-08-26T11:35:50Z] SPEC-BUDGET: spec.md quedó en 799 palabras contra el tope de 650, tras dos pasadas de recorte. Con seis arreglos y ocho criterios de aceptación, los AC solos son ~250 palabras y recortarlos sacaría verificación. Cuarto spec consecutivo por encima del tope (020: 665, 021: 661, 022: 799) — el patrón sugiere que el budget no está calibrado para features que tocan contratos, o que la tabla de contrato debería vivir en plan.md.

## Delta: 2026-08-26 — Plan/tasks coherence review
- **MODIFIED**: `--moved-from` stagea con `git add -- "$path"`, NO con `git add -A -- "$path"`. El plan propuso `-A`, pero `tests/sdd.test.js` tiene un assert de feature 020 —`expect(codeOnly).not.toMatch(/git add (-A|--all)\b/)` dentro de `cmd_commit_slice`, filtrando comentarios— que la implementación rompería. Y el `-A` es innecesario: desde git 2.0 `git add <path>` stagea remociones, verificado en repo temporal (`git add -- specs/001-real` sobre un path trackeado y borrado sale 0 y stagea `D`). El guard `git ls-files --error-unmatch`, no la forma del `git add`, es lo que rechaza los paths nunca trackeados.
- **MODIFIED**: `tasks.md` T005 dice "fix step cross-refs (:37, :94, :96)", pero el plan eligió deliberadamente insertar un **Step 2.5** en vez de renumerar, precisamente para que `:37` y `:96` sigan siendo ciertas. Editarlas las volvería falsas. Solo cambian `:94` (back-pointer al 2.5 nuevo) y `sdd-designer.md:29` (ya cubierta por T006).
- **MODIFIED**: `sdd status` sin argumentos itera `specs/*/` **excluyendo `archive/`**, como dice el plan. `tasks.md` T003 decía "incl. `specs/archive/*`", que contradice el propósito de AC8: ver qué quedó SIN archivar. Listar 23 carpetas archivadas junto a 2 activas entierra la señal.

[2026-08-26T12:02:07Z] implemented-by: claude

## Delta: 2026-08-26 — Séptimo arreglo (agujero de 020 encontrado durante T002)
- **ADDED**: `commit-slice` commitea el ÍNDICE ENTERO, no solo los paths nombrados. `git add -- <files>` stagea lo pedido, pero el `git commit` posterior no lleva pathspec, así que arrastra cualquier cosa que ya estuviera stageada. Verificado en repo temporal: un archivo pre-stageado y nunca nombrado en `--files` entra igual al commit.
  **Por qué sobrevivió a 020, a 021 y a su propio review**: la garantía se formuló y se testeó como "never `git add -A`", que no es lo mismo que "solo entra lo nombrado". El test existente (`stages only --files plus the derived feature dir, leaving unrelated dirty files out`) siembra archivos SUCIOS y verifica que queden afuera; nunca siembra archivos STAGEADOS. Pasa en verde con el agujero abierto.
  **Impacto real ya observado**: en esta misma sesión, los implementers de T001 y T002 tuvieron que desestagear los 13 renames de la limpieza de mayo, commitear, y volver a estagearlos, para que no entraran en sus slices. Lo reportaron; un agente menos cuidadoso los habría commiteado en silencio.
  **Fix**: `git commit -- <paths>` con pathspec explícito — commitea exactamente esos paths e ignora el resto del índice, que queda stageado intacto. Más un test que siembre un archivo pre-stageado ajeno, no solo sucio.

[2026-08-26T12:41:00Z] T008 implementado. **ADDED** (más allá del texto de la delta anterior): el "post-commit safety net" (`git status --porcelain | grep -v '^??'`, bin/sdd:936) también leía el índice entero — con el commit ahora scoped, cualquier archivo ajeno legítimamente stageado dispararía `warning: tracked files still dirty after commit` en cada slice futura de este mismo repo (hay 13 renames de archivo pre-stageados en este momento). Se scopeó ese check a `commit_paths` también, mismo root cause, misma función. Verificado con la suite completa (66/66) y a mano: los 13 renames de mayo siguen stageados e intactos tras implementar y validar T008, sin ningún unstage/restage manual — la garantía que pedía la delta.
