# Technical Plan — 017-medium-gap-cleanup-014-015

## Inputs
- Spec: `specs/017-medium-gap-cleanup-014-015/spec.md` (5 ACs, 5 edge cases, 3 SCs)
- Discovery decisions: all accepted; high finding already covered by AC-3 (no new pause)

## Domain analysis

| Domain | Complexity | Notes |
|--------|-----------|-------|
| A — Engram session-detection docs | SMALL | new subsection + 2 SKILL.md line edits |
| B — Filesystem guard (orchestrator check) | SMALL | additive guard in 2 SKILLs; no logic removal |
| C — Measurement script + archive addendum | SMALL-MEDIUM | new shell script + append to archived file |

**Overall**: SMALL-MEDIUM. Three independent sub-flows; sequential with checkpoints between each.

## Current state

| File | Relevant excerpt |
|------|-----------------|
| `engram-protocol.md:132+` | "Compaction Safety Protocol" ends at line 148; no "Active session detection" section exists |
| `plan-feature/SKILL.md:38-43` | Step 0 says `if the response indicates an active session` — signal is unspecified |
| `review-feature/SKILL.md:41-48` | Identical wording to plan-feature Step 0; same ambiguity |
| `sdd-next/SKILL.md:72-79` | Filesystem-only branch check; no known-orchestrator guard, no hard-error path |
| `sdd-auto/SKILL.md:49-56` | Word-for-word identical block; same gap |
| `scripts/` | Directory does not exist (new) |
| `specs/archive/2026-05-01-014-fast-lane-visibility/decisions.md` | Exists; no POST-ARCHIVE ADDENDUM |

## Proposed design

### Sub-flow A — Active session detection (AC-1, AC-2)

1. Implementer empirically calls `mem_context` twice: (a) cold (no session), (b) after `mem_session_start`. Records exact field names / shapes for both states.
2. Inserts new subsection **"Active session detection"** in `engram-protocol.md` after line 148 ("Compaction Safety Protocol" end). Documents: shape per state, exact disambiguator field, Engram-unavailable fallback (`assume no session; do not call mem_session_start; do not error`).
3. Updates `plan-feature/SKILL.md` Step 0 and `review-feature/SKILL.md` Step 0 to replace vague language with: `check <field> from mem_context; if malformed/error/missing → call mem_session_start`.

### Sub-flow B — Orchestrator filesystem guard (AC-3)

Guard added to **both** `sdd-next/SKILL.md` Step 3 and `sdd-auto/SKILL.md` Step 2 item 2. Placement: immediately before the existing `if EXISTS → leaf / ABSENT → orchestrator` branch.

Known-orchestrator list is **inline** in each SKILL (two entries: `plan-feature`, `review-feature`). Intentional duplication — YAGNI; migrate to shared file only if list exceeds 5 entries.

Hard-error template:
```
ERROR: .claude/agents/sdd-<phase>.md detected.
Phase '<phase>' is an orchestrator and must not have an agent file.
Remediation: remove .claude/agents/sdd-<phase>.md and re-run.
```

### Sub-flow C — Measurement script + archive addendum (AC-4, AC-5)

| Item | Detail |
|------|--------|
| Script path | `scripts/sdd-measure-fastlane-ratio.sh` (new directory) |
| Glob pattern | `specs/archive/YYYY-MM-DD-*` only; skip `003-*`, `004-*` (no date prefix) |
| Window param | `WINDOW_DAYS` env var; default `28` |
| Classification | has `quick-spec.md` → `quick-spec`; has `spec.md` only → `spec`; both → `unknown` + warn |
| Output format | `key=value`, one per line: `total`, `spec`, `quick_spec`, `unknown`, `ratio`, `verdict` |
| Verdict rules | `total<3 → inconclusive`; `total≥3 && ratio≥2.0 → pass`; else `fail` |
| Exit codes | 0 always (including inconclusive/zero-result); non-zero only on script error |
| Archive addendum | Append to `specs/archive/2026-05-01-014-fast-lane-visibility/decisions.md` with today's date, script path, role-based owner ("current SDD maintainer at time of measurement"), three verdict rules verbatim |

