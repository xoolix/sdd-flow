# Decisions

## D-001 — AC sign-off (T12) [2026-04-30]

All 5 acceptance criteria verified as satisfied.

| AC | Evidence |
|---|---|
| AC-1 (engram-protocol.md "Active session detection" section, derived from empirical) | T03 — section appended after Compaction Safety Protocol; disambiguator = `### Recent Sessions` heading presence |
| AC-2 (plan-feature + review-feature SKILL.md Step 0 reference signal explicitly) | T04+T05 — both Step 0 blocks updated identically with explicit field check + fallback |
| AC-3 (sdd-next/sdd-auto hard-error on orchestrator file present) | T06+T07 — KNOWN_ORCHESTRATORS guard inline in both SKILLs; T10 structural trace confirms guard fires before filesystem-side branch logic |
| AC-4 (script scans archive in window, classifies, emits key=value + verdict) | T08+T11 — smoke runs verified output format + verdict = fail (ratio 0.33), exit 0 |
| AC-5 (POST-ARCHIVE ADDENDUM in 014 archive decisions.md) | T09 — block appended with script path, role-based owner, 3 verdict rules verbatim |

Implementation-complete: 12/12 tasks done.

## Simplify: 2026-04-30 — /simplify-code

- **Files simplified**: `scripts/sdd-measure-fastlane-ratio.sh`
- **Changes**: Extracted the `total=$(( total + 1 ))` increment out of all three classification branches (quick/spec/unknown) into a single statement after the if/elif/else block — DRY improvement, behavior identical.
- **Scope note**: Committed diff (main..HEAD) was empty because all changes are uncommitted per git.md. User explicitly scoped the bash script for simplification; all `.claude/skills/**/*.md` files were excluded as SDD prose artifacts.
- **Baseline**: pass | **Post-edit**: pass

## D-002 — Plan-vs-implementation deltas (2026-05-02)

Surfaced by 3-voter review; deltas not affecting AC compliance but worth recording per "Work mode" convention.

| Plan said | Impl chose | Reason |
|---|---|---|
| Output key `quick_spec=` | `quick=` | Shorter, equally machine-readable; no consumers existed at impl time. AC-4 requires "machine-readable counts" without naming keys. |
| `WINDOW_DAYS` env var (default 28 days) | `--window <weeks>` CLI flag (default 4 weeks) | T08 already refined to CLI flag; functionally equivalent (4 weeks = 28 days). CLI flag is more discoverable for a user running the script ad-hoc. |
| Filter by mtime ≤ WINDOW_DAYS | Lexicographic compare of `YYYY-MM-DD` prefix in folder name | Folder-name approach is reproducible (mtime can shift on git operations like `git checkout`). Improvement over plan. |
| Engram version stamp in "Active session detection" section + "re-validate on upgrade" note | NOT included | Dropped silently. Plan's risk mitigation is sound but adds maintenance burden. Re-validation can be added later if Engram releases break the disambiguator. |

**Decision**: deltas accepted as-is. SC-1 from spec is met functionally regardless of these wording differences.

## D-003 — T10 verification methodology (2026-05-02)

T10 (SC-3 smoke test for orchestrator-file guard) was performed via **structural trace** (read SKILL.md, confirm guard placement before existing branch logic, touch+rm cycle), not via live `/sdd-next` invocation. Reason: sdd-next is LLM-driven and not directly executable from within an executor sub-agent context (recursion boundary). Structural verification is the strongest possible from within the implementation phase.

**Mitigation**: Operator can perform the live test post-merge by running `touch .claude/agents/sdd-plan-feature.md && /sdd-next <feature-id>` and observing the hard-error.

## SPEC-GAP — Adversarial review (2026-05-02)

3 voters PASS WITH WARNINGS unanimous. Adversarial: 0 high, 3 medium, 3 low. None block ship; recorded for follow-up.

**Medium**:
- **SPEC-GAP-1 (undocumented-assumption)**: AC-1/AC-2 pin disambiguator to literal `### Recent Sessions` heading. D-002 dropped plan's "re-validate on Engram upgrade" note. If a future Engram release renames or restructures the heading, the guard inverts silently — phases run outside orchestrator session always skip `mem_session_start` and lose phase observations from `mem_context` recovery. **Suggested fix**: add re-validation trigger to spec; restore Engram version stamp; CI check that surfaces regression.
- **SPEC-GAP-2 (undocumented-assumption)**: KNOWN_ORCHESTRATORS guard is LLM-instruction-only (prose in 2 SKILL.md files). No machine-enforceable check. An LLM under token pressure may skip the guard block. D-003 acknowledges T10 was structural-only; risk of skipped guard exists. **Suggested fix**: add explicit acknowledgment that guard is best-effort; OR add shell pre-check wrapper callable by harness.
- **SPEC-GAP-3 (incomplete-AC)**: AC-4/AC-5 + SC-1 say `verdict=fail` triggers "retro discussion" but neither spec nor addendum defines: who schedules, what retro produces, time frame, where outcome is recorded. `fail` is currently unactionable. **Suggested fix**: add Retro process to AC-5 — owner + deliverable + recording location.

**Low**:
- **SPEC-GAP-4 (uncovered-scenario)**: Engram session auto-expiry conflict — if orchestrator session times out mid-pipeline, phases open their own session creating concurrent sessions for same run. **Suggested fix**: add as known degraded behavior or confirm pipeline duration < Engram TTL.
- **SPEC-GAP-5 (edge-case)**: Script `verdict=fail` when all archives are `unknown` but `total≥3` (all have both `spec.md` + `quick-spec.md` — migration scenario). Misleading. **Suggested fix**: rule "if `spec + quick = 0` and `total > 0` → inconclusive".
- **SPEC-GAP-6 (undocumented-assumption)**: Script depends on CWD for relative `--archive-root` resolution. Subdirectory invocation fails. **Suggested fix**: auto-detect via `git rev-parse --show-toplevel` or document repo-root requirement in script header.

**Decision**: ship 017. None of these gaps block correctness. Address in follow-up features as priorities allow. Particularly worth re-visiting SPEC-GAP-1 if there's a real Engram upgrade in pipeline.

## Deltas merged into spec.md [2026-05-02]

Merged 4 entries from D-002 (plan-vs-implementation) and D-003 (T10 methodology):

1. **Disambiguator field name (D-002, AC-1)**: Added explicit field name `` `### Recent Sessions` `` heading to spec.md section A step 2.
2. **Script output format (D-002, AC-4)**: Updated AC-4 to reflect `key=value` format with specific key names (`total`, `spec`, `quick`, `unknown`, `ratio`, `verdict=`); added step 3 detailing verdict rules explicitly.
3. **Window parameter (D-002, AC-4)**: Updated AC-4 to specify `--window <weeks>` CLI flag instead of env var; noted functional equivalence (4 weeks = 28 days).
4. **Filtering approach (D-002, happy path C)**: Updated step 1 to specify lexicographic date-prefix comparison instead of mtime; noted reproducibility benefit.
5. **Implementation notes section**: Added "Notes on Implementation vs Plan" documenting all four deltas, including dropped Engram version stamp rationale.

Spec.md now reflects final implementation state. Review verdict PASS WITH WARNINGS preserved. SPEC-GAPs recorded as-is for follow-up.
