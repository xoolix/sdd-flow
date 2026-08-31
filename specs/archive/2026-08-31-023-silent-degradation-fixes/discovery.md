# Discovery Report
status: findings-present

## High-impact findings

> **RESUELTO por recorte de alcance (2026-08-28).** El usuario sacó `cmd_open_pr` del feature: el alcance llega hasta el commit. Sin `open-pr` no hay a quién pasarle la procedencia, así que el conflicto desaparece en vez de resolverse. Se caen con él F4 (rama de PR ya abierto), F5 (rama por defecto del remoto) y F10 (`manual:` sin `--base`), y F6 (andamiaje de `gh`) deja de ser necesario. El hallazgo queda escrito porque vuelve a aplicar el día que `open-pr` entre en alcance.

- [conflict] **AC2 pide procedencia; el guardarraíl Unchanged prohíbe tocar stdout.** AC2 exige que `open-pr` imprima la base y de qué capa salió, y que registre las dos en `.pr-opened`. Pero la sección `## Unchanged` protege lo que emite `sdd base-branch <id>` a secas, y con razón: dos consumidores de prosa lo inlinean directo en argv — `.claude/agents/sdd-simplify-code.md:21,44` (`BASE_BRANCH=$(sdd base-branch "$ARGUMENTS")`, no-cero ⇒ blocked) y `.claude/agents/sdd-cross-reviewer.md:34` (`--base $(sdd base-branch <id>)`). Hoy `cmd_base_branch` devuelve solo el ref por stdout y no existe en todo el archivo un precedente de función que reporte valor **y** procedencia. El spec no dice cómo reconciliarlo. `cmd_open_pr` vive en el mismo archivo, así que puede llamar a la función en proceso (mismo patrón que `bin/sdd:1162`), y existe el precedente de `detect_feature_phase` comunicando por variable global (`PHASE_RESULT`, ~`bin/sdd:1231`) — pero elegir entre eso y una opción de CLI es decisión de diseño, no de implementación. [impact: high]

## Other findings

