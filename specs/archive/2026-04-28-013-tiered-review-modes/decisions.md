# Decisions

## Smoke Test Coverage — 2026-04-27 — Tasks T01-T12

All 7 ACs mapped to inline-testable vs deferred verification:

| AC | Scenario | Test method | Verdict |
|----|----------|-------------|---------|
| AC1 | `spec.md`, no `--minimal` → tier=`full-spec`, 3 voters + adversarial | Static: Step 1.5 logic table covers this path; `voter_count=3`, `adversarial_enabled=true` | Inline-verified (logic inspection) |
| AC2 | `quick-spec.md` only, no `--minimal` → tier=`fast-lane`, 1 voter + adversarial | Static: Step 1.5 logic table covers `FAST_LANE=true`, `voter_count=1`, `adversarial_enabled=true` | Inline-verified (logic inspection) |
| AC3 | Any folder + `--minimal` → tier=`minimal`, 1 voter, no adversarial | Static: Step 1.5 precedence — `--minimal` wins regardless of folder; `voter_count=1`, `adversarial_enabled=false`; Step 5.5 tier gate skips adversarial | Inline-verified (logic inspection) |
| AC4 | `spec.md` + `--minimal` → stderr warning + timestamped audit line in `decisions.md` | Static: Step 1.5 audit-on-downgrade block; format pinned to `[YYYY-MM-DDTHH:MM:SSZ] review-tier=minimal (downgraded from full-spec via --minimal)` | Inline-verified; **deferred end-to-end** (requires live review run) |
| AC5 | Re-review without flag resolves same tier (deterministic) | Static: tier is derived from folder type + `--minimal` flag in `$ARGUMENTS` — no persisted state; re-running `/review-feature <id>` without flag always yields same tier as first run | Inline-verified (stateless design) |
| AC6 | `/sdd-auto --minimal <id>` — earlier phases ignore flag | Static: `sdd-next` Step 1 and `sdd-auto` Step 1 extract `--minimal` once; feature-id passed clean to all non-review phases; only review-feature phase receives `--minimal` | Inline-verified (logic inspection) |
| AC7 | Voter/adversarial orthogonality matrix | Static: Step 3 pass-through (N=1) / voting (N=3) drives `Status`; Step 5.5 adversarial drives `Spec-Gaps` independently; voter FAIL → review FAIL before adversarial runs (Step 5.5 conformance gate); voter PASS + adv HIGH → blocked; voter PASS + adv med/low → SPEC-GAP, advance | Inline-verified (logic inspection) |

## Simplify: 2026-04-27 — /simplify-code
- **Files simplified**: none (committed diff is empty; all 013 changes are unstaged working-tree modifications)
- **Changes**: no modifications made — SCOPED_FILES empty by design (HEAD = main HEAD, no committed diff)
- **Baseline**: pass | **Post-edit**: SKIP (no files in scope)

### Deferred manual verifications

The following require a live review run to confirm end-to-end behaviour (no test harness in repo):

| # | Scenario | How to verify |
|---|----------|--------------|
| D1 | AC4 end-to-end: `decisions.md` audit line has correct ISO-8601 UTC timestamp format | Run `/review-feature <full-spec-id> --minimal`; check `specs/<id>/decisions.md` for new line |
| D2 | AC2 end-to-end: fast-lane adversarial fires and gap handling matches full-spec | Run `/review-feature <fast-lane-id>` on a `quick-spec.md` feature; confirm 1 voter + adversarial in envelope |
| D3 | AC6 end-to-end: confirm earlier agents do NOT receive `--minimal` in their `Feature-id` line | Run `/sdd-auto --minimal <id>` from plan phase; inspect implement-task prompt content |
| D4 | AC7 end-to-end: voter FAIL + adversarial PASS → review FAIL (adversarial does not rescue) | Requires a feature where voter finds a real failure |

## SPEC-GAP — 013-tiered-review-modes — adversarial review

| # | Severity | Category | Description | Suggested Action |
|---|----------|----------|-------------|-----------------|
| 1 | low | uncovered-scenario | `--minimal` on a fast-lane folder (`quick-spec.md` only) results in silent tier=minimal with no audit write. AC4 only requires audit when downgrading from full-spec. Fast-lane + `--minimal` is a valid but undocumented silent downgrade. | Add a note in spec and Step 1.5 clarifying that audit is only written for full-spec → minimal downgrade, and fast-lane + `--minimal` is silently accepted. |
| 2 | low | incomplete-AC | AC5 doesn't distinguish "re-run without `--minimal`" from "re-run with same `--minimal`." If user runs with `--minimal`, gets FAIL, fixes, then re-runs without `--minimal`, the tier changes to full-spec. This is correct behavior (EC7 covers it) but AC5's wording could lead to incorrect expectation. | Tighten AC5 wording: "re-running review with the same flags yields tier=X; running without `--minimal` yields tier resolved from folder type." |
| 3 | low | edge-case | Both `spec.md` and `quick-spec.md` co-existing in a folder — tier resolution is correct (FAST_LANE=false wins) but not explicitly stated in the spec's Tier Matrix or EC list. | Add a note to the Tier Matrix or a new EC: "If both `spec.md` and `quick-spec.md` exist, treat as FAST_LANE=false (full-spec takes precedence)." |
| 4 | low | undocumented-assumption | LLM agents may produce malformed ISO-8601 timestamps (timezone offset instead of Z, missing seconds, etc.). The audit format is pinned but not validated. | Document the assumption ("LLM produces well-formed timestamps") or add a post-write validation note in Step 1.5. |

Source: adversarial review agent, review-feature phase
Date: 2026-04-27
