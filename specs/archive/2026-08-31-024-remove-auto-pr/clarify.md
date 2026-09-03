# Clarify — 024-remove-auto-pr

## Block 1 — Comportamiento

### code-resolved (scan, no preguntado)
- `detect_feature_phase` (`bin/sdd`) distingue `archived` de `ready-to-pr` **solo por la existencia de `.pr-opened`**. Sacando el sidecar, la distinción de fase desaparece sola — no hay lógica adicional que desarmar.
- El gate vive en `.claude/skills/sdd-next/SKILL.md` Step 3a (~10 líneas de prosa) y su espejo en `sdd-auto`. Es lo único a reescribir del lado de los orquestadores. `sdd-archive-feature.md` no menciona el PR en ningún lado.
- `.claude/rules/conventions.md` nombra `open-pr` dentro de su propia sección `§ Domain rules` ("CLI surface — subcomandos de bin/sdd: init, branch, commit-slice, open-pr, status, update"), así que el vocabulario de dominio del repo queda desactualizado por este cambio.
- `.specify/templates/rules/git.md` (semilla para proyectos nuevos) también lo menciona.

### Q: Sacar `.pr-opened` no borra un archivo, borra un ESTADO: hoy el pipeline distingue "archivado con PR abierto" de "archivado sin PR", y de ahí salen el `ready-to-pr` de `sdd status` y la pausa de `sdd-next`. Sin el sidecar, archivado es archivado y nadie registra si el PR se abrió. ¿Qué pasa después de archivar?
Recommended answer: que `/archive-feature`, al terminar, imprima los dos comandos ya resueltos —con la base real que devuelve `sdd base-branch <id>`, que 023 arregló justamente para que funcione post-archive— y ahí termine el pipeline. Sin estado nuevo, sin `ready-to-pr`. Archivar es el momento en que el humano está mirando la salida. Lo que se pierde —saber si el PR se abrió— no se pierde en serio: lo sabe GitHub y lo sabe el humano; registrarlo en un sidecar era ceremonia que además había que mantener y que originó la distinción de fases que ahora hay que desarmar. Lo que SÍ se pierde de verdad: `sdd-next` deja de tener algo que hacer después de archivar — el pipeline termina en archive y el PR queda fuera del flujo.
ok

## Block 2 — Scope técnico

### code-resolved (scan)
Todos los consumidores de vocabulario llaman al COMANDO `sdd domain-vocab`, ninguno lee `conventions.md` directamente — `plan-feature/SKILL.md:54,100`, `sdd-designer.md:26`, `sdd-research-spike.md:38`, `new-feature/SKILL.md:172`. El ADR 0003 lo declara: "la CLI resuelve contenido, el agente lee knobs". ⇒ **de dónde lee la CLI es interno y libre de cambiar.**
La sección `## Domain rules` de este repo son 8 líneas de bullets, con cero fences.

### Q: Con open-pr afuera, `extract_section` queda con un solo consumidor (`cmd_domain_vocab`), y con él 182 líneas de `src/extract-section.js`, 39 tests y la dependencia de Node que `bin/sdd` no tenía antes de 023. ¿Qué hacemos? (El usuario ya había respondido "sacamos la dependencia y todo".)
Recommended answer: darle a las domain rules su propio archivo (`.claude/rules/domains.md`) y **borrar `extract_section` entero**. Sin sección que extraer no hay parser: `domain-vocab` lee el archivo completo, le saca comentarios con el loop de `index()` que ya existe y está correcto (10 líneas de awk), y `bin/sdd` vuelve a shell puro. Es el mismo movimiento de toda la sesión aplicado en serio — no parsear mejor, sacar la necesidad de parsear. `open-pr` ya se lleva tres de los cuatro call sites; esto se lleva el cuarto.
DESCARTADO explícitamente: volver a awk con la gramática de CommonMark (es la trampa que costó seis defectos), y leer los dos lugares durante una transición (mantiene el parser vivo sin ganar nada).
Migración: `sdd update` mueve la sección de `conventions.md` a `domains.md`. Los proyectos que no corrieron `update` todavía: `domain-vocab` sale 3, y los consumidores caen a su propio scan — el fail-open que el sistema ya tolera por diseño, sin ruta dual ni segunda superficie de bug.
vamos

## Block 3 — Contrato / datos

