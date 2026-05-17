# Feature: Adversarial Review Agent

## Summary
Add a 4th agent to `/review-feature` that acts as an adversarial judge. After the 3 conformance agents pass, this agent challenges the spec itself — finding uncovered scenarios, incomplete acceptance criteria, and gaps the spec never considered. Runs sequentially after conformance within the same phase. High-severity gaps pause the pipeline; medium/low are recorded as informational.

## Trigger
Automatic — fires within `/review-feature` after the 3 conformance agents vote PASS or PASS with warnings. Does not run if any agent voted FAIL.

## Happy Path
1. The 3 conformance agents run in parallel and vote PASS or PASS with warnings (existing behavior)
2. Adversarial agent launches, receiving the spec, code, and conformance results
3. Adversarial agent analyzes: uncovered scenarios, incomplete acceptance criteria, edge cases the spec missed
4. Generates a list of "Spec Gaps" with severity (high/medium/low)
5. If high-severity gaps exist: pipeline pauses, presents gaps to user for decision
6. If only medium/low or none: gaps are recorded in `decisions.md` as informational, pipeline advances to archive

## Domains
- [x] Other: SDD pipeline skills (`review-feature/SKILL.md`, `CLAUDE.md` orchestrator rules)

## Edge Cases
- Adversarial agent generates trivial or false-positive gaps that interrupt the user without adding value
- Adversarial agent marks a gap as high when it's really medium, blocking the pipeline unnecessarily

## Acceptance Criteria
- [x] Given the 3 conformance agents voted PASS or PASS with warnings, When the conformance phase completes, Then the adversarial agent launches and generates a list of Spec Gaps with severity (high/medium/low)
- [x] Given the adversarial agent found high-severity gaps, When it completes analysis, Then the pipeline pauses and presents gaps to the user before advancing to archive
- [x] Given the adversarial agent found only medium/low gaps or none, When it completes analysis, Then gaps are recorded in `decisions.md` as informational and the pipeline advances to archive automatically
- [x] Given any conformance agent voted FAIL, When the conformance phase completes, Then the adversarial agent does not execute and the pipeline follows the existing retry flow

## Rollback Plan
- Revert changes to `review-feature/SKILL.md` and `CLAUDE.md` to prior state. Pipeline config files only — standard git revert.

## Success Criteria
- In the next 5 reviewed features, the adversarial agent detects at least 1 real spec gap (confirmed by the user as valid) that the 3 conformance agents did not report.

## Open Questions
- SPEC-GAP entries in `decisions.md` (SPEC-GAP and SPEC-GAP-HIGH) are not delta specs (ADDED/MODIFIED/REMOVED). `/archive-feature` currently only processes delta entries. SPEC-GAP entries will be preserved in the archived `decisions.md` as informational records but are not merged into the final `spec.md`. This is acceptable for v1 — archive-feature updates can be addressed if SPEC-GAP entries need special handling.
