# Decisions

[2026-09-02T01:26:32Z] ADR-ACCEPTED: el usuario aprobó formalizar como `docs/adr/0005` el principio "phase handoffs se verifican con chequeos deterministas de la CLI, no con prosa del agente" (bypasses 021 y 294ccfc como evidencia; doctrina de gentle-ai como precedente). El ADR se crea como slice propio de la feature — no en la intake — para que entre al repo vía `sdd commit-slice` con sus `--files` declarados.

[2026-09-02T01:26:32Z] SCOPE: los tres pendientes van en una sola feature (definido por el usuario en la memoria Engram `sdd/026/backlog`: "Los tres pendientes de la próxima feature"). Lane full por multi-dominio + riesgo de integridad del pipeline.

[2026-09-02T01:26:32Z] DESIGN-INPUT: "lo mismo que hace gentle-ai" (respuesta del usuario sobre dónde vive la verificación post-archive) = ceremonia en CLI determinista + orquestador que confía solo en el exit code + test que scriptea al agente deshonesto. Verificado contra el repo de gentle-ai (docs/testing-agents-deterministically.md, internal/assets/skills/sdd-apply/strict-tdd.md, sdd-verify/strict-tdd-verify.md), clonado en scratchpad el 2026-09-01.

[2026-09-02T02:02:54Z] implemented-by: claude

## Delta: 2026-09-02 — Task T001
- **MODIFIED**: `branch-pr/SKILL.md` line 15 no se copió carácter-por-carácter del draft. El draft enlaza `[ADR 0004](../../../docs/adr/0004-cli-does-not-open-prs.md)`; ese filename real contiene el substring `open-pr`, uno de los diez símbolos retirados de la feature 024 que `tests/sweep-retired-symbols.test.js` barre sobre TODO `.claude/**` sin mecanismo de excepción (el propio archivo dice "Don't add a third exclusion ... fix the offending file instead"). Cambié esa línea para referenciar "ADR 0004 (`docs/adr/`, \"the CLI does not open PRs\")" en prosa, sin el filename literal — mismo significado, mismo documento, sin el substring prohibido. El resto de los 4 drafts (incluido el resto de branch-pr) se copió verbatim; confirmado con `diff` contra `~/.claude/sdd-skill-drafts/` antes del cambio.

## Simplify: 2026-09-02 — /simplify-code
- **Files simplified**: `bin/sdd`
- **Changes**: `cmd_verify_archive` and `check_archive_integrity` both globbed `specs/archive/*-<feature_id>` and picked the lexicographically-last match (most recent, since dirs are date-prefixed) with identical inline logic. Extracted the shared rule into a new `resolve_archive_dir` helper (globals `ARCHIVE_DIR_MATCHES`, `ARCHIVE_DIR_CHOSEN`, bash-3.2-safe — no negative array indices, no namerefs); both call sites now delegate to it and keep their own distinct behavior (the multi-match stderr note stays only in `cmd_verify_archive`). No externally observable behavior changed — exit codes, stdout/stderr text, and JSON fields are unchanged; verified by the full suite (211/211) both before and after.
- **Scope note**: `.claude/rules/testing.md` and `.specify/templates/rules/testing.md` were in the committed diff but were left untouched. Neither is technically covered by the skill's literal SDD-artifacts exclusion globs (`.claude/rules/testing.md` matches none of the listed patterns; `.specify/templates/*.md` is single-level and doesn't reach the nested `rules/` subdirectory), but both are pure prose rules/template docs with wording pinned verbatim by `tests/sdd.test.js:3908-3913`, matching the exact rationale ("prose artifacts, not code") the exclusion category exists for. Judgment call, flagged here for the reviewer.
- **Baseline**: pass (211/211, 5/5 suites) | **Post-edit**: pass (211/211, 5/5 suites)

[2026-09-02T03:25:02Z] Cross-Review: skipped — cross-agent failure: codex runtime timeout (dos intentos de 10 min colgados en phase "starting"; jobs huérfanos cancelados; broker posiblemente necesita reinicio)

## JUDGMENT-DAY-HIGH — 026-gentle-ai-skills-tdd-archive-verify

