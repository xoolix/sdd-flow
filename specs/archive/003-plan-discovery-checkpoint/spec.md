# Feature: Plan Discovery Checkpoint

## Summary
Add a discovery phase to `/plan-feature` that evaluates codebase exploration results for product-level insights (reuse opportunities, simplifications, uncovered edge cases, adjacent features). If significant findings exist, the pipeline pauses and presents them to the user before generating the plan. If none, it continues automatically.

## Trigger
Automatic — fires within `/plan-feature` after Explore agents complete codebase analysis, before plan generation.

## Happy Path
1. User runs `/plan-feature NNN-feature`
2. Explore agents analyze the codebase (existing behavior)
3. Agent evaluates exploration results for product-level discoveries (reutilization, simplification, missing edge cases, adjacent features)
4. If significant findings exist: pipeline pauses, presents findings in a structured section, waits for user input; otherwise continues automatically without writing discovery.md
5. User accepts, discards, or requests findings be incorporated into the spec
6. Accepted findings are recorded in `decisions.md`
7. Plan and tasks are generated considering accepted findings

## Domains
- [x] Other: SDD pipeline skills (`plan-feature/SKILL.md`, `CLAUDE.md` orchestrator rules)

## Edge Cases
- Agent generates low-value findings and pauses unnecessarily, interrupting the flow
- User accepts a finding that contradicts the original spec — must be recorded to avoid silent divergence

## Acceptance Criteria
- [ ] Given Explore agents found significant findings (reuse, uncovered edge cases, simplifications), When `/plan-feature` finishes exploration, Then the pipeline pauses and presents findings to the user in a structured section before generating the plan
- [ ] Given Explore agents found no relevant product-level findings, When `/plan-feature` finishes exploration, Then the pipeline continues automatically without pausing and generates the plan normally
- [ ] Given the user receives findings and decides to incorporate some, When they confirm the changes, Then accepted findings are recorded in `decisions.md` and considered when generating the plan

## Rollback Plan
- Revert changes to `plan-feature/SKILL.md` and `CLAUDE.md` to prior state. Pipeline config files only — standard git revert.

## Success Criteria
- In the next 5 features through the pipeline, `/plan-feature` detects at least 1 relevant finding the user hadn't considered in the spec.

## Open Questions
- Stale discovery.md cleanup: `/sdd-new` should delete `discovery.md` when regenerating a spec (deferred)
- Discovery Evaluator JSON error handling: document fallback when haiku model returns malformed JSON (deferred, low probability)
