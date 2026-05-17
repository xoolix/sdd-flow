# Tasks

## Execution order

### 1. Foundation

- [x] Read `specs/004-adversarial-review-agent/spec.md` and `.claude/skills/review-feature/SKILL.md` to understand current review pipeline structure

### 2. Core implementation

- [x] **SKILL.md — Add adversarial agent prompt**: Define agent instructions in a new `### Adversarial Agent Prompt` subsection. Agent receives: spec, plan, tasks, decisions, consolidated conformance report. Focus areas: uncovered scenarios, incomplete GWT criteria, missing edge cases, security gaps, undocumented assumptions.

- [x] **SKILL.md — Add Step 5.5**: Insert adversarial step between current Step 5 (Review-Feedback) and Step 6 (Engram save). Gate on: consolidated conformance verdict == PASS or PASS WITH WARNINGS. Define output format:
  ```
  ## Spec Gaps
  | # | Category | Severity | Description | Suggested Action |
  ```

- [x] **SKILL.md — Add branching logic**:
  - High-severity gaps → write to `decisions.md` with `SPEC-GAP-HIGH` tag, return `Status: blocked`
  - Medium/low only → write to `decisions.md` with `SPEC-GAP` tag, continue pipeline
  - No gaps → continue normally
  - Note: no retry loop — gaps go to human (spec issue, not code issue)

- [x] **CLAUDE.md — Update pipeline diagram**: Show adversarial step after conformance review block, before archive.

- [x] **CLAUDE.md — Update "When Human Input Is Needed"**: Add entry — adversarial review found high-severity spec gaps (`SPEC-GAP-HIGH`).

- [x] **CLAUDE.md — Update model routing table**: Add row for adversarial agent → `sonnet`.

### 3. Validation

- [x] Re-read both modified files and verify Step 5.5 is correctly placed and gated
- [x] Confirm branching logic covers all three severity outcomes (high / medium-low / none)
- [x] Confirm `decisions.md` write format uses correct tags (`SPEC-GAP-HIGH`, `SPEC-GAP`)
- [x] Confirm CLAUDE.md pipeline diagram, human-pause list, and model table are all updated
- [x] Docs update: no additional docs needed — changes are self-contained in SKILL.md and CLAUDE.md

## Notes

- Adversarial agent runs only after conformance PASS — it never runs on a FAIL verdict.
- Unlike conformance failures, adversarial gaps are spec-level concerns and bypass the retry loop entirely.
- The `SPEC-GAP-HIGH` tag in `decisions.md` is the signal the orchestrator uses to return `Status: blocked`.
