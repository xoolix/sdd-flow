# Tasks

## Execution order

### 1. Silent-degradation fixes

- [x] **T001 [AFK] `cmd_base_branch` finds archived sidecars (resolution axis, 7 values)**: Layer 1 uses `resolve_feature_dir` via the guarded idiom (`if ! feature_dir="$(resolve_feature_dir ...)"`), not the hardcoded `specs/${feature_id}/.parent-branch`. Adds `cmd_base_branch`'s first tests: active feature; dated-archive feature; legacy archive prefix (`specs/archive/003-plan-discovery-checkpoint`, F1's concrete guard case); unresolvable id (falls through to Layer 2, no abort under `set -euo pipefail`); empty sidecar (falls to Layer 2); sidecar names a missing branch (exit 2, `Unchanged`); nothing resolvable (exit 3, `Unchanged`).
  - blocked_by: none
  - verifies: AC1, AC8
  - touches: bin/sdd, tests/sdd.test.js

- [x] **T002 [AFK] `extract_section` ignores headings inside fences (structure + line-ending axes)**: Two independent toggles for ` ``` ` and `~~~`, tracked from file start, ignore `## ` while inside either; an unterminated fence stays "inside" through EOF (cut short, never truncate wrong). Covers both consumers, `cmd_domain_vocab` and `build_pr_body_file`. Adds fence tests for both chars on both consumers, plus a CRLF test for the PR-body consumer (today only `cmd_domain_vocab` has one).
  - blocked_by: none
  - verifies: AC4, AC8
  - touches: bin/sdd, tests/sdd.test.js

- [x] **T003 [AFK] `commit-slice` warns on pre-staged feature-dir files (index-state axis, 4 values)**: Normalize `feature_dir` (absolute) to repo-relative before comparing against the existing `pre_staged` snapshot (repo-relative) — otherwise the comparison never matches and the warning never fires. Warn naming any feature-dir file staged before the call; committed content is unchanged. Adds tests for: clean index; staged outside the feature dir (no warning, existing case); staged inside (warning fires, new case); both at once (both warnings fire independently, proving the opposite-polarity exclusion-set and inclusion-set warnings don't merge).
  - blocked_by: none
  - verifies: AC5, AC8
  - touches: bin/sdd, tests/sdd.test.js

- [x] **T004 [AFK] `/simplify-code` excludes agent and ADR docs by filter**: Add `.claude/agents/**/*.md` and `docs/adr/**/*.md` to the SDD-artifacts exclusion list in `sdd-simplify-code.md` step 3, so these are dropped by the filter, not manual judgment. Adds a wiring-regression assertion in `tests/sdd.test.js` pinning the new entries — new coverage, since nothing pins this list today; `tests/sdd.test.js:462-493` already pins other prose in the same file, so the full suite guards against collateral damage.
  - blocked_by: none
  - verifies: AC6
  - touches: .claude/agents/sdd-simplify-code.md, tests/sdd.test.js

- [ ] **T005 [AFK] `sdd-designer` uses the vocabulary `plan-feature` already resolved**: In the discovery-resume path, `sdd-designer.md` currently re-runs `sdd domain-vocab` itself and falls back, on failure, to wording naming "exploration findings" that don't exist on that path (Step 4 is skipped). Use the vocabulary Step 2.5 already resolved and passed in, matching `plan-feature/SKILL.md`'s own correct fallback (spec.md, not exploration findings). Updates `tests/sdd.test.js:1810-1827` in the same slice — it asserts the buggy phrase today and must assert the corrected one.
  - blocked_by: none
  - verifies: AC7
  - touches: .claude/agents/sdd-designer.md, tests/sdd.test.js

## Notes
- No `[HITL]`: the one real fork (PR-provenance vs. the stdout guardrail) was resolved by cutting `cmd_open_pr` from scope.
- Five slices are independent edits to distinct functions/files; run in any order. AC8's four axes live inside T001 (resolution), T002 (structure + line endings), T003 (index state) — no separate slice.
- Out of scope, untouched: `cmd_open_pr`, `write_pr_opened_sentinel`, `.pr-opened`'s format, base provenance.
