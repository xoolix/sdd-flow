# Feature: 023 — Silent degradation fixes

## Summary
Cinco puntos donde la herramienta se degrada sin avisar, más lo que evita que vuelvan: `cmd_base_branch` no encuentra el sidecar de un feature archivado y autodetecta en silencio, `extract_section` trunca una sección al ver un `## ` adentro de un bloque de código, `commit-slice` se lleva ediciones ajenas del feature dir, `sdd-designer` descarta el vocabulario que ya le pasaron, y `/simplify-code` no filtra dos rutas de prosa. Los cinco salen exit 0 y producen un resultado incorrecto sin decirlo; el sexto ítem —cobertura por ejes de entrada en vez de por bug ya visto— es lo que impide que se repitan. El alcance llega hasta el commit: `cmd_open_pr` queda explícitamente afuera.

## Trigger
`sdd base-branch <id>` post-archive (y sus dos consumidores, `/simplify-code` y `sdd-cross-reviewer`), `sdd domain-vocab`, `sdd commit-slice`, `/simplify-code` y `sdd-designer` en su camino de discovery-resume.

## Happy Path
1. `cmd_base_branch` encuentra el sidecar también bajo `specs/archive/`, así que `/simplify-code` y `sdd-cross-reviewer` computan su rango de diff contra la rama correcta en un feature archivado.
2. `extract_section` trackea fences desde el inicio del archivo e ignora los `## ` que caen adentro.
3. `commit-slice` avisa qué archivos del feature dir venían stageados de antes, sin cambiar qué commitea.
4. `sdd-designer` usa el vocabulario que `plan-feature` paso 2.5 le pasó.

## Domains
- `CLI surface` — `cmd_base_branch` (capa 1 vía `resolve_feature_dir`), `extract_section`, `cmd_commit_slice`
- `Phase agents` — `sdd-designer.md` (fallback de vocabulario)
- `Orchestration skills` — `simplify-code` (lista de exclusión)
- `Test suite` — `tests/sdd.test.js`, reorganizado por ejes

## Edge Cases
- Feature-id que no resuelve ni a activo ni a archivado: debe caer a la capa 2, no abortar el proceso bajo `set -euo pipefail`.
- Fence abierto **antes** del heading buscado, y fence sin cerrar: ante la duda, cortar de menos.
- `cmd_base_branch` pasa de un consumidor (la terminal) a dos: no debe cambiar para el primero.
- Archivo del feature dir stageado a propósito por una decisión HITL: se avisa, no se descarta.

## Acceptance Criteria
- [ ] Given un feature archivado en `specs/archive/<fecha>-<id>/` cuyo `.parent-branch` nombra una rama existente, When corre `sdd base-branch <id>`, Then imprime esa rama y no la autodetectada.
- ~~AC2 (`open-pr` pasa `--base`, imprime procedencia, la registra en `.pr-opened`)~~ — **fuera de alcance**, decisión del usuario 2026-08-28. Numeración conservada a propósito.
- ~~AC3 (fallback a la rama por defecto del remoto cuando la resolución falla)~~ — **fuera de alcance**, mismo motivo.
- [ ] Given una línea `## ` adentro de un bloque con fences, When `extract_section` lee la sección, Then sigue de largo y corta recién en un heading real fuera de todo fence, tanto para `domain-vocab` como para el armado del cuerpo del PR (`build_pr_body_file`, que se sigue usando aunque `open-pr` no se toque).
- [ ] Given un archivo del feature dir ya stageado antes de correr `commit-slice`, When commitea, Then avisa nombrándolo y el contenido del commit no cambia.
- [ ] Given un diff que toca `.claude/agents/*.md` o `docs/adr/*.md`, When `/simplify-code` calcula su scope, Then quedan excluidos por la lista de filtros y no por criterio manual.
- [ ] Given que `plan-feature` paso 2.5 resolvió el vocabulario y se lo pasó, When `sdd-designer` corre en discovery-resume, Then usa el recibido y no cae a exploration findings inexistentes.
- [ ] Given los cuatro ejes de entrada (fin de línea; estructura del documento; resolución; estado del índice), When se revisa el suite, Then cada eje está recorrido entero, incluidos los valores que nunca fallaron.

## Rollback Plan
- `git revert` del commit. Todo es aditivo —un warning nuevo, una ruta de resolución extra, reglas de parseo— y no hay migración ni cambio de formato. Sin flag.

## Success Criteria
- Para un feature archivado con sidecar, `sdd base-branch <id>` devuelve la rama del sidecar y no la autodetectada — que es de donde `/simplify-code` saca su rango de diff.
- Cero secciones truncadas en silencio: ningún consumidor de `extract_section` sale 0 con contenido faltante.

## Unchanged (guardarraíl de regresión)
- `sdd base-branch <id>` a mano sobre un feature **no archivado**: mismo orden de capas, mismos exit codes 2 y 3.
- `cmd_open_pr` entero: no se toca en este feature.
- Lo que emite `sdd base-branch <id>` a secas — un ref pelado por stdout — porque `sdd-simplify-code.md:21,44` y `sdd-cross-reviewer.md:34` lo inlinean en argv.

## Open Questions
- Ninguna.
