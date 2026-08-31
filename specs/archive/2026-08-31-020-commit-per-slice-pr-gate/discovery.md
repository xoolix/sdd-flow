# Discovery Report
status: findings-present

Cuatro de estos son huecos del spec, no detalles de implementación. Cada uno lleva una recomendación
para que puedas decidir rápido. Para resolver: escribí tu decisión bajo `## User decisions` como
`DISCOVERY-ACCEPTED: <F#> — <decisión>` o `DISCOVERY-DISCARDED: <F#> — <razón>`, y re-corré
`/plan-feature 020-commit-per-slice-pr-gate`.

## High-impact findings

- **[conflict] F1 — El gate contradice al ADR 0002.** `spec.md` paso 7 dice que al confirmar se hace
  `push` + `gh pr create --draft`, pero no nombra ningún subcomando. `docs/adr/0002` afirma "All git
  writes go through `bin/sdd`", y `git push` es un git write. Encima ambos orquestadores llevan la regla
  "You are the ORCHESTRATOR — never read source code, never edit code"
  (`sdd-next/SKILL.md:227`, `sdd-auto/SKILL.md:195`). Hoy `bin/sdd` no tiene ni una invocación a `gh`.
  **Decisión requerida**: ¿subcomando nuevo `sdd open-pr <feature-id>` que haga pre-flight + push +
  `gh pr create --draft` (coherente con el ADR y testeable en jest), o `gh` inline desde el orquestador
  (menos superficie, pero rompe el ADR el mismo día que se escribe)?
  _Recomendación_: subcomando. Es la misma razón por la que `commit-slice` es CLI y no prosa — el
  pre-flight de `gh auth status` + remote y el "no escribas `.pr-opened` si falló" son lógica
  condicional que no querés como instrucción markdown. El orquestador queda solo con la pregunta.
  [impact: high]

- **[edge-case] F2 — El contrato de `commit-slice` se rompe en archive.** La fila de API dice que el
  comando stagea siempre "the listed paths **plus** `specs/<id>/`". Pero `sdd-archive-feature.md:39-42`
  mueve la carpeta a `specs/archive/YYYY-MM-DD-<id>/` ANTES de que ningún commit pueda correr, así que
  ese path ya no existe. El spec no define override.
  **Decisión requerida**: ¿`commit-slice` acepta un `--spec-path` explícito que archive usa, o archive
  invoca otra forma (p. ej. `--files` con el path del archive y sin el add implícito de `specs/<id>/`)?
  _Recomendación_: que el add implícito de `specs/<id>/` sea derivado, no hardcodeado — el CLI resuelve
  el directorio del feature igual que hace `cmd_status` (`bin/sdd:756-778`: primero `specs/<id>`, si no
  `find specs/archive -name "*-<id>"`). Así archive no necesita caso especial y el contrato queda uno solo.
  [impact: high]

- **[edge-case] F10 — No existe precedente de self-revert ni campo de commit en el envelope.**
  `sdd-implement-task.md` solo desmarca una task por el path externo `FORCE_TASK_ID` (Step 3, líneas
  106-112), y eso ocurre ANTES de implementar. El AC4 pide revertir `[x]` → `[ ]` en la misma
  invocación, que es lógica simétrica nueva. Además ni el envelope del agente (líneas 174-187) ni el
  compartido (`_shared/sdd-phase-common.md:56-65`) tienen campo para el SHA.
  **Decisión requerida**: ¿el campo de commit se agrega al envelope compartido (lo heredan todas las
  fases, incluida simplify y archive) o solo al de `implement-task`?
  _Recomendación_: al compartido. Las tres fases que commitean necesitan reportarlo, y el orquestador
  necesita leerlo uniformemente para el resumen final.
  [impact: high]

- **[conflict] F13 — `git.md:7-8` afirma lo contrario del feature.** "Never commit or push. Leave all
  changes unstaged for manual review." / "The human handles commits, merges, and PRs." Hay que
  reescribir esas dos líneas, no extenderlas.
  **Nota mía sobre la clasificación**: el evaluador lo marcó high argumentando que "los orquestadores
  deben aprobar el cambio de política". Eso ya está decidido — vos lo elegiste y quedó registrado en
  `docs/adr/0002`. Lo que queda es mecánico: reescribir `git.md:7-8` y agregar el knob `auto-commit:`
  siguiendo la ubicación de `testing.md:26-27` (línea comentada al final del archivo). Lo dejo listado
  como high por fidelidad al evaluador, pero lo trataría como medium salvo que veas algo más.
  [impact: high]

