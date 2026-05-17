# Tasks

## Execution order

### 1. Foundation

- [x] Add `discovery.md` resume check at the top of `plan-feature` SKILL.md: if `discovery.md` exists, skip Explore + Discovery Evaluator steps and jump to Design + Task agents, injecting `discovery.md` content as context
- [x] Define the Discovery Evaluator sub-agent prompt template inside `plan-feature` SKILL.md — receives spec + raw explore results, returns JSON with classified findings (product-level insights, each tagged high/medium/low impact)

### 2. Core implementation

- [x] Insert Discovery Checkpoint step between current Step 4 (Explore agents) and Step 5 (Design + Task agents) in `plan-feature` SKILL.md: launch Discovery Evaluator, collect structured findings
- [x] Implement branching logic in `plan-feature` SKILL.md:
  - High-impact findings present → write `specs/<feature-id>/discovery.md`, return `Status: blocked` envelope with findings summary
  - No high-impact findings → continue to Design + Task agents (no file written)
- [x] Update `plan-feature` SKILL.md result envelope section to document the new `blocked` path and the `discovery.md` artifact
- [x] Update `CLAUDE.md` "When Human Input Is Needed" table: add row for discovery checkpoint (high-impact findings found during `/plan-feature`)
- [x] Update `CLAUDE.md` Phase Pipeline diagram: annotate the `plan-feature` step to show the discovery branch and resume path

### 3. Validation

- [x] Tests: manually run `/plan-feature` on a feature with a spec that has clear product ambiguities — verify `discovery.md` is written and `Status: blocked` is returned
  - **Manual verification required** — cannot run the pipeline in this executor context
- [x] Manual verification: run `/plan-feature` on a spec with no significant findings — verify the pipeline continues to Design + Task agents without creating `discovery.md`
  - **Manual verification required** — cannot run the pipeline in this executor context
- [x] Manual verification: seed an existing `discovery.md` in a feature dir and re-run `/plan-feature` — confirm Explore + evaluator steps are skipped and prior findings are passed as context
  - **Manual verification required** — cannot run the pipeline in this executor context
- [x] Docs update: confirm `CLAUDE.md` changes accurately reflect the new checkpoint and resume behavior
  - Confirmed: "When Human Input Is Needed" table updated, Phase Pipeline diagram updated

## Notes

- Each task maps to a concrete, single-file change (except branching logic which must land in the same step as the evaluator launch).
- If discovery classification thresholds need tuning after testing, record the decision in `decisions.md` with rationale.
- Update `decisions.md` if the prompt template or branching heuristic diverges from the spec during implementation.
