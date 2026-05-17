# Decisions

## D-001 — Orchestrator phases detection: filesystem-side
**Date**: 2026-04-30
**Context**: `sdd-next/SKILL.md` y `sdd-auto/SKILL.md` necesitan distinguir leaf phases (spawn agent) de orchestrator phases (execute SKILL.md inline). Hardcoding la lista de orchestrators rompe si se agrega una nueva fase.
**Decision**: detección filesystem-side. Orchestrator phases son aquellas que NO tienen `.claude/agents/sdd-<phase>.md`. Leaf phases son las que SÍ lo tienen.
**Consequence**: convención clara, auto-detectable, sin lista hardcoded. Documentar la convención en `agent-frontmatter.md`.

## D-002 — EC-3 (workers heredan tools): mergeado con verify step
**Date**: 2026-04-30
**Context**: validación de que internal workers no heredan `Agent` del parent context cuando son spawned via inline orchestration.
**Decision**: NO es edge case independiente. Es validación durante end-to-end (paso 10 del happy path / AC-5). Cubierto por SC-3 (grep-able).
**Consequence**: simplificación del spec; AC-4 + SC-3 cubren la disciplina arquitectural.

## D-003 — Fallback path en sdd-next/sdd-auto: eliminar para orchestrator phases
**Date**: 2026-05-01
**Context**: discovery.md surfaceó que `sdd-next/SKILL.md` (Step 3) y `sdd-auto/SKILL.md` (Step 2 item 2) tienen fallback que lee `.claude/agents/sdd-<phase>.md` si `subagent_type` no se reconoce. Después de borrar los 2 orchestrator agents, el fallback intentaría leer archivos inexistentes → falla silenciosa.
**Decision**: opción (a) — eliminar el fallback **solo para orchestrator phases** (plan-feature, review-feature). Para leaf phases, mantener el fallback como red de seguridad.
**Consequence**: la branch leaf-vs-orchestrator en sdd-next/sdd-auto debe excluir el fallback path en la rama orchestrator. Documentar en agent-frontmatter.md.

## D-004 — Sentinel asymmetry: preservar SPEC-GAP-HIGH no borra `.simplified`
**Date**: 2026-05-01
**Context**: `sdd-review-feature.md` Step 4.5 — SPEC-GAP-HIGH NO borra `.simplified` (mantiene sentinel pese a blocked). Solo FAIL lo borra.
**Decision**: la migración a `review-feature/SKILL.md` debe preservar esta asimetría exacta.
**Consequence**: AC-2 implícitamente cubre. Tarea de migration: copiar Step 4.5 verbatim respecto al sentinel.

## D-005 — OQ-1 (session lifecycle manual vs inline): resolver al implementar
**Date**: 2026-05-01
**Context**: phase agents NO llaman `mem_session_start/end`; solo `sdd-next` y `sdd-auto`. Cuando user invoca `/plan-feature` directo, no hay session.
**Decision**: el plan debe resolver — inlined SKILL detecta si está dentro de un orchestrator activo (mem_context devuelve session activa) y skipea session_start; si no, lo llama. Filesystem-side detection complementaria si Engram unavailable.
**Consequence**: agregar paso al happy path / tarea al plan: "session lifecycle guard en plan-feature/SKILL.md y review-feature/SKILL.md".

## D-006 — agent-frontmatter.md doc update: scope expandido
**Date**: 2026-05-01
**Context**: discovery surfaceó inconsistencias adicionales — líneas 35 ("15 executors", "Omitir en sdd-plan-feature y sdd-review-feature"), 77 ("9 public agents"), 79 ("8 internal agents"). Counts cambian; policy se invierte.
**Decision**: el paso 7 del happy path (update agent-frontmatter.md) incluye reescribir esas 3 secciones. Documentar el nuevo patrón: orchestrators = SKILL.md body + main Claude executor; leaf = native agent con tools whitelist sin Agent.
**Consequence**: el plan debe incluir tarea atómica de reescritura de las 3 secciones con counts actualizados.

## D-007 — CLAUDE.md model routing table: update columnas
**Date**: 2026-05-01
**Context**: tabla en CLAUDE.md tiene rows tipo "Explore agents | plan-feature sub-agents (Explore) | sonnet". Post-migration esos workers ya no son "sub-agents de plan-feature" — son sub-agents de main Claude.
**Decision**: paso 9 del happy path (revisar CLAUDE.md) incluye reformular la columna "context" en las rows afectadas.
**Consequence**: tarea menor de cosmetic doc update. No bloquea ACs.

## D-008 — bin/sdd update verification (EC-1)
**Date**: 2026-04-30
**Context**: T11 verification of `cmd_update` behavior per EC-1 — confirming whether deleting `sdd-plan-feature.md` and `sdd-review-feature.md` from `.claude/agents/` could be undone by `sdd update`.

