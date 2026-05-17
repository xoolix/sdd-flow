# Decisions

## Simplify: 2026-04-30 — /simplify-code
- **Files simplified**: none
- **Changes**: Committed diff between main and HEAD is empty (HEAD == merge-base). `docs/onboarding.md` is a pure markdown prose file excluded by the SDD-artifacts + docs-prose scope rules; no code files were in scope.
- **Baseline**: pass | **Post-edit**: SKIP (no files modified)

## Adversarial review (2026-05-02)

Voter consensus: **PASS** (single voter, fast-lane tier). Adversarial: 0 high, 2 medium fixed in source, 4 low ACCEPTED.

**Fixed in source** (medium):
- **M-1 (`<feature-id>` format unexplained)**: added blockquote at top of `docs/onboarding.md` explaining format `NNN-slug` with example `016-onboarding-1-pager`.
- **M-2 (`/init-project` prerequisite missing)**: added prerequisite note in same blockquote pointing to `/init-project` + `README.md`. Also covers gap-6 (Claude Code CLI prerequisite) by mentioning it.

**ACCEPTED** (low, follow-up if needed):
- **L-1**: Success metric has no named owner / tracking. Spec self-describes as "baja-rigor" — accepted on-faith.
- **L-2**: Spanish language not stated as intentional in spec. Implicit assumption; future contributor could add English sections.
- **L-3**: "Pedile al equipo" escape hatch fails for solo dev / first-to-onboard. Audience constraint is "team of 10 already using SDD" — known boundary, not gap.
- **L-4 (was L-6)**: Original separately-flagged Claude Code CLI prerequisite — covered by the M-2 fix combo.

**Decision**: ship 016. Source patched for the 2 medium gaps; lows recorded for future iteration.
