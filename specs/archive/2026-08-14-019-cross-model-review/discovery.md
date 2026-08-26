# Discovery Report
status: findings-present

## High-impact findings
- [edge-case] El comando del Happy Path step 4 del spec (`adversarial-review --wait <scope> [focus]`) omite el flag `--json`. Verificado en `codex-companion.mjs` v1.0.6: sin `--json`, `outputResult()` imprime texto human-rendered en stdout (no el JSON del schema), por lo que el parseo contra `review-output.schema.json` falla y toda review exitosa degradaría al path `unparseable`. Corrección propuesta: el comando canónico pasa a ser `node <companion> adversarial-review --wait --json <scope> [focus]`. [impact: high]

## Other findings
- [simplification] La tabla de Findings del judge tiene columna `Category` sin equivalente en el schema de codex — mapear con valor fijo (propuesto: `cross-model`). Evidence ← `file:line_start-line_end`, Description/Suggested Action ← `body`/`recommendation`. [impact: medium]
- [edge-case] El companion colapsa exit code 1 tanto para CLI ausente como para fallas de auth/turn — la lógica retry-vs-skip del cross-reviewer debe distinguir por texto de stderr/stdout, no por exit code. (Nota: CLI-ausente ya lo cubre la detección pre-flight; esto afecta solo fallas en runtime.) [impact: medium]
- [simplification] El agente nuevo necesita fila en la tabla de Model Routing de CLAUDE.md — decisión sonnet (convención de internal workers de review) vs haiku (es un wrapper fino Bash + parseo JSON). [impact: medium]
- [info] `--wait`/`--background` son inertes para subcomandos de review (siempre foreground) — inofensivo, `--wait` queda como no-op documentado. [impact: low]
- [info] Este repo ES SDD_HOME: `sdd-cross-reviewer.md` se distribuye solo vía el sync glob-based de `bin/sdd update` y el prune de 018 nunca lo toca. Cero cambios en bin/sdd. [impact: low]
- [info] `tests/sdd.test.js:143` (`toHaveLength(10)`) rompe con el 11vo agente → actualizar a 11 + assertion positiva del nuevo agente + renombrar el test de topología. `agent-frontmatter.md` también tiene counts hardcodeados (10/6 → 11/7). [impact: low]

## User decisions
- DISCOVERY-ACCEPTED: agregar `--json` al comando canónico del cross-reviewer — `node <companion> adversarial-review --wait --json <scope> [focus]`. Spec corregido (Happy Path step 4). [2026-08-14T02:13:44Z, "arreglalo"]
