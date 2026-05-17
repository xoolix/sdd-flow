# Discovery Report
status: findings-present (non-blocking, auto-accepted by user)

## High-impact findings

- **[edge-case] Filesystem detection sin guard reproducible** [impact: high]
  Touch `.claude/agents/sdd-plan-feature.md` → sdd-next/sdd-auto routea como leaf → spawn agent broken. **Confirmación del bug que AC-3 fixea**. No es finding nuevo — es la premise del spec.

## Other findings

- **[edge-case] Disambiguator field name pre-empirical (medium)** — engram-protocol.md no tiene "Active session detection" section. plan-feature/SKILL.md y review-feature/SKILL.md Step 0 dicen "if response indicates active session" sin field name. Decisión post-empirical (T01-style llamada a `mem_context` con/sin sesión).

- **[edge-case] Script edge cases del C (medium)** — scripts/ no existe; archive: 13 spec / 3 quick-spec / 0 both. Legacy 003/004 sin date prefix; "both present" no en current data pero el script lo necesita.

## User decisions

- **DISCOVERY-ACCEPTED — High finding (filesystem guard)**: ya cubierto por AC-3. Proceder con plan/implementation. No requiere pause adicional.

- **DISCOVERY-ACCEPTED — Disambiguator field name**: deferir a T01 empirical step. Plan debe incluir tarea explícita de llamar `mem_context` en 2 estados antes de documentar. Field name emerge de la observation.

- **DISCOVERY-ACCEPTED — Script glob scope**: scan `YYYY-MM-DD-*` only. Skip legacy 003/004 (sin date prefix). Más simple, evita ambiguity sobre qué counts como "in window" para folders sin fecha.

- **DISCOVERY-ACCEPTED — "Both present" precedence**: emit `unknown` con warning. No arbitrary precedence (ni `quick-spec` gana ni `spec` gana). En current data no ocurre, pero el script debe handle it sin crashear.
