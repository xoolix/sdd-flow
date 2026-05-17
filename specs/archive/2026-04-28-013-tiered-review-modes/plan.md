# Technical Plan — 013-tiered-review-modes

## Inputs
- Spec: `specs/013-tiered-review-modes/spec.md`
- Clarifications: audit-line format pinned, voter/adversarial orthogonality verified, OQ1/OQ2 deferred

## Domain analysis

| Domain | File | Complexity |
|---|---|---|
| Review pipeline | `.claude/agents/sdd-review-feature.md` | MEDIUM |
| Orchestration / flags | `.claude/skills/sdd-next/SKILL.md`, `.claude/skills/sdd-auto/SKILL.md` | SMALL |
| Audit | `decisions.md` write (in review agent) | SMALL |
| Docs | `.claude/CLAUDE.md` (phase pipeline) | SMALL |

**Strategy**: MEDIUM — sequential, ~12 atomic tasks, no checkpoints.

## Current state
- `sdd-review-feature.md` always launches 3 voters (Step 2) + adversarial (Step 5.5, gated on conformance PASS/PASS-WARN). Step 3 voting assumes N=3.
- `sdd-next` / `sdd-auto` treat `$ARGUMENTS` as a single feature-id — no flag parsing.
- Voter and adversarial outputs are **already orthogonal** (Risk 2 resolved during exploration): voter drives `Status`, adversarial drives `Spec-Gaps` independently. No coupling refactor needed.
- CLAUDE.md Phase Pipeline diagram says "3 independent reviewers" — needs tier-aware wording.

## Proposed design

**Tier dispatch in `sdd-review-feature.md`**: new Step 1.5 "Resolve tier" between current Step 1 (read state) and Step 2 (launch voters). Inputs: `$ARGUMENTS` (may include `--minimal`), folder contents (`spec.md` vs `quick-spec.md`). Output: `tier ∈ {minimal, fast-lane, full-spec}`, `voter_count ∈ {1,3}`, `adversarial_enabled ∈ {true,false}`.

| Tier | Voters | Adversarial |
|---|---|---|
| minimal | 1 (pass-through) | skipped |
| fast-lane | 1 (pass-through) | run |
| full-spec | 3 (vote) | run |

**Voting (Step 3)**: branch on `voter_count`. If 1, voter verdict IS review verdict. If 3, existing matrix unchanged.

**Adversarial (Step 5.5)**: if `adversarial_enabled == false`, skip entirely regardless of conformance verdict.

**Audit on `--minimal` over `spec.md`** (AC4): in Step 1.5, emit stderr warning + append to `decisions.md` (create if absent):
```
[2026-04-28T15:23:00Z] review-tier=minimal (downgraded from full-spec via --minimal)
```
ISO 8601 UTC, single line.

**Flag parse in `sdd-next`/`sdd-auto`**: Step 1 splits `$ARGUMENTS` on whitespace, extracts exact token `--minimal`. Pass through to review launch only; earlier phases ignored (AC6 / EC5).

## Touched areas
- Files: `sdd-review-feature.md`, `sdd-next/SKILL.md`, `sdd-auto/SKILL.md`, `CLAUDE.md`
- Contracts: result envelope gains `tier: <resolved>` field
- DB / jobs / UI: none (stderr warning only)

## Data flow
1. User invokes `/sdd-next [--minimal] <id>` or `/review-feature` direct.
2. Orchestrator splits flags, passes `--minimal` to review only.
3. Review agent resolves tier from flag + folder type.
4. If downgrade → stderr + `decisions.md` audit line.
5. 1 or 3 voter agents launched per tier; pass-through if 1.
6. Adversarial skipped if minimal, else runs.
7. Envelope returns with `tier:` field for Engram tracking (SC1).

## Migration / rollout
- Backfill: none.
- Compatibility: full-spec tier byte-identical to today without `--minimal`.
- Feature flags: none — `--minimal` IS the toggle.
- Rollback: revert merge commit. Pure prompt edits.

## Observability
- stderr warning on downgrade.
- `tier:` in envelope; Engram `mem_save` per review for SC1.

## Test strategy
No automated harness — manual smoke tests per AC (see tasks.md T11). Each AC maps to a constructed scenario; verify envelope `tier:`, voter count, adversarial presence, audit line format.

## Risks and mitigations
- **R1** New Step 1.5 must run after state-read (needs folder type) but before voter launch. Place between current Steps 1 and 2.
- **R2** Flag regex: exact-token match — `--minimal-foo` must NOT match.
- **R3** AC5 (re-review at same tier) has no persistent state — tier resolution is deterministic from folder type, so re-running yields same tier unless `--minimal` is added. EC7 already accepts this.
- **R4** OQ1 (per-team default tier) and OQ2 (tier-aware retry budget) deferred — small follow-ups (~1 day each) if adoption requests come post-rollout.
