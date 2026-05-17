# Feature: Medium-severity gap cleanup (014 + 015 post-mortem)

## Summary
Resolve three medium-severity SPEC-GAPs (post-mortem of 014 + 015) — latent ambiguities risking silent SDD runtime failures. Three independent fix domains.

## Trigger
Maintenance. Activates at next invocation of affected skills + new on-demand script.

## Happy Path

**A — `mem_context` active-session signal (015 SPEC-GAP-2)**
1. Empirically call `mem_context` in two states (no session; active via `mem_session_start`); record exact response shape per state.
2. Document shapes + disambiguator (exact field name: `### Recent Sessions` heading presence) + Engram-unavailable fallback in a new "Active session detection" section in `.claude/skills/_shared/engram-protocol.md`.
3. Update `plan-feature/SKILL.md` + `review-feature/SKILL.md` Step 0 to reference the documented signal explicitly; fallback on malformed/error/missing → `mem_session_start`.

**B — Filesystem detection guard (015 SPEC-GAP-3)**
1. Guard in `sdd-next` + `sdd-auto`: before spawning a known-orchestrator phase, check if `.claude/agents/sdd-<phase>.md` exists.
2. If present → hard-error naming file, phase, remediation. No silent spawn, no escape hatch.
3. Single source of truth for the known-orchestrator list.

**C — SC-1 measurement operationalization (014 SPEC-GAP-3)**
1. Add `scripts/sdd-measure-fastlane-ratio.sh`: scans `specs/archive/YYYY-MM-DD-NNN-*/` in a configurable window via `--window <weeks>` flag (default 4 weeks); classifies each as `quick`/`spec`/`unknown` (based on presence of quick-spec.md vs spec.md); emits machine-readable counts + ratio + verdict.
2. Classification logic: folder has quick-spec.md only → `quick`; has spec.md only → `spec`; has both or neither → `unknown` (with stderr warning); filter by lexicographic date-prefix comparison against archive date.
3. Verdict rules: `total<3 → inconclusive`; `total≥3 && ratio≥2.0 → pass`; `total≥3 && ratio<2.0 → fail`.
4. Append dated POST-ARCHIVE ADDENDUM to `specs/archive/2026-05-01-014-fast-lane-visibility/decisions.md`: script path, role-based owner ("current SDD maintainer at time of measurement"), three verdict rules verbatim.

## Domains
- [x] Other: SDD protocol docs (A); skill orchestration (A+B); shell scripts (C); archived feature record (C)

## Edge Cases
- **Engram absent** (A): `mem_context` unavailable → "no session, do not start, do not error".
- **Ambiguous response shape** (A): if states return similar payloads, signal must name exact disambiguator (not "non-empty").
- **New orchestrator added later** (B): list lives in one place; no duplication.
- **Legitimate fork override** (B): no silent path; override = fork (out of scope).
- **Zero archived features in window** (C): emits `inconclusive`, exit 0, no crash.

## Acceptance Criteria
- [ ] **AC-1**: Given 017 in implementation, When implementer empirically calls `mem_context` with and without an active session, Then `engram-protocol.md` gains an "Active session detection" section documenting (a) shape per state, (b) disambiguator, (c) Engram-unavailable fallback — derived from observed output.
- [ ] **AC-2**: Given the signal is documented, When a dev reads `plan-feature/SKILL.md` Step 0 and `review-feature/SKILL.md` Step 0, Then both reference it explicitly with explicit fallback (`mem_session_start` on malformed/error/missing).
- [ ] **AC-3**: Given `.claude/agents/sdd-plan-feature.md` or `sdd-review-feature.md` exists, When `/sdd-next` or `/sdd-auto` routes to that orchestrator, Then the skill hard-errors naming file, phase, and remediation.
- [ ] **AC-4**: Given `scripts/sdd-measure-fastlane-ratio.sh` is executable, When run with `--window <weeks>` (default 4), Then it scans archive folders matching `YYYY-MM-DD-NNN-*`, classifies each as `quick`/`spec`/`unknown` (based on which spec file exists, filtering legacy no-date-prefix folders), and emits machine-readable counts (`total`, `spec`, `quick`, `unknown`, `ratio`) and one line with `verdict=` in `pass`/`fail`/`inconclusive` per the rules.
- [ ] **AC-5**: Given script + rules exist, When a reader opens `specs/archive/2026-05-01-014-fast-lane-visibility/decisions.md`, Then a dated POST-ARCHIVE ADDENDUM references the script path, names the role-based owner, and lists the three verdict rules verbatim.

## Rollback Plan
- Per-gap revert. Files: A → `engram-protocol.md` + 2 SKILL.md; B → `sdd-next/SKILL.md` + `sdd-auto/SKILL.md`; C → new script + archive addendum.
- `git revert <commit>` or `git checkout <prev-sha> -- <files>`. No DB, no infra, no flags.
- Gap B risk: hard-error could break a workflow that legitimately recreated the file — mitigation is the diagnostic message; revert restores immediately.

## Success Criteria
- **SC-1** (A, 4 weeks post-merge): zero orphan/duplicate Engram session reports in real `/sdd-next` or `/sdd-auto` runs.
- **SC-2** (C, immediate): script produces non-error exit + parseable verdict line on first run, no manual fix-up.
- **SC-3** (B, immediate): `touch .claude/agents/sdd-plan-feature.md` + `/sdd-next` on plan-routed feature → documented hard-error within one detection cycle.

## Notes on Implementation vs Plan
- Script output uses `key=value` format (machine-readable); key names shortened from plan (e.g., `quick` vs `quick_spec`) — equally readable without breaking AC compliance.
- Disambiguator confirmed empirically as `### Recent Sessions` heading presence in `mem_context` response.
- Window specified as CLI flag `--window <weeks>` (more discoverable) rather than env var; functionally equivalent (4 weeks = 28 days).
- Folder filtering uses lexicographic date-prefix comparison instead of mtime (reproducible across git operations).
- Plan's "Engram version stamp" note was dropped during implementation to minimize maintenance burden; re-validation can be added if Engram releases require it (see SPEC-GAP-1).