## Other findings

- [simplification] F3 — Las dos tablas de detección de fase ya estaban desincronizadas antes de este feature: `CLAUDE.md:106-122` tiene fila de `/archive-feature`, `sdd-next/SKILL.md:53-64` no. Y `ready-to-pr` es una categoría que no entra en el schema de columnas actual (Lane | Artifacts | All tasks | Fresh `.simplified`). [impact: medium]
- [edge-case] F4 — Post-archive el feature-id ya no resuelve a `specs/<id>/`. El gate no puede usar los checks de existencia de archivo que usa la tabla hoy; tiene que ir por `sdd status <id>`, que resuelve el path de archive vía `find` (`bin/sdd:766-771`). [impact: medium]
- [edge-case] F8 — La creación de branch es prosa muerta: `git.md:6` la manda, pero no hay `git checkout -b` en ningún lado. El paso 1 del happy path es trabajo nuevo, y su forma depende de cómo se resuelva F1. [impact: medium]
- [reuse] F11 — La propagación de `type:` toca 4 archivos, no 2: además del template y el planner, `sdd-implement-task.md:34-39` (doc del lado consumidor + el parser del Step 3 tiene que capturarlo) y `:90-98` (las tasks de review-fix auto-generadas no emiten `type:` — necesitan default `fix` o fallback). [impact: medium]
- [edge-case] F12 — Ningún flag de `bin/sdd` toma valor hoy; `cmd_init` parsea solo booleanos. `--task Tnnn --files a.js b.js c.js` no tiene precedente. Y conviven dos idiomas de exit code: `err "..."; exit 1` vs `printf 'error:' >&2; return N` con códigos graduados. [impact: medium]
- [edge-case] F5 — `makeTempProject()` (`tests/sdd.test.js:9-20`) no setea `user.email`/`user.name`; hereda el config global de la máquina. Cualquier test que commitee es dependiente del entorno y falla en CI limpio — justo el edge case que el spec declara. [impact: medium]
- [edge-case] F9 — `sdd-archive-feature` corre en `model: haiku` y hoy hace `mv` puro sin conciencia de git. Meterle commit + manejo de fallo pone razonamiento condicional de git en el modelo más débil del pipeline. [impact: medium]
- [edge-case] F7 — `.pr-opened` NO debe ir a `.gitignore` (es registro durable de la URL); `.simplified` SÍ. Los tres sidecars existentes están todos ignorados, así que el error por analogía es fácil. [impact: low]
- [edge-case] F6 — Ningún test asserta exit code distinto de cero ni toca estado de git. El AC3 necesita un patrón `try/catch` + `error.status` que no existe en el suite. [impact: low]

## User decisions

- **DISCOVERY-ACCEPTED: F1** — Subcomando nuevo `sdd open-pr <feature-id>`. Hace el pre-flight
  (`gh auth status` + remote existe), y solo si pasa: push + `gh pr create --draft` + escribir
  `.pr-opened`. Si el pre-flight falla: no pushea, imprime el comando manual, exit ≠0, y NO escribe el
  sentinel. El orquestador queda únicamente con la pregunta de confirmación. Coherente con ADR 0002
  ("all git writes go through bin/sdd") y con la regla "never edit code" de ambos orquestadores.

- **DISCOVERY-ACCEPTED: F2** — El `add` implícito del directorio del feature es **derivado, no
  hardcodeado**. `commit-slice` resuelve el dir con la misma lógica que `cmd_status` (`bin/sdd:756-778`):
  primero `specs/<id>`, y si no existe, `find specs/archive -maxdepth 1 -type d -name "*-<id>"`.
  Archive no necesita invocación especial; queda un solo contrato para las tres fases que commitean.

- **DISCOVERY-ACCEPTED: F10** — El campo de commit se agrega al **envelope compartido**
  (`_shared/sdd-phase-common.md` §D), no solo al de `implement-task`. Las tres fases que commitean lo
  reportan y el orquestador lo lee de forma uniforme para el resumen final.

- **DISCOVERY-ACCEPTED: F13** — Tratado como mecánico: reescribir `git.md:7-8` (no extender) y agregar
  el knob `auto-commit: on|off` siguiendo la ubicación de `testing.md:26-27` — línea comentada al final
  con su comentario instructivo. La decisión de política ya está registrada en `docs/adr/0002`.
