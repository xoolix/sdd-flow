# Tasks — 013-tiered-review-modes

## Execution order

### 1. Foundation
- [x] **T01** Create branch `feature/013-tiered-review-modes` from current HEAD (clean tree).
- [x] **T02** In `.claude/agents/sdd-review-feature.md`, add new **Step 1.5: Resolve tier** between Step 1 and Step 2. Parse `$ARGUMENTS` for exact token `--minimal`; inspect folder for `spec.md` vs `quick-spec.md`; resolve `tier ∈ {minimal, fast-lane, full-spec}` per spec Tier Matrix. Bind `voter_count` (1 or 3) and `adversarial_enabled` (true/false) for downstream steps.

### 2. Core implementation
- [x] **T03** In Step 1.5, add audit-on-downgrade: if `--minimal` AND folder has `spec.md`, emit stderr warning containing `"downgrading full-spec to minimal review on user request"` AND append to `specs/$ARGUMENTS/decisions.md` (create if absent) one line: `[<ISO-8601 UTC>] review-tier=minimal (downgraded from full-spec via --minimal)`.
- [x] **T04** In Step 2, make voter count tier-driven: launch `voter_count` parallel `sdd-reviewer-voter` agents. For N=1, single agent label is `A`.
- [x] **T05** In Step 3, add early branch: if `voter_count == 1`, voter verdict IS review verdict (no aggregation). Existing 3-agent matrix runs only for N=3. In Step 4, "Vote Summary" reads `Agent-A: <verdict>` for N=1.
- [x] **T06** In Step 5.5, add tier gate at top: skip entire adversarial step if `adversarial_enabled == false` (minimal tier), regardless of conformance verdict.
- [x] **T07** In Result envelope template, add `tier: <resolved>` field on all paths (PASS / FAIL / blocked). Update Step 6 (Engram save) to include tier for SC1 measurement.
- [x] **T08** In `.claude/skills/sdd-next/SKILL.md` Step 1, add flag-parsing: split `$ARGUMENTS` on whitespace, extract exact token `--minimal` (NOT substring match). In Step 3, pass `--minimal` to sub-agent prompt ONLY when the detected phase is `review-feature`; other phases get clean args.
- [x] **T09** In `.claude/skills/sdd-auto/SKILL.md`, mirror T08: parse `--minimal` once at pipeline start, pass to review-feature launches only. Verify the Step 2b fix-loop re-runs review with the same flag.
- [x] **T10** In `.claude/CLAUDE.md` Phase Pipeline diagram, replace "3 independent reviewers run in parallel" with tier-aware wording describing all 3 tiers. Note in Phase Detection Logic that `--minimal` is review-only.

### 3. Validation
- [x] **T11** Smoke tests — run each AC and document in `decisions.md`:
  - AC1: full-spec, no flag → envelope `tier: full-spec`, 3 voters.
  - AC2: `quick-spec.md` only → `tier: fast-lane`, 1 voter + adversarial.
  - AC3: any folder + `--minimal` → `tier: minimal`, 1 voter, no adversarial.
  - AC4: full-spec + `--minimal` → stderr warning + audit line matches pinned format.
  - AC5: re-review without flag resolves to same tier (deterministic).
  - AC6: `/sdd-auto --minimal <id>` — earlier phases receive clean args.
  - AC7: voter FAIL beats adversarial; voter PASS + adversarial high → blocked; voter PASS + adversarial medium → SPEC-GAP, advance.
- [x] **T12** Docs sweep — verify CLAUDE.md, sdd-review-feature.md, sdd-next, sdd-auto are mutually consistent on tier semantics. Remove stale "always 3 voters" / "always adversarial" wording.

## Notes
- All edits are prompt/markdown — no code, no migrations.
- OQ1 (per-team default) and OQ2 (tier-aware retry) deferred as small follow-ups.
- Branch creation (T01) is the only git op; no commits per `.claude/rules/git.md`.
