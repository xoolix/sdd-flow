# Decisions

## Delta: 2026-04-13 — Implementation

- **MODIFIED**: Plan's Spec Gaps table column order was `# | Category | Severity | Description | Suggested Action`. Implementation uses `# | Severity | Category | Description | Suggested Action` (Severity before Category). This prioritizes severity visibility when scanning the table. No functional impact — branching logic depends on severity values, not column position.

## Open: SPEC-GAP entries in archive-feature

- `SPEC-GAP` and `SPEC-GAP-HIGH` entries in `decisions.md` are not delta specs (ADDED/MODIFIED/REMOVED). `/archive-feature` currently only processes delta entries. SPEC-GAP entries will be preserved in the archived `decisions.md` as informational records but are not merged into the final `spec.md`. This is acceptable for v1 — archive-feature updates can be addressed if SPEC-GAP entries need special handling.
