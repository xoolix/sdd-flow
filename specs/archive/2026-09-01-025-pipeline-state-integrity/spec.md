# Feature: 025 — Pipeline state integrity

## Summary
Diez defectos verificados, todos de la misma clase: **estado que el pipeline cree tener y no tiene**. Se arreglan los diez, se borra el knob `auto-commit` —que encadena el no-op silencioso completo—, `.simplified` se reemplaza por `.sdd-state` (exactamente `phase`, `git-head`, `tree-digest`, `verdict`, `at` — la lista `files:` se descarta), y se agrega un harness determinístico que recorre las ocho fases verificando las lecturas de `sdd status`. Nada de la apertura automática de PRs (024) se reintroduce.

## Trigger
Cada comando de escritura de `bin/sdd` (`commit-slice`, `branch`, `status`), el gate de `/plan-feature` sobre `discovery.md`, y la transición simplify→review→archive.

## Happy Path
1. `sdd branch` y `sdd commit-slice` validan id, rama y completitud antes de escribir; fallan ruidosamente si algo no cierra.
2. `/simplify-code` y `/review-feature` sellan su resultado en `.sdd-state`, atado a HEAD y al digest del árbol.
3. `sdd status` deriva la fase de ese archivo únicamente: tras un PASS propone archive, no review otra vez; y `/archive-feature` exige ese recibo antes de mover la carpeta.

## Domains
- `bin/sdd` — `resolve_feature_dir`, `cmd_commit_slice`, `cmd_branch`, frescura del centinela, `cmd_status`
- `.claude/agents/sdd-*.md` — `implement-task`, `simplify-code`, `archive-feature`
- `.claude/skills/*/SKILL.md` — `plan-feature`, `review-feature`, `sdd-next`, `sdd-auto`
- `.claude/rules/git.md` (sale el knob) y `domains.md` (lo menciona); la semilla en `.specify/templates/rules/git.md`
- `tests/` — repros de los diez + harness de la máquina de estados

## Edge Cases
- Archivo suelto sin gitignorear: **ahora bloquea** todo `commit-slice`. Deliberado (variante dura elegida).
- `.simplified` viejo en otro repo (medical-chat/045): queda huérfano y esa feature re-corre simplify una vez. Sin shim: honrarlo sería reintroducir V6, porque no guarda digest del árbol.
- Endurecer `commit-slice` puede destapar omisiones latentes en fases que hoy pasan.
- **El pipeline muerde mientras se lo usa para arreglarse**: V1 dejará afuera los archivos nuevos de esta implementación y V3 apilará sobre `feature/024` sin sidecar. Compensar a mano hasta que sus fixes estén adentro.
- **Límite declarado del harness**: prueba las *lecturas* de `detect_feature_phase` contra fixtures que imitan lo que cada fase escribe — no ejecuta ninguna fase, porque son prosa que ejecuta un LLM. El comentario de cabecera debe decirlo, como ya hacen `sweep-retired-symbols.test.js` y `sdd.test.js:2263-2269`.
- **AC8 solo es aplicable en forma débil**: los hallazgos de discovery no tienen ID, así que se exige "existe al menos una decisión", nunca "una por hallazgo alto".

## Acceptance Criteria
- [ ] Given una tarea que crea dos archivos nuevos y declara uno en `--files`, When corre `sdd commit-slice`, Then sale ≠0, nombra el no declarado, y no crea commit.
- [ ] Given un feature-id con `..` o `/`, When corre `sdd commit-slice`, Then lo rechaza antes de tocar el índice y el índice queda intacto.
- [ ] Given que estoy en `feature/A`, When corre `sdd branch B`, Then escribe `.parent-branch` con la base resuelta y no apila en silencio.
- [ ] Given que estoy en una rama que no es la de la feature, When corre `sdd commit-slice B`, Then sale ≠0 y no commitea.
- [ ] Given el repo post-cambio, When grepeo `auto-commit` en `bin/`, `.claude/`, `.specify/`, `tests/`, Then devuelve 0.
- [ ] Given un `.sdd-state` fresco, When edito un archivo sin commitear, Then el estado se invalida y `sdd status` deja de decir `ready-to-review`.
- [ ] Given un review con veredicto PASS, When corre `sdd status`, Then la fase es `reviewed` y el próximo comando es archive.
- [ ] Given `discovery.md` con `## User decisions` vacío, When corre `/plan-feature`, Then sigue blocked.
- [ ] Given un archivo en scope ya editado a mano, When corre `/simplify-code`, Then bloquea sin commitearlo ni destruirlo.
- [ ] Given `/sdd-next <id> --minimal`, When resuelve el path, Then abre `specs/<id>/`.
- [ ] Given un feature cuyo `.sdd-state` no tiene `phase: reviewed` con veredicto de paso, When corre `/archive-feature`, Then bloquea sin mover la carpeta.
- [ ] Given fixtures que reproducen el estado de archivos que cada fase deja atrás, When el harness recorre `missing→spec→planned→implementing→ready-to-simplify→ready-to-review→reviewed→archived`, Then `sdd status` reporta la fase correcta en cada paso y falla si alguna deja de persistir su estado.

## Rollback Plan
- `git revert` de los commits. Framework local sin runtime desplegado: sin flag que apagar ni datos que migrar. Los `.sdd-state` escritos quedan inertes por estar gitignoreados.

## Success Criteria
- Los diez repros de `research/hallazgos-verificados.md`, como tests, pasan de rojo a verde.
- `grep -rn 'auto-commit' bin/ .claude/ .specify/ tests/` devuelve 0.
- El harness recorre las ocho fases (`missing`→`archived`) y falla si alguna deja de persistir su estado — incluida la rama de frescura del centinela, hoy con cero cobertura.
- Suite completa en verde, con el conteo creciendo al menos en la cantidad de repros nuevos.

## Open Questions
- Los siete hallazgos de codex sin verificar (final de `research/hallazgos-verificados.md`) se confirman al implementar y se arreglan **solo si reproducen**.
- `sdd doctor` con `((n++))` bajo `set -e` **no reproduce** (bash 3.2 no aborta; contó bien). Cambiarlo a `n=$((n+1))` es gratis, pero no se presenta como defecto vivo.
