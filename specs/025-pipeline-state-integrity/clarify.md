# Clarify — 025-pipeline-state-integrity

Fuente de los hallazgos: `research/hallazgos-verificados.md` (cross-review de codex, cada ítem
reproducido en vivo por mí en un clon descartable o confirmado leyendo el código — ninguno
aceptado por afirmación).

## 1. Comportamiento

`code-resolved` — los diez defectos fueron **reproducidos ejecutando**, no inferidos. El
comportamiento actual está medido, no supuesto:

| # | Antes hace (medido) | Después debe hacer |
|---|---|---|
| V1 | `commit-slice` con un archivo nuevo omitido de `--files` commitea parcial, exit 0, sin avisar (`bin/sdd:1022` filtra `^??`) | Falla ruidosa, o al menos avisa, cuando queda trabajo nuevo fuera del slice |
| V2 | `commit-slice ..` commitea todo el árbol sucio (`specs/..` = raíz) | Rechaza el id inválido antes de tocar el índice |
| V3 | `sdd branch B` parado en `feature/A` crea B desde A y no escribe `.parent-branch` | Registra el parentesco; rechaza apilar feature sobre feature sin decirlo |
| V4 | `commit-slice B` parado en `feature/A` commitea B sobre A, exit 0 | Verifica que la rama actual sea la de la feature |
| V5 | `auto-commit: off` encadena el no-op silencioso completo | El knob no existe; las fases commitean siempre |
| V6 | `.simplified` fresco con árbol editado sin commitear | El sentinel se invalida si el árbol cambió |
| V7 | `/sdd-next` re-corre review para siempre después de un PASS | Existe estado durable de "review pasó" |
| V8 | Existir `discovery.md` alcanza para saltear el checkpoint | Se exige una decisión por cada hallazgo alto |
| V9 | simplify commitea o destruye ediciones humanas previas en archivos en scope | Bloquea si un archivo en scope ya estaba sucio |
| V10 | `--minimal` se usa como parte del path antes de parsearse | Los flags se parsean antes de resolver paths |

Sub-comportamientos: ninguno con modos. Es un lote de correcciones, no una feature con variantes.

## 2. Scope técnico

`code-resolved` — el scan localizó cada sitio:

| Dominio (`sdd domain-vocab`) | Archivos |
|---|---|
| CLI surface | `bin/sdd` — `resolve_feature_dir` (~803), `cmd_commit_slice` (~934-1040), `cmd_branch`, la frescura del sentinel (~1107-1114), `cmd_status` |
| Phase agents | `sdd-implement-task.md:75`, `sdd-simplify-code.md:96` + step 2b, `sdd-archive-feature.md:46` |
| Orchestration skills | `plan-feature/SKILL.md:35-37`, `review-feature/SKILL.md` (pre-flight y §2) |
| Rules layer | `.claude/rules/git.md` (borrar el knob), `.claude/rules/domains.md` (menciona el knob) |
| Artifact templates | `.specify/templates/rules/git.md` (semilla) |
| Test suite | `tests/sdd.test.js` (~6 assertions del knob), `tests/retired-symbol-proofs.test.js` |

Reuso vs nuevo: todo reuso salvo dos piezas nuevas — el recibo de review de V7, y el harness
determinístico de la máquina de estados.

## 4. Riesgos técnicos

`code-resolved` — de la reproducción:

- **El pipeline muerde mientras se lo usa para arreglarse.** V1 va a dejar afuera los archivos
  nuevos que cree la implementación (y esta feature crea tests nuevos), y V3 va a apilar la rama
  sobre `feature/024-remove-auto-pr` sin sidecar. Hay que compensar las dos a mano hasta que sus
  propios fixes estén adentro. Es el riesgo operativo número uno.
- **Endurecer `commit-slice` puede romper el propio pipeline.** Si V1 pasa a fallar duro, cualquier
  fase que hoy omita un archivo empieza a bloquear. Puede destapar omisiones latentes.
- **Borrar el knob rompe tests que lo fijan** (~6 assertions) — esperado y parte del alcance.
- Edge cases medidos: id de feature con `..`; rama actual distinta de la de la feature; archivo en
  scope ya sucio antes de simplify; `discovery.md` presente con `## User decisions` vacío.

## 3. Contrato / datos

### Q: V7 necesita registrar "el review pasó" y V6 necesita que el sentinel se invalide cuando cambia el árbol, no solo HEAD. Los dos son el mismo problema: el estado de fase se infiere de archivos sueltos. ¿Qué forma le damos?
Recomendación: un archivo de estado único, porque arregla V6 y V7 con un mecanismo en vez de dos y le da a `sdd status` una sola fuente autoritativa — dos centinelas en paralelo con semánticas de frescura distintas es cómo aparece un tercero después.
**Un archivo de estado único**: `.sdd-state` reemplaza a `.simplified` por completo. Registra `phase`, `git-head`, `tree-digest`, `verdict` y `at`. `sdd status` lee SOLO ese archivo para derivar la fase. Gitignoreado, como el que reemplaza.

### Q: `.sdd-state` reemplaza a `.simplified`, y medical-chat tiene la feature 045 con un `.simplified` vivo. ¿Compatibilidad hacia atrás o corte limpio?
Recomendación: corte limpio. `.simplified` solo guarda `git-head`, sin digest del árbol, así que honrarlo como válido es reintroducir V6 — el bug que estamos arreglando.
**Corte limpio**. Sin shim y sin migrar 045 a mano. El `.simplified` de 045 queda huérfano y esa feature re-corre simplify una vez; es molesto, no destructivo (está gitignoreado). Cero código de migración, mismo criterio que en la feature 024.

## 5. Acceptance + rollback

### Q: El harness determinístico de la máquina de estados — correr plan→implement→simplify→review→archive verificando el estado persistido en cada transición — es lo único que evita que vuelva la próxima tanda. Pero es trabajo nuevo, no un fix. ¿Entra en 025?
Recomendación: sí. Los diez fixes sin el harness dejan el mismo agujero que los dejó entrar.
**Sí, entra**, y completo — las cinco transiciones, no solo las que estos diez defectos tocan.

`code-resolved` (rollback) — `git revert` de los commits de la feature. Es un framework de desarrollo
local sin runtime desplegado: no hay flag que apagar ni migración de datos que deshacer. El único
residuo son los `.sdd-state` que haya escrito la versión nueva, que quedan inertes por estar
gitignoreados — la misma forma que el corte limpio que se acaba de elegir.
