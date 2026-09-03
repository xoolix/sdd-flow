# Feature: 019-cross-model-review

## Summary
Agregar un tercer reviewer **advisory** a `/review-feature`: un agent nativo `sdd-cross-reviewer` que delega la review al modelo opuesto al que implementó, vía el plugin oficial `codex@openai-codex` (`codex-companion.mjs adversarial-review`, salida JSON validada por `review-output.schema.json`). Solo dirección Claude→Codex en esta feature; la inversa llega con el port a Codex CLI.

## Trigger
`/review-feature` (directo o vía `/sdd-next`/`/sdd-auto`) en modo `judgment-day`. `--minimal` lo excluye, igual que al judge.

## Happy Path
1. `sdd-implement-task` registra `[timestamp] implemented-by: claude` en `decisions.md` al completar cada slice (dedupe solo-consecutivo: se omite únicamente si la última línea `implemented-by:` tiene el mismo valor).
2. `review-feature` pre-flight: detecta el plugin — verifica que `codex@openai-codex` esté registrado en `~/.claude/plugins/installed_plugins.json` Y habilitado en `~/.claude/settings.json` (campo `enabledPlugins["codex@openai-codex"] === true`); resuelve el script companion desde el `installPath` del registro (fallback: glob `~/.claude/plugins/cache/openai-codex/codex/*/scripts/codex-companion.mjs` solo si el registro es inaccesible, nunca para señal de disponibilidad); verifica `command -v codex` disponible. Si falta algo: `Cross-Review: skipped — <razón>` auditado en `decisions.md` y sigue solo con reviewer + judge. El kill-switch (`/plugin uninstall` o `enabledPlugins: false`) deshabilita la detección sin necesidad de código.
3. Step 1.5 lee `implemented-by` y resuelve el opuesto (`claude → codex`). Sin marker: asume el runtime actual y anota la asunción. Mixto: opuesto al último valor registrado.
4. Step 3 lanza `sdd-reviewer` + `sdd-judge` + `sdd-cross-reviewer` en paralelo. El cross-reviewer: (a) escribe el focus text (resumen breve del spec: ACs + touched files) a un archivo scratch `specs/<feature-id>/.cross-focus.txt` (Write tool, no heredoc Bash); (b) llama `node <companion> adversarial-review --wait --json <scope> "$(cat specs/<feature-id>/.cross-focus.txt)"` (`--json` es obligatorio: sin él el companion imprime texto humano, no el JSON del schema; la interpolación `"$(cat ...)"` jamás re-parsea el contenido del archivo, neutralizando inyección de comandos en el focus) — scope según estado del tree: `--scope working-tree` si `git status --porcelain` no está vacío (estado normal post-implement, los agentes no commitean); `--base <ref>` (vía `sdd base-branch`) solo con tree limpio; (c) resuelve el schema real desde `<companion directory>/schemas/review-output.schema.json` (mismo `installPath` que el companion); parsea el envelope JSON del companion (top-level: `{review, target, threadId, context, codex, result, rawOutput, parseError}`), valida `.result` contra el schema y lo traduce al formato de findings del judge. Mapeo de veredicto: `approve → PASS`; `needs-attention → FAIL` si hay findings critical/high, si no `PASS WITH WARNINGS`. Limpia el archivo scratch (`specs/<feature-id>/.cross-focus.txt`) incondicionalmente antes de retornar.
5. Consolidación (Step 4) **sin cambios**: reviewer y judge mandan. El resultado cross se anexa como advisory: sección `## CROSS-REVIEW — <feature-id>` en `decisions.md` (patrón JUDGMENT-DAY, `Source: sdd-cross-reviewer (codex)`) y línea de envelope `**Cross-Review**: <verdict> (advisory, model: codex) | skipped — <razón>`. Un `FAIL` cross se degrada a warning con nota `cross-review reported FAIL (advisory)`.

## Domains
- [x] External integrations (plugin `codex@openai-codex`: `codex-companion.mjs` + `review-output.schema.json`; codex CLI autenticado)
- [x] Other: SDD framework — `.claude/agents/sdd-cross-reviewer.md` (nuevo), `review-feature/SKILL.md`, `sdd-implement-task.md`, `_shared/agent-frontmatter.md` (naming convention)

