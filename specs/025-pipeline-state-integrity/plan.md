# Technical Plan — 025 pipeline-state-integrity

## Inputs
`spec.md` (12 AC) · `clarify.md` · `discovery.md` · `decisions.md` · `research/hallazgos-verificados.md`.

## Domain analysis
CLI (`bin/sdd`) y tests **LARGE**; phase agents y skills MEDIUM; rules + templates SMALL. Total LARGE → secuencial con checkpoints, **V1→V2→V3→V4 primero** (orden de `tasks.md`): endurecen la herramienta que commitea el resto. Ningún orden protege al *primer* slice — su commit lo hace la herramienta rota, y se compensa a mano.

## Current state
El estado de fase se infiere de archivos sueltos y ninguna escritura valida su entrada: los chequeos de `commit-slice` corren **después** del commit y filtrando untracked; `resolve_feature_dir` no valida su argumento y su salida alimenta el `git add --`; `cmd_branch` no registra el padre; `.simplified` se ata solo a HEAD, `bin/sdd` únicamente lo lee y no existe estado de "review pasó"; `IGNORED_DIRTY` no ve un archivo en scope **y** sucio, con lo que la garantía de `sdd-simplify-code.md:40` es falsa hoy; `review-feature` usa `$ARGUMENTS` crudo antes de parsear flags. `auto-commit`: 13 sitios (3 vivos, 5 ilustración del ADR 0003, 5 prosa de envelope). Líneas exactas abajo.

## Proposed design
`.sdd-state` (`specs/<id>/`, gitignoreado) reemplaza a `.simplified`. Cinco campos, sin `files:`:

```
phase: ready-to-review | reviewed
git-head: <sha>
tree-digest: <sha>
verdict: PASS | PASS-WITH-WARNINGS | FAIL | none
at: <ISO-8601>
```

`tree-digest`: `GIT_INDEX_FILE=$tmp git add -A` + `write-tree`, índice temporal. **Rechazados, no reabrir**: `git stash create` (SHA distinto por llamada) y `write-tree` sobre el índice real (devuelve el árbol viejo en silencio). `sdd state-write <id> --phase <p> [--verdict <v>]` implementa el digest una sola vez.

**Cerrado acá**: `sdd branch` hace `mkdir -p` y escribe el sidecar **siempre** —está gitignoreado y git no trackea dirs vacíos, así que no genera `??` que trabe el commit-slice endurecido—, y avisa en stderr si apila sobre otra `feature/*`; exit `2` para id inválido y archivo no declarado, `4` para rama equivocada; `auto-commit` **no** entra a `RETIRED_SYMBOLS`; ADR 0003 se corrige en una línea, sin ADR nuevo.

## Touched areas

| Module / path | Change |
|---|---|
| `bin/sdd:1013-1031` → antes de `:1005` | V1: pre-commit, `--porcelain` sin filtrar, exit 2, sin commit. Conservar el set-difference awk contra `pre_staged`; el warn `:907-926` no se toca |
| `bin/sdd:803-816`, `:799` | V2: `validate_feature_id` (`..`, `/`, vacío, `-*`) antes del índice; docstring a tres call sites |
| `bin/sdd:762-793` | V3: base + `mkdir -p` + `.parent-branch` + aviso |
| `bin/sdd:890` | V4: rama actual == `feature/<id>` o exit 4 |
| `bin/sdd:1039-1160` | V6/V7: leer `.sdd-state`, comparar HEAD **y** digest; `reviewed` al enum y al `case` `:1140-1149`; reusar `((x++)) \|\| true` |
| `bin/sdd` (nuevo) | `cmd_state_write` + `tree_digest`, **más `usage()` y el dispatch** |
| `.gitignore:5` | `.simplified` → `.sdd-state` |
| `sdd-simplify-code.md` | V9: bloqueo tras `:57` y antes del paso 4; `:113-134` → `.sdd-state`; corregir `:40` |
| `review-feature/SKILL.md` | V10: flags primero, id limpio hacia §I (**§I no se toca**: 4 skills la comparten); `.sdd-state` en Step 4 **y** en judge-FAIL, aun con `Status: blocked` |
| `plan-feature/SKILL.md:35-37` | V8: exigir ≥1 `DISCOVERY-ACCEPTED/DISCARDED` (forma débil) |
| `sdd-archive-feature.md` | Exigir `phase: reviewed` + veredicto de paso antes del `mv` |
| `sdd-implement-task.md:73-75`+`:177`, `sdd-simplify-code.md:96`, `sdd-archive-feature.md:46` | Knob vivo: borrar |
| `sdd-designer.md:26`, `sdd-research-spike.md:38`, `plan-feature/SKILL.md:100`, `new-feature/SKILL.md:172`, `rules/domains.md:6` | Ilustración del ADR 0003 → `tdd:` |
| `sdd-implement-task.md:204`, `sdd-simplify-code.md:151`, `sdd-archive-feature.md:98`, `sdd-phase-common.md:65`+`:72` | Prosa de envelope: soltar un disyunto |
| `rules/git.md` + `.specify/templates/rules/git.md`, `docs/adr/0003` | Borrar la definición del knob (los dos `git.md`, mismo commit); ADR en una línea |
| `sdd-next/SKILL.md:63` | Fila `reviewed` con el patrón de la fila `archived`; `sdd-auto` la hereda |

