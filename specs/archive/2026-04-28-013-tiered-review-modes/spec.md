# Feature: Tiered Review Modes

## Summary

Replace the always-on 3-voter + adversarial pipeline with **3 runtime review tiers** selected by spec type plus a `--minimal` opt-in flag. Second of the team-adoption-improvements series (after 012).

## Trigger

Runtime, at review-phase entry. Orchestrator parses `--minimal`, resolves tier: `--minimal` → minimal; else `quick-spec.md` only → fast-lane; else `spec.md` → full-spec. No new state, no manifest.

## Tier Matrix

| Tier | Voters | Adversarial | Agents | Default for |
|---|---|---|---|---|
| `minimal` | 1 (pass-through) | no | 1 | opt-in via `--minimal` |
| `fast-lane` | 1 (pass-through) | yes | 2 | `quick-spec.md` |
| `full-spec` | 3 (vote) | yes | 4 | `spec.md` (current) |

N=1 voter = pass-through (no aggregation logic).

## Happy Path

1. Orchestrator reaches review-phase entry (per phase-detection table); parses `--minimal`; resolves tier.
2. Launches `sdd-review-feature` with resolved `tier`.
3. Dispatches voters + adversarial per Tier Matrix; aggregates by majority (full-spec) or pass-through (minimal/fast-lane).
4. If `--minimal` on full-spec: stderr warning + audit line in `decisions.md`.
5. Envelope returned with `tier: <resolved>`.

## Domains

In: orchestration (`/sdd-next`, `/sdd-auto`), review pipeline (`sdd-review-feature`), CLI/DX (`--minimal`, stderr), docs (`CLAUDE.md`, `_shared/sdd-phase-common.md`), audit (`decisions.md`).

Out: DB, frontend, auth, integrations. `bin/sdd status` does NOT gain `review_tier`. `/archive-feature` does NOT track tier.

## Edge Cases

- **EC3** — `--minimal` on malformed/empty folder: defer to phase-detection ("Blocked: run `/sdd-new`"); flag irrelevant.
- **EC4** — fast-lane SPEC-GAP-HIGH: same blocking as full-spec; high blocks regardless of tier.
- **EC5** — `--minimal` on `/sdd-auto`: review-only flag; earlier phases ignore it.
- **EC6** — voter/adversarial orthogonality: voter FAIL → review FAIL; voter PASS + adversarial high → block; voter PASS + adversarial medium/low → record SPEC-GAP, advance.
- **EC7** — re-review at different tier than original: allowed; same warning + audit as `--minimal` on full-spec.
- **EC8** — tier vs 2-strike ESCALATE: rule unchanged; each strike's tier captured in audit.

`.simplified` behavior unchanged across tiers.

## Acceptance Criteria

- [ ] **AC1** — Given `spec.md`, no flag, When review starts, Then tier=`full-spec` (3 voters + adversarial); envelope `tier: full-spec`.
- [ ] **AC2** — Given only `quick-spec.md`, no flag, When `/review-feature <id>` runs manually, Then tier=`fast-lane` (1 voter + adversarial); voter passes through; adversarial gap handling matches full-spec.
- [ ] **AC3** — Given any folder, When orchestrator runs with `--minimal`, Then tier=`minimal` (1 voter, no adversarial); voter verdict = review verdict.
- [ ] **AC4** — Given `spec.md`, When review runs with `--minimal`, Then stderr warning containing "downgrading full-spec to minimal review on user request" AND timestamped audit line appended to `specs/<id>/decisions.md` (created if absent).
- [ ] **AC5** — Given prior review at tier=X returned FAIL and fix applied, When re-running review without override, Then re-review runs at tier=X.
- [ ] **AC6** — Given `/sdd-auto --minimal`, When earlier phases execute, Then flag inert; only review consumes it.
- [ ] **AC7** — Given a tier with both voter and adversarial, When verdicts aggregate, Then voter drives compliance (voter FAIL → review FAIL regardless of adversarial) AND adversarial drives gaps (high → block; medium/low → record SPEC-GAP, advance).

## Rollback Plan

- **Primary**: revert merge commit. Pure prompt + bash edits, no migrations.
- **Additive**: existing paths preserved as `full-spec` — without `--minimal` on `spec.md`, behavior is byte-identical to today.
- **Forward fix**: bugs patched directly in `sdd-review-feature.md` (no compile/deploy). No env-var flag.

## Success Criteria

- **SC1 — Adoption**: ≥30% of reviews in 30 days post-merge run at `fast-lane` or `minimal` (via Engram `mem_search` on tier field saved at review end).
- **SC2 — No regression**: ≤1 feature reviewed at `fast-lane`/`minimal` in 30 days has a post-archive bug a full-spec review would have caught (via `git log` fixups + Engram).

## Open Questions

- **OQ1** — Per-team default via `.claude/rules/review.md` `default-tier:` field? YAGNI v1.
- **OQ2** — Tier-aware retry budget (currently 2 → ESCALATE; should it vary by tier)?