### code-resolved (scan)
- Los `.pr-opened` viejos de otros proyectos quedan huérfanos pero **inocuos**: hoy `archived` vs `ready-to-pr` sale de si ese archivo existe; sin esa lógica un feature archivado es `archived` con o sin sidecar, y los archivos sobrantes se ignoran.
- El contrato de `sdd domain-vocab` NO cambia: mismo stdout, mismos exit codes. Solo cambia de dónde lee, que es interno (ADR 0003).
- `cmd_update` refresca symlinks de skills/agents/CLAUDE.md pero **no toca el contenido de `.claude/rules/*`** — las rules son customización del proyecto, y el feature 021 creó una semilla pristina para `init`, no para `update`.

### Q: Sacar `sdd open-pr` rompe la superficie pública de la CLI. ¿Remoción dura, o un stub que imprima los comandos manuales?
Recommended answer: remoción dura — sale de `usage()` y del dispatch, y quien lo tipee recibe el "unknown command" estándar. El stub cuesta cinco líneas y convierte un error confuso en la instrucción correcta, pero **un subcomando que "ayuda" vive para siempre y deja ambiguo si la feature existe**; dentro de seis meses alguien lo ve en el dispatch y duda. Si el objetivo es simplificar, la remoción tiene que leerse como remoción. El lugar para avisar es la salida de `sdd update`, que es lo que el usuario corre al actualizar.
si, dura

## Block 4 — Riesgos técnicos

### Q: `cmd_update` no toca el contenido de `.claude/rules/*` por diseño (las rules son customización del proyecto; 021 hizo semilla pristina para `init`, no para `update`). ¿Cómo migramos las domain rules a `domains.md` sin romper ese límite? Opciones: crear el archivo nuevo y dejar la sección inerte en `conventions.md` avisando, o que `update` haga la mudanza completa.
Recommended answer: crear `domains.md` si no existe y dejar `conventions.md` intacto, avisando en la salida de `update` que la sección quedó inerte — no destructivo, respeta el límite, aunque deja una sección que ya nadie lee (justo lo que el CLAUDE.md de este repo persigue).
nadie esta usando la version quye tenia open-pr, asi que no importa el update. lo sacamos

⇒ **Sin migración.** No se escribe código de migración en `cmd_update`, no hay ruta dual, no queda sección inerte en ningún proyecto ajeno. El riesgo que ocupaba este bloque desaparece con el alcance.

### Consecuencia registrada (no es riesgo del feature, es del entorno del usuario)
`medical-chat` tiene `## Domain rules` con contenido real (filtro temporal por defecto, `DISTINCT ON (protocolo_eges)`, cálculo de SLA, zona horaria). Tras 024, `sdd domain-vocab` ahí devuelve vacío hasta que esas líneas se muevan a `.claude/rules/domains.md`. Los consumidores caen a su propio scan — el fail-open de diseño — así que no rompe nada, pero el vocabulario se pierde hasta que se mueva. Mover a mano, dos minutos.

### Riesgo que queda, el único real
Borrar ~380 líneas repartidas en `bin/sdd`, `src/`, dos SKILL.md de orquestador, `CLAUDE.md`, dos `git.md`, `conventions.md` y los tests: el riesgo no es borrar de más sino **borrar de menos** y dejar una referencia colgando a un símbolo que ya no existe.

## Block 5 — Acceptance + rollback

### code-resolved (rollback)
Feature de borrado: `git revert` del commit restaura el código y la mudanza del archivo. Sin flag, sin migración que deshacer (el usuario descartó la migración).

### Q: ¿Cómo se verifica un borrado? El riesgo no es borrar de más sino borrar de menos y dejar una referencia colgando. Propuse un test de barrido sobre los diez símbolos eliminados, más cuatro comportamientos ejercitables contra el binario real (unknown-command; domain-vocab desde el archivo nuevo; la suite entera con Node fuera del PATH; archive imprimiendo los comandos con la base resuelta).
Recommended answer: esos cinco. El del barrido es el que más importa: es la única forma de que "está completo" sea verificable en vez de una afirmación. Toda esta sesión giró alrededor de arreglos que cerraban el caso reproducido mientras el siguiente quedaba al lado; en un borrado ese fallo se ve exactamente como una referencia huérfana que nadie buscó. Un grep que falla es el oráculo externo que faltó en 023.
van

### Q (quality gate): se presentaron las 6 GWT, los archivos que se borran enteros, el rollback, las dos success metrics y la oferta de ADR.
Recommended answer: —
dale