- [edge-case] F1: `resolve_feature_dir` (`bin/sdd:798-814`) termina en un pipe sin proteger y `bin/sdd:2` tiene `set -euo pipefail`; los tres llamadores existentes lo envuelven en `if`/`if !` (`:885`, `:1162`, `:1415`). Un assignment sin guarda en la nueva capa 1 convierte "sin sidecar ⇒ seguir a capa 2" en un aborto del proceso. Reproducido en vivo. Alcanzable de verdad: `specs/archive/003-plan-discovery-checkpoint` y `004-adversarial-review-agent` preceden al prefijo `YYYY-MM-DD-` y el glob no los matchea. [impact: medium]
- [edge-case] F2: `tests/sdd.test.js:1810-1827` afirma `toContain("derive names from the exploration findings provided")` — exactamente la frase que AC7 tiene que borrar de `sdd-designer.md:25`. El test fija el bug; hay que editarlo en el mismo slice. [impact: medium]
- [edge-case] F4: la rama de "ya hay un PR abierto" (`bin/sdd:1196-1203`) devuelve la URL existente y escribe el sentinel sin resolver base ni imprimir nada. Unchanged protege "no duplicar", pero calla sobre si ahí también hay que registrar base y procedencia. Tal como está, la promesa de AC2 no se cumple en ese camino. [impact: medium]
- [simplification] F5: AC3 necesita código que no existe — cero ocurrencias de `git symbolic-ref refs/remotes/origin/HEAD` o `gh repo view --json defaultBranchRef`. Además las capas 1 y 2 hoy hacen `return 2` y **se niegan** a seguir de largo cuando un ref configurado no resuelve; AC3 invierte ese contrato desde el llamador. [impact: medium]
- [edge-case] F6: no hay andamiaje para testear `gh`. Todos los tests de `open-pr` (`tests/sdd.test.js:1424-1620`) ejercitan solo ramas de pre-flight o llaman helpers por source-and-call. Verificar que `gh pr create` recibe `--base <resuelta>` y que el fallback abre el PR igual necesita un `gh` falso en el PATH. No existe. [impact: medium]
- [edge-case] F7: `cmd_base_branch` no tiene **ningún** test en las 98 pruebas, pese a implementar tres capas. El guardarraíl de AC1 no tiene hoy nada que lo sostenga. [impact: medium]
- [edge-case] F8: `feature_dir` es absoluto (`bin/sdd:884`) y las entradas de `pre_staged` (`:897-898`) son relativas a la raíz del repo. Un prefix match ingenuo no matchea nunca y el warning de AC5 nacería muerto. Reproducido en vivo; `bin/sdd` no hace `cd` fuera de subshells, así que sacar `"$(pwd)/"` es seguro. [impact: medium]
- [edge-case] F9: la redacción de AC4 es ambigua entre un booleano compartido y dos independientes para ` ``` ` y `~~~`. Con uno compartido, un `~~~` literal adentro de un bloque abierto cierra el estado y un `## ` posterior corta de más — lo contrario del criterio "ante la duda, cortar de menos". Dos toggles no cuestan nada extra en awk. [impact: medium]
- [edge-case] F13: la cobertura por ejes es más fina de lo que asume AC8. Fin de línea: **parcial** (CRLF solo para `cmd_domain_vocab`; los tests del cuerpo del PR usan `writeMinimalSpec`, que es LF puro). Estructura del documento: **cero**, ningún test escribe un fence en ninguna fixture. Resolución: **cero** (ver F7). Estado del índice: **parcial**, los dos tests existentes stagean *afuera* del feature dir y ninguno adentro, que es justo lo que AC5 necesita. AC8 es escritura nueva, no reorganización. [impact: medium]
- [simplification] F10: el `manual:` de `bin/sdd:1158` no lleva `--base`, así que quien lo copie tras un fallo de pre-flight recrea el defecto que este feature arregla. No está en el spec. [impact: low]
- [reuse] F11: la lista de exclusiones de AC6 vive en `.claude/agents/sdd-simplify-code.md:51-56`, no en el SKILL.md (que es un router de 15 líneas). Ningún test fija su redacción, así que la edición es limpia. El spec dice tres pasadas manuales; `decisions.md` muestra **cinco**. [impact: low]
- [edge-case] F12: `sdd-simplify-code.md:21,44` shellea `sdd base-branch`, así que el arreglo de AC1 cambia solo lo que `/simplify-code` toma como scope en un feature archivado, sin editar ese archivo. Dos grupos de AC tocan un comportamiento por caminos distintos. [impact: low]

## User decisions

- DISCOVERY-DISCARDED — el conflicto AC2/Unchanged sobre la procedencia: se elimina recortando `cmd_open_pr` del alcance, no resolviéndolo. AC2 y AC3 quedan fuera; su numeración se conserva a propósito para no dejar referencias colgando (lección de 022).
- DISCOVERY-DISCARDED — F4, F5, F10: dependían de `open-pr`, se caen con el recorte.
- DISCOVERY-DISCARDED — F6 (`gh` falso en el PATH): ya no hace falta, no se testea creación de PR.
- DISCOVERY-ACCEPTED — F1: la nueva capa 1 usa el mismo idiom `if ! feature_dir="$(resolve_feature_dir ...)"` que los tres llamadores existentes. Sin eso, un feature-id irresoluble aborta el proceso.
- DISCOVERY-ACCEPTED — F2: `tests/sdd.test.js:1810-1827` se edita en el mismo slice que `sdd-designer.md:25`. El test fija hoy el texto con el bug.
- DISCOVERY-ACCEPTED — F7: `cmd_base_branch` no tiene tests; AC1 los trae, y son también el eje "resolución" de AC8.
- DISCOVERY-ACCEPTED — F8: normalizar `feature_dir` a relativo antes de comparar contra `pre_staged`, o el warning de AC5 nunca dispara.
- DISCOVERY-ACCEPTED — F9: dos toggles independientes para ` ``` ` y `~~~`, no uno compartido.
- DISCOVERY-ACCEPTED — F13: AC8 es escritura nueva de tests, no reorganización. Dimensionarlo así en `tasks.md`.
- DISCOVERY-ACCEPTED — F11: la lista de exclusiones se edita en `.claude/agents/sdd-simplify-code.md:51-56`; ningún test fija su redacción.
- DISCOVERY-ACCEPTED — F12: no hace falta tocar `sdd-simplify-code.md` para que su scope mejore; lo hereda del arreglo de AC1.