## API Changes
Todo aditivo, backwards-compatible:
- `decisions.md`: línea `implemented-by: <claude|codex>` + sección `## CROSS-REVIEW`.
- Envelope de review-feature: campo `Cross-Review`.
- Sin cambios en la tabla de consolidación ni en los envelopes existentes.

## Edge Cases
- **Falla runtime** (auth del CLI, timeout, error del companion): 1 retry; luego `Cross-Review: skipped — runtime error: <detalle>`; el pipeline sigue y no consume los 2 retries de fase del orquestador.
- **Timeout del agente cross**: ejecuta el companion con deadline ~10 min; al expirar, clasifica como falla de runtime y sigue el flujo 1-retry (arriba).
- **Falla de lanzamiento o crash del agente cross**: `review-feature/SKILL.md` detecta falla del agente (launch error, no retorna, no `### Cross-Verdict:` en output), audita como `Cross-Review: skipped — cross-agent failure: <detail>`, y continúa con veredicto de reviewer+judge solo; nunca consume los 2 retries de fase.
- **JSON que no matchea el schema** (guard residual): `Cross-Review: completed (unparseable, advisory)` + salida cruda truncada (~100 líneas) en `## CROSS-REVIEW`, marcada `formato libre`.
- **Sin marker `implemented-by`** (features previas a 019): asumir runtime actual, anotar asunción.
- **`--minimal`**: cross-review no corre; sin entrada en decisions.md.
- **Path versionado del plugin** (`codex/<version>/`): `installPath` del registro es autoridad; cache glob fallback solo si el registro es ilegible.
- **KNOWN-LIMITATION**: un cross-reviewer colgado más allá de su deadline interno (600s) puede stallar el batch paralelo del Step 3 porque el Agent tool no expone primitiva de cancelación desde el orquestador. Mitigación actual: deadline interno del agente + fail-open (arriba). Follow-up: await independiente/cancelación a nivel orquestador.

## Acceptance Criteria
- [ ] Given una feature con `implemented-by: claude` y el plugin codex operativo, When corre `/review-feature` en judgment-day, Then el envelope incluye `Cross-Review: <verdict> (advisory, model: codex)` y `decisions.md` contiene `## CROSS-REVIEW` con la tabla de findings.
- [ ] Given el plugin no instalado o el CLI no listo (o falla tras 1 retry), When corre `/review-feature`, Then el envelope incluye `Cross-Review: skipped — <razón>`, el veredicto final es idéntico al de reviewer + judge solos, y el pipeline no se bloquea.
- [ ] Given un cross-review con veredicto `FAIL`, When se consolida, Then el veredicto final NO cambia y el FAIL queda como warning `cross-review reported FAIL (advisory)`.
- [ ] Given una feature sin marker `implemented-by`, When corre `/review-feature` en Claude Code, Then asume `claude`, cross-reviewa con codex y anota la asunción en `decisions.md`.

## Rollback Plan
- Kill-switch: desinstalar/deshabilitar el plugin — opción 1: `/plugin uninstall codex@openai-codex` (remoción total); opción 2: editar `~/.claude/settings.json` y establecer `enabledPlugins["codex@openai-codex"] = false` (deshabilitación reversible); en ambos casos el pre-flight deja de detectar el plugin y el comportamiento es idéntico al de sin plugin, sin tocar código.
- Remoción total de la feature: git revert de `sdd-cross-reviewer.md` + ediciones a `review-feature/SKILL.md` y `sdd-implement-task.md`.

## Success Criteria
- Dogfood de las próximas 3 features con cross-review activo: 0 pipelines bloqueados y 0 veredictos finales alterados por el cross-reviewer (skip rate >0 permitido, siempre auditado en `decisions.md`).

## Open Questions
- Ninguna. PROTOTYPE-RESULT registrado en `decisions.md` (2026-08-14): plomería verificada (corre sin `CLAUDE_PLUGIN_ROOT`, auth OK, ~2 min) y tres correcciones ya incorporadas a este spec (adversarial-review, scope por estado del tree, dedupe consecutivo).