## Data flow
`sdd branch` → `.parent-branch` → `cmd_base_branch` → scope de simplify. simplify OK → `state-write --phase ready-to-review`; `detect_feature_phase` compara HEAD **y** digest; review → `state-write --phase reviewed --verdict <v>` → `status: reviewed`, next = archive, que exige ese recibo antes del `mv`. Editar sin commitear cambia el digest: la fase retrocede.

## Migration / rollout
**Corte limpio, sin shim**: `.simplified` deja de leerse y escribirse en el mismo commit; honrarlo sin digest sería reintroducir V6. El de medical-chat/045 queda huérfano y re-corre simplify una vez. Rollback = `git revert`; los `.sdd-state` quedan inertes (gitignoreados).

## Observability
`N/A — framework local sin runtime desplegado.` La señal es `sdd status`/`sdd doctor` y el suite.

## Test strategy
- **CLI** (`sdd.test.js`): un repro por V1-V4, V6, V7 con `execFileSync` sobre `makeTempProject()` (`:9-24`) + `seedCommit()` (`:27-30`); la suite ejecuta la CLI, no sourcea funciones. Invertir `:2175/2209/2211`, que hoy exige lo contrario (semilla: `bin/sdd:225-237`).
- **Harness** (`tests/state-machine.test.js`, nuevo): ocho fases `missing→archived` con fixtures que imitan lo que cada fase deja atrás. Afirma las **lecturas** de `detect_feature_phase`, incluida la rama de frescura hoy sin cobertura; **no** ejecuta ninguna fase —prosa que corre un LLM—, límite declarado en el comentario de cabecera como en `sweep-retired-symbols.test.js`. Sin config de jest: timeout explícito, 5000ms no alcanzan.
- **Prosa** (V5, V8-V10): grep sobre los `.md`. AC5 = `grep -rn` en cero, con la aguja armada en runtime (`['auto','commit'].join('-')`) o el test se auto-encuentra.
- `retired-symbol-proofs.test.js:74`, su pin en `sweep-retired-symbols.test.js:263` y el `testCallCount === 5`: mismo commit.

## Risks and mitigations

| Riesgo | Mitigación |
|---|---|
| **El pipeline muerde mientras se lo usa para arreglarse**: V1 dejará afuera los archivos nuevos de esta implementación; V3 ya apiló sobre `feature/024-remove-auto-pr` sin sidecar | A mano hasta que sus fixes entren: `git add` explícito de lo nuevo, `git show --stat` por slice, `.parent-branch` escrito ahora. V2/V1/V4 primero acorta la ventana |
| `commit-slice` duro destapa omisiones latentes | Deliberado; el primer slice mide el daño con el suite |
| Un escritor sin migrar deja `sdd status` mudo | El harness lo pone rojo |
| Los 5 sitios de ilustración no tienen test · 7 hallazgos de codex sin verificar | La assertion literal del AC5 los cubre · se arreglan solo si reproducen |
