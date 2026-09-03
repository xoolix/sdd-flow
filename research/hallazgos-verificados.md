# Cross-review codex — hallazgos VERIFICADOS por mí (2026-08-31)

Fuente: `codex exec` sandbox read-only sobre test-sdd @ 7b61d89.
Cada ítem abajo lo reproduje en vivo o lo leí en el código. Los que codex reportó
y NO reproducen están al final.

## Reproducidos ejecutando (clon descartable)

### V1 — commit-slice deja archivos NUEVOS afuera del commit, en silencio, exit 0  [HIGH]
`bin/sdd:1022`. El chequeo post-commit hace `grep -v '^??'`, descartando untracked.
Repro: crear app.js + helper.js, declarar solo `--files app.js` → commitea app.js,
helper.js queda `??`, exit 0, el warning NO lo menciona. Tests pasan (ambos en disco),
la rama pusheada está rota.
Agravante: el comentario sobre ese código dice que existe *para* atrapar omitidos.
No puede atrapar el caso más común: un archivo nuevo.

### V2 — commit-slice con feature-id `..` commitea todo el árbol sucio  [HIGH]
`bin/sdd:803-812` (`resolve_feature_dir`: `[ -d "$specs_dir/$feature_id" ]`, y `specs/..`
es la raíz). Repro: `sdd commit-slice .. --files objetivo.txt` → commiteó objetivo.txt +
basura1.txt + basura2.txt. Exit 0, mensaje `chore(..): probe`.
Rompe la garantía del ADR 0002 ("nunca hace git add -A").
Nota: con id válido el scoping SÍ funciona correctamente (verificado).

### V3 — sdd branch apila sobre la rama actual y no escribe .parent-branch  [HIGH]
Repro: parado en `feature/AAA`, `sdd branch BBB` crea `feature/BBB` DESDE AAA y no
escribe sidecar. Después `sdd base-branch BBB` cae a la capa 3 (autodetect) → scope mal.
Es exactamente el defecto que mordió a la feature 024 (fallback eligió `main`, ~85 archivos).

### V4 — commit-slice no verifica que estés en la rama de la feature  [HIGH]
Repro: parado en `feature/AAA`, `sdd commit-slice BBB --files bbb.txt` commiteó el
trabajo de BBB SOBRE AAA. Exit 0.

## Confirmados leyendo el código

### V5 — el knob `auto-commit: off` restaura el no-op silencioso completo  [HIGH]
`.claude/rules/git.md` define el knob; lo leen `sdd-implement-task.md:75`,
`sdd-simplify-code.md:96`, `sdd-archive-feature.md:46` — los TRES saltean su commit.
Cadena: nada se commitea → scope `<base>..HEAD` de simplify vacío → escribe sentinel de
éxito igual → review corre sobre árbol sucio → archive mueve carpeta sin commitear,
reporta éxito, e imprime `git push -u origin HEAD` con HEAD sin nada del trabajo.
Es el no-op histórico que CLAUDE.md documenta como lección. Y git.md INSTRUYE a
descomentarlo. Recomendación de codex: borrar el knob.

### V6 — `.simplified` se ata a HEAD, no al árbol  [HIGH]
`bin/sdd:1107-1114`: solo compara `git-head:` contra `git rev-parse HEAD`. Editar sin
commitear después de simplify deja el sentinel "fresco" → status dice ready-to-review →
el árbol modificado nunca pasó por simplify.

### V7 — no existe estado durable de "review pasó"  [HIGH]
La fase sale solo de tareas + sentinel (`bin/sdd:1100-1130`). Un `/sdd-next` fresco
después de un PASS vuelve a correr review indefinidamente.
OJO: el fix es un recibo de review, NO reintroducir `.pr-opened` (codex explícito).

### V8 — el discovery checkpoint se saltea con que exista discovery.md  [HIGH]
`.claude/skills/plan-feature/SKILL.md:35-37`: "If discovery.md exists ... Skip Step 4
and Step 4.5 entirely". Nunca verifica que haya DISCOVERY-ACCEPTED/DISCARDED.

### V9 — simplify trata ediciones humanas previas como propias  [HIGH]
`.claude/agents/sdd-simplify-code.md` step 2b: `IGNORED_DIRTY` solo junta paths que NO
están en el diff commiteado. Un archivo ya editado a mano que además está en scope no se
reporta, y se lo commitea como propio — o se lo destruye con `git checkout --` si falla.

### V10 — `--minimal` se usa como path crudo antes de parsear flags  [MEDIUM]
`.claude/skills/review-feature/SKILL.md`: el pre-flight lee `specs/$ARGUMENTS/tasks.md`
y el parseo de flags está DESPUÉS (§2). `/sdd-next 024 --minimal` → busca
`specs/024 --minimal/tasks.md`.

## NO reproduce

### N1 — `sdd doctor` abortando por `((n++))` bajo set -e
Medido: `((n++))` con n=0 sí devuelve exit 1, pero bash 3.2 (único de esta máquina) NO
aborta. Doctor completó y contó bien (12 y 5 issues) en las dos rutas alcanzables.
Puede ser real en bash 4/5, no verificable acá. Fix gratis igual: `n=$((n+1))`.

## Sin verificar (de codex, confianza media — verificar al implementar)
- ciclo de fix de review reabre todas las tareas falladas pero implementa una sola antes de simplify
- `sdd status` emite `blockers: []` siempre y propone /implement-task para tareas [HITL]
- archivado se toma como completo aunque la validación post-move haya fallado
- simplify no tiene camino de éxito válido con scope no vacío y nada que simplificar (exit 5)
- resolución de archivo ambigua con el mismo id archivado en dos fechas (`find | head -1`)
- `sdd-cross-reviewer.md:31` embebe `$(sdd base-branch)` sin guardar → falla enmascarada
- el invariante orquestador/agente solo se chequea vía sdd-next/sdd-auto, no en invocación directa

## Veredicto de codex sobre mi diagnóstico (aceptado)
"Direccionalmente correcto pero exagerado y no accionable. La suite SÍ ejecuta bin/sdd
decenas de veces; lo que no ejecuta es la máquina de estados." El agujero real es más
preciso: nada testea las transiciones entre fases. Los tests afirman con `toContain`
sobre la prosa de los skills que review lleva a archive; nadie corre
plan→implement→simplify→review→archive y verifica el estado persistido.
Codex reportó "none found" en sustituciones de shell: las tres capturas de
`resolve_feature_dir` están guardadas y el harness ya ejecuta la CLI.
