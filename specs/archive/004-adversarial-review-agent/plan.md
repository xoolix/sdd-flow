# Technical Plan

## Inputs
- Spec: specs/004-adversarial-review-agent/spec.md
- Clarifications: none
- Research inputs: direct inspection of `.claude/skills/review-feature/SKILL.md` and `.claude/CLAUDE.md`

## Current state

`/review-feature` runs 3 conformance agents (A/B/C) in parallel, then:
1. Merges their compliance matrices and deduplicates gaps/risks
2. Applies voting logic (any FAIL = FAIL)
3. Builds consolidated report and, if needed, a Review-Feedback table
4. Saves to Engram and returns result envelope

There is no challenge of the spec itself — agents only check whether the implementation conforms to what the spec says.

## Proposed design

Insert an **adversarial phase** (step 5.5) between the consolidated report and the Engram save. It runs only when conformance verdict is PASS or PASS WITH WARNINGS.

### Adversarial agent contract

| Item | Detail |
|------|--------|
| Model | `sonnet` |
| Trigger | Conformance verdict is PASS or PASS WITH WARNINGS |
| Skip when | Any conformance agent voted FAIL |
| Input | spec + plan + tasks + decisions + conformance consolidated report |
| Output | Structured "Spec Gaps" list (see format below) |

### Spec Gaps output format

```
## Spec Gaps

| # | Severity | Category | Description | Suggested Action |
|---|----------|----------|-------------|------------------|
| 1 | high/medium/low | uncovered-scenario / incomplete-AC / edge-case / security / assumption | ... | ... |
```

Categories: `uncovered-scenario`, `incomplete-AC`, `edge-case`, `security-integrity`, `undocumented-assumption`

### Orchestrator decision logic (post-adversarial)

| Adversarial result | Orchestrator action |
|-------------------|---------------------|
| No gaps | Continue — Engram save, return PASS envelope |
| Only medium/low gaps | Write gaps to `decisions.md` with `SPEC-GAP` tags; continue to archive |
| Any high-severity gap | Return `Status: blocked`, include `Spec-Gaps` field; pipeline stops |

### Result envelope change

Add optional `Spec-Gaps` field to the review-feature envelope, populated only when `Status: blocked` due to adversarial findings.

## Touched areas

| Area | Change |
|------|--------|
| `.claude/skills/review-feature/SKILL.md` | Add step 5.5: adversarial agent launch, decision logic, `decisions.md` write for medium/low, envelope update for high |
| `.claude/CLAUDE.md` | Update pipeline diagram to show adversarial step; add "high-severity spec gap" to "When Human Input Is Needed" |

No APIs, DB schemas, jobs, workers, or UI surfaces are touched. This is config/prompt-only.

## Data flow

```
conformance consolidated report
        │
        ▼ (if PASS or PASS WITH WARNINGS)
adversarial agent (sonnet)
        │
        ├─ high-severity gap? → Status: blocked, Spec-Gaps: [...]
        │
        └─ medium/low only? → write SPEC-GAP entries to decisions.md
                              → Status: pass (or pass-with-warnings), continue
```

## Migration / rollout

| Item | Detail |
|------|--------|
| Backfill | None — only affects future review runs |
| Compatibility | Additive change; existing conformance logic untouched |
| Feature flags | None |
| Rollback | `git revert` on `review-feature/SKILL.md` and `CLAUDE.md` |

## Observability

| Item | Detail |
|------|--------|
| Logs | Adversarial output is included verbatim in the review-feature result envelope under `Spec-Gaps` |
| Metrics | None (skill-level, no runtime metrics) |
| Alerts | None |

## Test strategy

| Level | Approach |
|-------|----------|
| Unit | Manual: run `/review-feature` on a feature with a known gap in the spec; verify agent fires and gap is reported |
| Integration | Run full pipeline on feature 005+ to verify blocked vs. informational paths behave correctly |
| E2E/manual | Confirm `decisions.md` receives `SPEC-GAP` entries when gaps are medium/low; confirm pipeline halts on high |

## Risks and mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Adversarial agent over-flags trivial gaps as high, blocking pipeline unnecessarily | Medium | Prompt instructs agent to reserve `high` for gaps that would cause incorrect user outcomes; reviewer validates before acting |
| False positives increase noise in `decisions.md` | Low | `SPEC-GAP` tags are distinct from `ADDED/MODIFIED/REMOVED` tags; easy to filter |
| Adversarial adds latency to every passing review | Low | Runs sequentially only after PASS; conformance (the hot path for FAILs) is unaffected |