**Verified algorithm** (lines 386-413 of `bin/sdd`):
- Source glob: `$SDD_HOME/.claude/agents/sdd-*.md`
- For each upstream file: (a) absent at dest → `cp` in; (b) identical → skip; (c) differs → `cp` overwrite.
- No deletion logic: files that exist at dest but not upstream are never touched. Only upstream files are iterated.

**Actual `$SDD_HOME` value**:
`SDD_HOME` is computed at line 7 as the parent directory of `bin/sdd` after resolving symlinks:
```
SDD_HOME="$(cd "$(dirname "$(readlink -f "$0" 2>/dev/null || realpath "$0")")/.." && pwd)"
```
For this repo, `bin/sdd` resolves to `/Users/santi/Proyectos/rossi/repos/test-sdd/bin/sdd` (no symlink indirection), so `SDD_HOME = /Users/santi/Proyectos/rossi/repos/test-sdd` — **the repo itself**.

Additionally, `cmd_update` (line 302) explicitly refuses to run when `target == SDD_HOME`, printing "Cannot update inside the SDD boilerplate repo itself." This means `sdd update` cannot be invoked from within this repo at all.

**Conclusion — recreation risk: NO**:
- This repo IS its own SDD_HOME. Deleting `sdd-plan-feature.md` and `sdd-review-feature.md` from `.claude/agents/` also removes them from the upstream source that `sdd update` reads.
- Furthermore, `sdd update` is blocked when run from within this repo (self-referential guard).
- Running `sdd update` in a *downstream project* that installed SDD from this repo would only copy files that still exist in `SDD_HOME/.claude/agents/` — the deleted files are absent there, so they will never be re-added to downstream projects either.

**Mitigation**: None required. The local delete IS the upstream delete. No additional manual step needed.

## SPEC-GAP — Adversarial review findings (2026-05-01)

Adversarial review surfaced 6 spec-level gaps. 0 high-severity. Recorded for archive merge / future iterations.

**Medium-severity (3)**:
- **SPEC-GAP-1 (incomplete-AC, medium)**: SC-2 exception carveout omits `agent-frontmatter.md`. The grep produces a legitimate hit on `agent-frontmatter.md:39` (explanatory sentence), and on `settings.local.json:16-17` (stale permission grants). SC-2 only excepted `decisions.md` and ADR. **Suggested fix**: extend SC-2 exception clause to include explanatory/historical references in any `.claude/skills/_shared/*.md`, or add the grep flag `-v 'agent-frontmatter.md\|settings.local.json'`.
- **SPEC-GAP-2 (undocumented-assumption, medium)**: D-005 / OQ-1 session guard relies on `mem_context` "indicating an active session" — but no document defines what that signal looks like. If Engram returns empty context vs error vs malformed response, guard may misfire. **Suggested fix**: document in `engram-protocol.md` what `mem_context` returns when session is/is-not active, and the Engram-unavailable fallback semantics for the guard.
- **SPEC-GAP-3 (uncovered-scenario, medium)**: D-001 filesystem-side convention has no guard against accidental re-creation of `sdd-plan-feature.md` or `sdd-review-feature.md`. If recreated by mistake, sdd-next/sdd-auto silently revert to spawning broken agents. **Suggested fix**: add EC-6 documenting the scenario; consider hard-error or warn in sdd-next when finding agent files for known-orchestrator phases; OR add a CI/lint check enforcing the absence as a structural invariant.

**Low-severity (3)**:
- **SPEC-GAP-4 (incomplete-AC, low)**: AC-2 "Then" clause omits the `Status: blocked` path triggered by SPEC-GAP-HIGH. **Suggested fix**: amend AC-2 to enumerate `PASS / PASS WITH WARNINGS / FAIL / blocked-on-SPEC-GAP-HIGH` with sentinel asymmetry preserved.
- **SPEC-GAP-5 (uncovered-scenario, low)**: Migration path for downstream repos already holding the old agent files is unaddressed. **Suggested fix**: add migration note in ADR; consider future enhancement to `bin/sdd update` for deletion manifest.
- **SPEC-GAP-6 (incomplete-AC, low)**: D-006 scoped `agent-frontmatter.md` update to lines 35, 77–79, but line 3 still says "9 skill routers" — post-migration plan-feature/review-feature are full orchestration bodies, not routers. **Suggested fix**: extend D-006 to include line 3, rename to "7 leaf phase routers + 2 inline orchestrator SKILLs".

**Decision**: archive 015 with these gaps recorded. None block correctness or shipping. Address in follow-up features as priorities allow.

## Deltas merged
**Date**: 2026-05-01 — Feature archived
- **No deltas**: decisions.md contained 8 decisions (D-001 through D-008) and 6 SPEC-GAP findings. No ADDED/MODIFIED/REMOVED sections found in decisions.md. Spec.md remains unchanged from implementation.

## Simplify: 2026-04-30 — /simplify-code
- **Files simplified**: none (committed diff between main and HEAD is empty — feature 015 changes are uncommitted)
- **Changes**: no edits made
- **Baseline**: pass | **Post-edit**: skip (no files in scope)
