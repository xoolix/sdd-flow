# Feature: 024 — Remove auto-PR

## Summary
`bin/sdd` deja de abrir PRs. Se borran `cmd_open_pr`, `build_pr_body_file`, `build_pr_title`, `append_decisions_capped`, `write_pr_opened_sentinel`, `PR_BODY_MAX_CHARS`, el sidecar `.pr-opened` y la fase `ready-to-pr`. El gate humano pasa a ser dos comandos impresos al archivar. Con eso `extract_section` pierde tres de sus cuatro consumidores, y el cuarto se resuelve mudando las domain rules a su propio archivo — así que el parser y la dependencia de Node también se van, y `bin/sdd` vuelve a ser shell puro.

## Trigger
`/archive-feature` al terminar (imprime los comandos), `sdd domain-vocab` (lee del archivo nuevo), y `sdd open-pr` al dejar de existir.

## Happy Path
1. `/archive-feature` archiva y, al cerrar, imprime `git push -u origin HEAD` y `gh pr create --draft --base <base>` con la base que devuelve `sdd base-branch <id>`. El pipeline termina ahí.
2. `sdd status` sobre un feature archivado devuelve `archived`; `ready-to-pr` no existe más.
3. `sdd domain-vocab` lee `.claude/rules/domains.md` entero, le saca los comentarios con el loop de `index()` que ya existe, y no extrae ninguna sección.
4. `sdd open-pr` no está en `usage()` ni en el dispatch.

## Domains
- `CLI surface` — borrar `cmd_open_pr`, `build_pr_body_file`, `build_pr_title`, `append_decisions_capped`, `write_pr_opened_sentinel`, `extract_section`, `PR_BODY_MAX_CHARS`; `detect_feature_phase` pierde la rama `ready-to-pr`; `usage()` y dispatch
- `Orchestration skills` — `sdd-next` Step 3a y su espejo en `sdd-auto`; `archive-feature` gana la impresión de comandos; `init-project` (lado de **escritura** de las domain rules) pasa a llenar `domains.md`
- `Rules layer` — `.claude/rules/domains.md` nuevo; `conventions.md` pierde `## Domain rules`; `git.md` y `.specify/templates/rules/git.md` pierden lo del gate
- `Artifact templates` — semilla de `domains.md` en `.specify/templates/rules/`; `spec-template.md` deja de apuntar a `conventions.md § Domain rules`
- `Test suite` — borrar `tests/extract-section.test.js` (39) y ~70 tests de `sdd.test.js`; agregar el barrido

## Edge Cases
- Un `.pr-opened` viejo en un repo ajeno queda huérfano: sin la lógica que lo lee, el feature es `archived` con o sin él. Se ignora.
- `sdd base-branch` falla al armar la línea del PR: imprimir el comando con la base sin resolver antes que no imprimir nada.
- `domains.md` ausente: `domain-vocab` sale 3 y los consumidores caen a su propio scan — el fail-open que el sistema ya tolera.
- `medical-chat` tiene `## Domain rules` con contenido real: pierde vocabulario hasta que se mueva a mano. No rompe, degrada al fallback.

## Acceptance Criteria
- [ ] Given `sdd open-pr <id>`, When se ejecuta, Then falla como comando desconocido y `usage()` no lo lista.
- [ ] Given `.claude/rules/domains.md` con contenido, When corre `sdd domain-vocab`, Then lo imprime y sale 0; y Given ausente o solo comentarios, Then sale 3 sin salida.
- [ ] Given un PATH sin Node, When corre un comando de `bin/sdd` que antes lo necesitaba (`sdd domain-vocab` con contenido), Then funciona y sale 0; y `grep -c 'node\|npx\|src/' bin/sdd` devuelve 0.
- [ ] Given que `/archive-feature` termina, When cierra, Then imprime los comandos de push y creación del PR con la base que resuelve `sdd base-branch <id>`.
- [ ] Given el repo después del cambio, When un test de barrido busca los diez símbolos eliminados en `bin/`, `src/`, `.claude/**`, `.specify/templates/**` y `tests/**`, Then no encuentra ninguno. **Excluye `docs/` y `specs/`**: el barrido protege contra una instrucción o llamada colgada, no contra una mención histórica — los ADRs y los specs archivados nombran lo que cambió porque ese es su trabajo.
- [ ] Given un feature archivado, When corre `sdd status <id>`, Then la fase es `archived` y `ready-to-pr` no existe.
- [ ] Given un proyecto recién inicializado, When corre `sdd init`, Then `.claude/rules/domains.md` existe desde la semilla, `conventions.md` ya no tiene `## Domain rules`, y ninguno de los dos filtra el vocabulario propio de este repo.

## Rollback Plan
- `git revert` del commit. Es un borrado: el revert restaura el código y la mudanza del archivo. Sin flag, sin migración que deshacer.

## Success Criteria
- `bin/sdd` no contiene ninguna referencia a `node`, `npx` ni `src/`, y sus comandos funcionan con Node ausente del PATH.
- Un grep de los diez símbolos sobre la superficie viva (`bin/`, `src/`, `.claude/**`, `.specify/templates/**`, `tests/**`) devuelve **cero**.

## Archivos que se borran enteros
`src/extract-section.js` (182 líneas) y `tests/extract-section.test.js` (39 tests).

## Sin migración
Decisión del usuario: nadie usa la versión que tenía `open-pr`, así que `cmd_update` no lleva código de migración. Sin ruta dual ni sección inerte en proyectos ajenos.

## Open Questions
- Ninguna. Los dos hallazgos altos del discovery se resolvieron acotando el alcance del barrido; ver `discovery.md`.