## Touched files

| File | Change type |
|------|------------|
| `.claude/skills/_shared/engram-protocol.md` | Insert new subsection after line 148 |
| `.claude/skills/plan-feature/SKILL.md` | Edit Step 0 lines 39-40 |
| `.claude/skills/review-feature/SKILL.md` | Edit Step 0 lines 44-45 |
| `.claude/skills/sdd-next/SKILL.md` | Insert guard before existing branch at line 72 |
| `.claude/skills/sdd-auto/SKILL.md` | Insert guard before existing branch at line 49 |
| `scripts/sdd-measure-fastlane-ratio.sh` | New file (executable) |
| `specs/archive/2026-05-01-014-fast-lane-visibility/decisions.md` | Append POST-ARCHIVE ADDENDUM |

**APIs/contracts**: none. **DB/schema**: none. **Jobs/workers**: none. **UI**: none.

## Data flow

```
Sub-flow A:
  implementer → mem_context (cold) → observe shape
  implementer → mem_session_start → mem_context (active) → observe shape
  shapes → engram-protocol.md "Active session detection"
  engram-protocol.md → plan-feature/SKILL.md Step 0 (reference)
  engram-protocol.md → review-feature/SKILL.md Step 0 (reference)

Sub-flow B:
  sdd-next/sdd-auto Step N → check known-orchestrator list (inline)
    → if phase in list AND .claude/agents/sdd-<phase>.md EXISTS → hard-error
    → else → existing branch logic unchanged

Sub-flow C:
  scripts/sdd-measure-fastlane-ratio.sh
    → glob specs/archive/YYYY-MM-DD-* (filter by mtime ≤ WINDOW_DAYS)
    → classify each folder
    → emit key=value to stdout
  decisions.md → append POST-ARCHIVE ADDENDUM (one-time, manual at implementation)
```

## Migration / rollout

- **No migration**. All changes are additive (new section, new guard, new script, archive append).
- Rollback per-gap: `git revert <commit>` or `git checkout <sha> -- <files>`.
- Sub-flow B hard-error risk: if a legitimate workflow re-creates the agent file, the error message provides remediation; revert is immediate.

## Observability

| Signal | How |
|--------|-----|
| Sub-flow A correctness | Review the new engram-protocol.md section for completeness post-implementation |
| Sub-flow B guard | SC-3: `touch .claude/agents/sdd-plan-feature.md` + invoke sdd-next → verify hard-error message |
| Sub-flow C output | SC-2: run script on repo; assert exit 0 + `verdict=` line present |

## Test strategy

| AC | Validation method |
|----|------------------|
| AC-1 | Read engram-protocol.md — confirm new section has (a) shape per state, (b) named disambiguator field, (c) unavailable fallback |
| AC-2 | Read plan-feature/SKILL.md + review-feature/SKILL.md Step 0 — confirm field name referenced + fallback explicit |
| AC-3 | SC-3 smoke: `touch .claude/agents/sdd-plan-feature.md`, run sdd-next on plan-phase feature, confirm hard-error |
| AC-4 | Run `scripts/sdd-measure-fastlane-ratio.sh`; assert exit 0; assert `verdict=` in output; test with WINDOW_DAYS=0 → inconclusive |
| AC-5 | Read decisions.md — confirm POST-ARCHIVE ADDENDUM section present with script path, role owner, three rules |

No new unit test files required (shell script; validated by direct invocation).

## Risks and mitigations

| Risk | Mitigation |
|------|-----------|
| Empirical mem_context shape changes between Engram versions | Document Engram version at observation time; note in protocol that re-validation is needed on Engram upgrade |
| Both `quick-spec.md` and `spec.md` present in one archive folder | Emit `unknown` + warn line to stderr; does not crash or silently miscategorize |
| sdd-next / sdd-auto SKILL.md diverge after this feature | Inline list is intentional duplication; comment in both files notes to keep in sync |
| Zero archives in window | Script emits `total=0\nverdict=inconclusive`, exits 0 — spec edge case covered |
