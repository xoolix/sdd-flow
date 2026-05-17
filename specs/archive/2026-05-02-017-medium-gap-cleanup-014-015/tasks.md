# Tasks — 017-medium-gap-cleanup-014-015

## Execution order

### 1. Foundation

- [x] **T01 — Branch**: Create `feature/017-medium-gap-cleanup-014-015` from main.

### 2. Core implementation — Sub-flow A (Engram session detection)

- [x] **T02 — Empirical mem_context observation**: Call `mem_context` in two states: (a) no active session, (b) after `mem_session_start`. Record exact response field names and shapes per state; identify the disambiguator field.

- [x] **T03 — Document signal in engram-protocol.md**: Insert new section "Active session detection" in `.claude/skills/_shared/engram-protocol.md` after the "Compaction Safety Protocol" block (line 148+). Include: (a) shape per state, (b) exact disambiguator field name from T02, (c) Engram-unavailable fallback (`assume no session; do not call mem_session_start; do not error`).

- [x] **T04 — Update plan-feature Step 0**: Edit `.claude/skills/plan-feature/SKILL.md` Step 0 (lines 38-43) — replace vague `if response indicates active session` with explicit field check from T03; add explicit fallback `mem_session_start` on malformed/error/missing.

- [x] **T05 — Update review-feature Step 0**: Edit `.claude/skills/review-feature/SKILL.md` Step 0 (lines 41-48) — identical update as T04 (same field reference, same fallback wording).

### 3. Core implementation — Sub-flow B (Filesystem detection guard)

- [x] **T06 — Guard in sdd-next**: Insert hard-error guard in `.claude/skills/sdd-next/SKILL.md` Step 3 before lines 72-79. If phase ∈ `["plan-feature", "review-feature"]` AND `.claude/agents/sdd-<phase>.md` exists → emit error naming file, phase, remediation; halt. KNOWN_ORCHESTRATORS inline.

- [x] **T07 — Guard in sdd-auto**: Insert identical guard in `.claude/skills/sdd-auto/SKILL.md` Step 2 (lines 49-56). KNOWN_ORCHESTRATORS inline (intentional duplication per OQ-3). Add comment in both files to keep lists in sync.

### 4. Core implementation — Sub-flow C (Measurement script)

- [x] **T08 — Create measurement script**: Create `scripts/sdd-measure-fastlane-ratio.sh` (executable, `chmod +x`). Args: `--window <weeks>` (default 4), `--archive-root <path>` (default `specs/archive/`). Glob `YYYY-MM-DD-NNN-*` only (skip legacy no-date-prefix folders). Per folder: classify `quick-spec` (has quick-spec.md only) / `spec` (has spec.md only) / `unknown` (both or neither, with stderr warn). Filter by date within window. Emit `key=value` to stdout: `total`, `spec`, `quick_spec`, `unknown`, `ratio`, `verdict`. Verdict rules: `total<3 → inconclusive`; `total≥3 && ratio≥2.0 → pass`; else `fail`. Exit 0 always.

- [x] **T09 — Archive addendum**: Append POST-ARCHIVE ADDENDUM to `specs/archive/2026-05-01-014-fast-lane-visibility/decisions.md`. Include: today's date, script path (`scripts/sdd-measure-fastlane-ratio.sh`), role-based owner ("current SDD maintainer at time of measurement"), three verdict rules verbatim. Tag block clearly to avoid confusion with delta-spec entries.

### Checkpoint: Sub-flows A, B, C complete — verify all 7 files touched before Validation

### 5. Validation

- [x] **T10 — SC-3 smoke test (guard)**: `touch .claude/agents/sdd-plan-feature.md`; invoke `/sdd-next` on a plan-routed feature (has spec.md, no plan.md); verify hard-error fires naming file, phase, remediation. Cleanup: `rm .claude/agents/sdd-plan-feature.md`.

- [x] **T11 — SC-2 smoke test (script)**: Run `scripts/sdd-measure-fastlane-ratio.sh` on repo; assert exit 0; assert `verdict=` line in output; assert 003/004 legacy folders excluded from counts. Run with `--window 0` and verify `verdict=inconclusive`.

- [x] **T12 — AC sign-off**: Read all 5 AC targets (engram-protocol.md, plan-feature Step 0, review-feature Step 0, sdd-next guard, sdd-auto guard, script, archive addendum). Confirm all 5 ACs satisfied. Document sign-off in `specs/017-medium-gap-cleanup-014-015/decisions.md`.

## Notes
- T02 must complete before T03; T03 before T04/T05. Sub-flows B and C are independent of A.
- Update `decisions.md` if implementation diverges from plan.md.
