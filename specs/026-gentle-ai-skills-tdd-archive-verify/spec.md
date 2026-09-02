# Feature: 026-gentle-ai-skills-tdd-archive-verify

## Summary
Tres adopciones de gentle-ai post-025: instalar cuatro skills ya adaptados (work-unit-commits, comment-writer, branch-pr, chained-pr; Apache-2.0 © gentleman-programming) como core skills; elevar RED→GREEN→TRIANGULATE→REFACTOR a contrato de fase de implement-task con evidencia obligatoria en el envelope; y cerrar el hueco post-archive con verificación determinista en la CLI (bypasses reproducidos: 021, 294ccfc). Principio (ADR 0005): la prosa que instruye a un LLM no es garantía — solo verificar el efecto después.

## Trigger
`sdd init`/`update` (skills) · cada implement-task (contrato TDD) · fin de archive-feature y `sdd status` (verificador).

## Happy Path
1. Los 4 drafts se copian de `~/.claude/sdd-skill-drafts/` a `.claude/skills/<nombre>/SKILL.md`; `CORE_SKILLS` (`bin/sdd:11`) y los ignorados de build-registry ganan los 4 nombres.
2. `sdd-implement-task.md`: TRIANGULATE entra al ciclo (default-obligatorio; skip solo estructural, anotado); el envelope gana `TDD-Evidence` (RED con output real, GREEN, TRIANGULATE N casos o skip).
3. `sdd-next`/`sdd-auto` validan `TDD-Evidence` post-fase; `sdd-reviewer` valida evidencia contra realidad (existe, pasa, N casos).
4. Nuevo `sdd verify-archive <id>`: `git show --no-renames --name-status` del commit del archive con ≥1 `D` bajo `specs/<id>/`, ≥1 `A` bajo `specs/archive/*-<id>/`, y `specs/<id>/` fuera del árbol de HEAD.
5. Orquestadores lo corren post-fase (fallo → retry → ESCALATED); el agente, como self-check; `sdd status` marca integridad rota ante duplicados.
6. Wiring liviano: implement-task Step 7.5 → `work-unit-commits`; archive Step 3.6 → `branch-pr`/`chained-pr`.
7. `docs/adr/0005` formaliza el principio.

## Domains
- **CLI surface** — `CORE_SKILLS` +4, nuevo `verify-archive`, `status` detecta duplicados.
- **Phase agents** — `sdd-implement-task.md`, `sdd-archive-feature.md`, `sdd-reviewer.md`.
- **Orchestration skills** — `sdd-next`/`sdd-auto`, `build-registry`.
- **Test suite** — bypass simulado en repo temporal + pins de prosa. Docs: `docs/adr/0005-*.md`.

## Edge Cases
- Rename detection oculta las bajas (`R100` en vez de `D`+`A`): todo chequeo usa `--no-renames`.
- Id archivado en dos fechas: resolver el más reciente o fallar claro — nunca `find | head -1` silencioso.
- Archive fuera del orquestador: la compuerta no corre; `sdd status` cubre el síntoma.
- Fast-lane: mismo shape de move.
- Tarea no testeable: `TDD-Evidence` con skip anotado (cf. `Test-skip rationale`).

## Acceptance Criteria
- [ ] AC1: Given los 4 drafts copiados a `.claude/skills/`, When se leen `CORE_SKILLS` y la lista de ignorados de build-registry, Then los cuatro nombres figuran en ambas y el test "build-registry ignores every core skill" pasa sin modificarlo.
- [ ] AC2: Given `sdd-implement-task.md`, When una tarea tiene comportamiento testeable, Then el contrato exige RED→GREEN→TRIANGULATE→REFACTOR y el envelope lleva `TDD-Evidence` obligatorio — pineado por tests de prosa.
- [ ] AC3: Given `sdd-next`/`sdd-auto`, When validan un envelope de implement-task sin `TDD-Evidence` completo, Then la fase falla (retry→ESCALATED); y `sdd-reviewer` valida la evidencia contra la realidad.
- [ ] AC4: Given un commit de archive por bypass (git commit directo: solo altas) en repo temporal, When corre `sdd verify-archive <id>`, Then exit ≠ 0 nombrando la mitad faltante; Given un archive legítimo vía `commit-slice --moved-from`, Then exit 0.
- [ ] AC5: Given `specs/<id>/` y `specs/archive/*-<id>/` trackeados a la vez, When corre `sdd status`, Then reporta integridad rota en vez de `archived`.
- [ ] AC6: Given los orquestadores, When la fase archive-feature termina, Then corren `sdd verify-archive` como validación post-fase y confían solo en su exit code.
- [ ] AC7: Given el repo completo, Then `docs/adr/0005` existe, `grep -c 'node\|npx\|src/' bin/sdd` = 0, `grep -rn 'auto-commit' bin/ .claude/ .specify/ tests/` = 0, y la suite completa queda verde.

## Rollback Plan
- Un commit por slice sobre `feature/026-…` contra `integration/sdd-020-021`: `git revert` del rango deshace todo. Skills: sacar los 4 nombres de ambas listas. Compuerta: revertir la línea de validación del orquestador. Sin migraciones, nada pusheado.

## Success Criteria
- Bypass simulado → `verify-archive` exit ≠ 0; archive legítimo → exit 0 (cero falsos positivos).
- Suite completa verde: 176 tests actuales + nuevos, 0 fallos.
- Ambos greps invariantes en 0, títulos de test incluidos.

## Open Questions
- Ambigüedad multi-fecha en verify-archive (más reciente vs error): decide el designer.