| # | Severity | Category | Evidence | Description | Suggested Action |
|---|----------|----------|----------|-------------|------------------|
| 1 | high | uncovered-scenario | `bin/sdd:1376-1394` (`resolve_archive_dir`), `:1396-1489` (`cmd_verify_archive`), `:1506-1519` (`check_archive_integrity`) | The gate only catches the *duplicate-tracked* bypass shape (021, 294ccfc: additions with missing deletions). A *pure-deletion* bypass — an agent runs `git rm -r specs/<id>/` (or an interrupted move) and commits with no `specs/archive/*-<id>/` ever created — is strictly worse (total loss of spec/plan/tasks/decisions) and is invisible both immediately and forever. `cmd_verify_archive` returns exit 3 "no archive directory found" — byte-identical to a feature never archived. `check_archive_integrity`'s first line is `[ -d "$specs_dir/$feature_id" ] || return 0` — once the folder is gone, the permanent backstop can never fire. AC5 only specs the duplicate case. | Extend `check_archive_integrity`/`sdd status` (or a new CLI check) to detect a feature-id with commits touching `specs/<id>/` in history but present in neither location; at minimum make `cmd_verify_archive`'s exit-3 stderr distinguish "never started" from "was tracked, now gone". |
| 2 | high | implementation-risk | `.claude/agents/sdd-reviewer.md:26` (step 2.5) vs `review-feature/SKILL.md` Step 3 vs `sdd-implement-task.md` Steps 6b/7; repo-wide grep: TDD-Evidence appears in ZERO persisted files | AC3's second half ("sdd-reviewer valida la evidencia contra la realidad") is unimplementable as wired: step 2.5 says to read TDD-Evidence "recorded in each implement-task envelope", but review-feature never captures/forwards envelopes, and /implement-task never persists the field anywhere durable — the reviewer (haiku here) has nothing to check and can only no-op or invent a pass. Deeper: RED evidence is inherently unfalsifiable post-hoc; unlike verify-archive, no CLI-level check backs this claim — in tension with ADR 0005 itself. Test suite's own comment (tests/sdd.test.js:3922-3926) concedes prose-pins are not behavioral coverage. | Persist TDD-Evidence per task into `decisions.md` (same pattern as `implemented-by:` in Step 6b) and have review-feature Step 3 forward it to the reviewer; record RED-unfalsifiability as an accepted residual risk in decisions.md/ADR 0005. |
| 3 | medium | uncovered-scenario | `archive-integrity-broken` has zero hits in `.claude/` outside bin/sdd and tests/ | sdd-next/sdd-auto phase-detection tables have no row for `archive-integrity-broken` — if status returns it mid-pipeline, the orchestrator has no defined branch. | Add an explicit row to both decision tables: `archive-integrity-broken` → STOP, `Status: blocked`, surface the blockers message. |
| 4 | medium | edge-case | `bin/sdd:1436-1441` — HEAD-only, no `--commit` flag (designer trade-off) | The post-phase gate trusts HEAD at validation time; a commit landing between archive-feature's commit and the verify call makes a legitimate archive read as exit 3 and blocks it. Fails safe, but a real false-positive/availability gap under this project's own concurrent-agent workflow. | Pass the SHA commit-slice printed (a `--commit` flag) or have the orchestrator re-resolve once against the actual archive commit before declaring failure. |
| 5 | medium | security-integrity | `bin/sdd:1443-1487` — checks are path-prefix based, no content comparison | A bypass deleting `specs/<id>/` and adding a stub file under the archive dir satisfies every exit-0 condition while losing the real content. Lower plausibility than #1/#2. | Note as accepted residual risk, or add a lightweight content check (file count/size parity). |
| 6 | low | edge-case | `.claude/agents/sdd-reviewer.md:26` "contains the claimed N triangulation cases" | Case-counting can be satisfied by near-identical duplicated tests rather than genuinely different code paths. Subsumed by #2. | Add one line: triangulation cases must exercise different code paths/inputs. |

### Blocking Rationale
Finding #1 is a realistic, scoped, actionable data-loss gap squarely in this feature's own declared domain (post-archive verification), missing from both the AC wording and the implementation/tests: a pure-deletion bypass is strictly worse than the two bypasses this feature was built to catch, yet is indistinguishable from "not yet archived" at every layer. The human decision is whether to close it now, accept the residual risk explicitly, or re-scope AC5's wording to acknowledge the gap.

Source: sdd-judge, review-feature phase
Date: 2026-09-02

[2026-09-02T04:36:55Z] Cross-Review (re-review): skipped — cross-agent failure: codex companion colgado en el arranque con cero output durante 40m26s (mismo patrón de broker trabado de la primera ronda); proceso matado sin resultado. Reviewer PASS + Judge PASS consolidaron sin él (advisory). Recomendación del agente: tratar el broker de codex como no disponible en esta sesión.

[2026-09-02T03:28:18Z] JUDGMENT-DAY-HIGH RESOLUTION: el usuario decidió cerrar los dos highs ("cerra los highs"). Findings #1 y #2 se cierran vía tareas nuevas T009 (detección de borrado puro en status/check_archive_integrity + stderr de verify-archive que distingue "never started" de "was tracked, now gone") y T010 (persistir TDD-Evidence por tarea en decisions.md con el patrón de `implemented-by:` + el reviewer lo lee de ahí + riesgo residual de infalsificabilidad del RED registrado explícito). Los mediums #3-#5 y el low #6 quedan como JUDGMENT-DAY warnings registrados, no bloqueantes. Re-review completo requerido tras los fixes.

## Delta: 2026-09-02 — Task T009
- **ADDED**: AC5 is extended beyond the duplicate-tracked shape it originally specced. `check_archive_integrity`/`sdd status` (single-feature mode) now also report `archive-integrity-broken` for a feature-id absent from BOTH `specs/<id>/` and `specs/archive/*-<id>/` when `git log --oneline -1 -- specs/<id>/` proves it was tracked at some point (a pure-deletion bypass: `git rm -r` or an interrupted move, never archived) — previously indistinguishable from an id that never existed (judge finding #1). The `blockers` entry in this shape carries no `specs/archive/...` path (there is none to name); `ARCHIVE_MATCH_RESULT` is `""` and callers branch on that to tell it apart from the original duplicate-tracked shape. `cmd_verify_archive`'s exit-3 "no archive directory found" arm now distinguishes three shapes in stderr: `specs/<id>/` present (unchanged message, "not yet archived"), absent with no git history ("never started"), absent with git history ("was tracked, now gone" / pure-deletion bypass). Exit code stays 3 in all three — only stderr text changed. `sdd status`'s list mode is unextended on purpose: it iterates existing `specs/*/` directories, so a fully-vanished feature-id can never reach its loop in the first place — noted here per the task brief rather than touched.
- **MODIFIED**: `check_archive_integrity`'s doc comment and control flow (`bin/sdd`) restructured from a single early-return guard into an if/else over `specs/<feature_id>/` presence, to make room for the new absent-but-historied branch without changing the existing duplicate-tracked behavior (verified unchanged by the full pre-existing test suite, still green).

[2026-09-02T03:46:00Z] ACCEPTED-RESIDUAL-RISK: la evidencia RED es inherentemente infalsificable post-hoc — el reviewer solo puede confirmar que el test pasa AHORA y que los casos existen; la afirmación de que falló ANTES queda como riesgo residual aceptado, respaldada por persistencia y verificación mecánica, no por garantía determinista equivalente a verify-archive.

## TDD-Evidence

Backfilled for T001-T009 (contract introduced by T010; entries below are reconstructed from the current test suite, not from each slice's original session). T010 onward records its own entry live, per Step 6c.

### TDD-Evidence: T001
- RED: not persisted (contract predates T010)
- GREEN: `build-registry ignores every core skill` (tests/sdd.test.js) passes — the 4 drafted skill names are present in both `CORE_SKILLS` and build-registry's ignore list
- TRIANGULATE: skipped: single structural loop over the fixed 4-name list, no branching behavior to triangulate

### TDD-Evidence: T002
- RED: not persisted (contract predates T010)
- GREEN: describe("sdd verify-archive (T002/AC4)") (tests/sdd.test.js) passes, 4 tests
- TRIANGULATE: 4 cases — bypass commit (altas only) exit 1, legit `--moved-from` exit 0, two archive dirs exit 0 + stderr note, no archive exit 3

### TDD-Evidence: T003
- RED: not persisted (contract predates T010)
- GREEN: describe("sdd status detects a broken archive (026/T003/AC5)") (tests/sdd.test.js) passes, 4 tests
- TRIANGULATE: 4 cases — single-feature mode and list mode, both over the duplicate-tracked shape

### TDD-Evidence: T004
- RED: not persisted (contract predates T010)
- GREEN: describe("T004: TRIANGULATE joins the TDD cycle, TDD-Evidence joins the envelope (026/AC2)") (tests/sdd.test.js) passes, 8 tests
- TRIANGULATE: 8 cases across the implement-task cycle text, the envelope field, sdd-phase-common.md's §D schema, and the testing.md/tdd-skill sync

### TDD-Evidence: T005
- RED: not persisted (contract predates T010)
- GREEN: describe("T005: orchestrators + reviewer validate TDD-Evidence against reality (026/AC3)") (tests/sdd.test.js) passes, 6 tests
- TRIANGULATE: 6 cases across the §F gate clause, its placement inside §F, sdd-next/sdd-auto restatement, and the reviewer's step 2.5 existence + N-cases/CRITICAL checks

### TDD-Evidence: T006
- RED: not persisted (contract predates T010)
- GREEN: "archive-feature's Step 3.5 self-checks verify-archive before deleting the receipt, blocking on a nonzero exit (026 T006/AC6)" + "archive-feature's Step 3.6 points ... branch-pr/chained-pr (026 T006/AC6)" (tests/sdd.test.js) both pass
- TRIANGULATE: 2 cases — self-check ordering/no-branching-syntax test, PR-pointer test

### TDD-Evidence: T007
- RED: not persisted (contract predates T010)
- GREEN: describe("T007: orchestrator post-archive gate (026/AC6)") (tests/sdd.test.js) passes, 3 tests
- TRIANGULATE: 3 cases — byte-identical clause across all 3 orchestration files, clause-sits-inside-its-section boundary check, regression guard that pre-existing clauses stay untouched

### TDD-Evidence: T008
- RED: not persisted (contract predates T010)
- GREEN: tests/sweep-retired-symbols.test.js AC5 (1 test) + AC7 (4 tests) pass; purity greps 0; full suite green
- TRIANGULATE: 5 cases across the two sweep describes — 024-symbols repo-wide walk, plus 025 commit-policy knob fixtures (bin/sdd literal, .claude literal, clean fixture)

### TDD-Evidence: T009
- RED: not persisted (contract predates T010)
- GREEN: describe("sdd status / verify-archive detect a pure-deletion bypass (026/T009, judge finding #1)") (tests/sdd.test.js) passes, 5 tests
- TRIANGULATE: 5 cases — git-rm bypass caught by `sdd status`, caught by `verify-archive`'s distinguishing stderr, unknown id stays plain not-found, list-mode noted unextended (by design), single-mode duplicate-tracked shape unaffected

### TDD-Evidence: T010
- RED: 7/7 new tests failed for the expected reason before the prose edits — e.g. `expect(reviewer).toContain("no \`## TDD-Evidence\` section at all")` failed with "Received string" showing the pre-reword step 2.5 text; `expect(consBody).toContain("infalsificable")` failed against the unmodified ADR 0005 Consecuencias block
- GREEN: same 7 tests pass after editing sdd-implement-task.md (Step 6c), sdd-reviewer.md (step 2.5 reword), review-feature/SKILL.md (Step 3 forwarding line), and docs/adr/0005 (Consecuencias line); full suite 223/223 passed, 5/5 suites, 22.3s

## Simplify: 2026-09-02 — /simplify-code
- **Files simplified**: none (zero-edit pass)
- **Scope reviewed**: `bin/sdd` (`feature_history_exists()`, restructured `check_archive_integrity`, three-way stderr branch in `cmd_verify_archive`, reordered `cmd_status`/`cmd_status_list` — the T009/T010 additions since the first simplify pass, commit cfc50b0). All four already single-purpose with comments documenting non-obvious invariants; no unused params, dead branches, or speculative abstractions. Two candidate DRY extractions considered and rejected as not worth the added indirection: (1) the duplicated "archive-integrity-broken" message line between `cmd_status_list` and `cmd_status` — the two call sites diverge enough downstream (JSON `blockers`, task-count resets) that a shared helper would add a function for a single-line saving with low drift risk; (2) collapsing the repeated `[ ! -d "$specs_dir/$feature_id" ]` test in `cmd_verify_archive`'s three-way branch into a nested form — trades a duplicated cheap stat-test for an added nesting level, no net win.
- **Scope exclusion judgment call**: `.claude/rules/testing.md` and `.specify/templates/rules/testing.md` were in the committed diff (both carry the identical T010 TDD-stance reword) but not literally covered by the exclusion glob list (`.claude/rules/**` isn't listed; `.specify/templates/*.md` doesn't cross the `rules/` subdirectory by glob semantics). Treated both as out of scope per the exclusion rationale's own text ("templates... are prose artifacts, not code") — they are a template and its generated instance, intentionally byte-identical; DRY-ing one against the other would defeat the templating purpose. Flagging the glob-list gap for anyone tightening the exclusion patterns later.
- **Baseline**: pass (223/223 tests, 5/5 suites, ~22s; no lint/typecheck tooling configured in this repo) | **Post-edit**: n/a (no edits applied)
- TRIANGULATE: 7 cases across 4 files — Step 6c presence, Step 6c ordering (6b < 6c < Step 7), reviewer's decisions.md-as-source phrasing, reviewer's different-code-paths line, reviewer's absent-evidence CRITICAL rule, review-feature Step 3 forwarding line scoped inside Step 3's own section, ADR 0005 Consecuencias content

## Deltas merged
[2026-09-02T15:00:00Z] Merged T001 (MODIFIED branch-pr line-15), T009 (ADDED AC5 pure-deletion detection), and T010 (ADDED TDD-Evidence persistence) into spec.md; all acceptance criteria now checked.