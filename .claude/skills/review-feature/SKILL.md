---
name: review-feature
description: Review implementation against the feature spec and plan
user-invocable: true
disable-model-invocation: true
arguments: feature-id
---

# Review feature implementation

You received a feature-id in `$ARGUMENTS`.

**You are an orchestrator. Delegate the review work to sub-agents — do NOT read all the implementation files yourself.**

## Pre-flight checks

Before starting, verify:
- [ ] All tasks in `specs/$ARGUMENTS/tasks.md` are checked (`- [x]`). If unchecked tasks remain, **block** and tell the user to complete them first with `/implement-task`.

If the check fails, stop and tell the user what's needed.

## Steps

1. Read `specs/$ARGUMENTS/spec.md`, `specs/$ARGUMENTS/plan.md`, `specs/$ARGUMENTS/tasks.md`, and `specs/$ARGUMENTS/decisions.md`.

2. **Delegate implementation review** — Launch sub-agents with fresh context:
   - For each domain involved in the feature, launch a **parallel Explore agent** (`subagent_type: "Explore"`) with:
     - The acceptance criteria from the spec
     - The relevant section of the plan
     - Instructions to find and evaluate all changed/created files for that domain
   - Each agent returns: files reviewed, criteria pass/fail, gaps found, risks identified.

3. **Run tests** — Execute the project's test suite (or relevant subset) to get real test results. Do NOT rely on static analysis alone.

4. **Build spec compliance matrix** — Cross-reference each acceptance criterion from the spec against actual test results:

   ```
   ## Spec Compliance Matrix

   | # | Acceptance Criterion | Test | Result | Status |
   |---|---------------------|------|--------|--------|
   | 1 | Given X, When Y, Then Z | test_xyz | PASSED | COMPLIANT |
   | 2 | Given A, When B, Then C | test_abc | FAILED | NON-COMPLIANT |
   | 3 | Given D, When E, Then F | — | — | UNTESTED |
   ```

   Rules for the matrix:
   - Only mark **COMPLIANT** if a test EXISTS and PASSES
   - Mark **NON-COMPLIANT** if a test exists but FAILS
   - Mark **UNTESTED** if no test covers the criterion
   - Include ALL acceptance criteria from the spec — none should be missing

5. **Synthesize sub-agent results** — Combine findings from all agents:
   - Evaluate each acceptance criterion against the compliance matrix
   - Identify drift from plan: check `decisions.md` for documented deltas, flag undocumented changes
   - Check for gaps: missing tests, docs, observability, error handling

6. **Validate delta specs** — Review `decisions.md` for any delta entries (ADDED/MODIFIED/REMOVED). Verify:
   - Every spec divergence found by agents is documented as a delta
   - No undocumented changes exist
   - Flag any missing deltas as CRITICAL gaps

7. Produce a review report:
   - **Compliance Matrix**: (from step 4)
   - **Passes**: What's correctly implemented
   - **Gaps**: What's missing or incomplete (include missing delta docs)
   - **Risks**: Potential issues or concerns
   - **Verdict**: determined by:
     - **PASS**: All criteria COMPLIANT, no CRITICAL gaps
     - **PASS WITH WARNINGS**: All criteria COMPLIANT but minor gaps exist (missing docs, non-critical edge cases)
     - **FAIL**: Any criterion NON-COMPLIANT or UNTESTED, or CRITICAL gaps found
   - **Follow-ups**: Suggested next steps

## Result envelope

After completing, output:

```
## Result
- **Status**: success | partial | blocked
- **Summary**: [1-3 sentences with the verdict and key findings]
- **Artifacts**: [review report location]
- **Next**: /archive-feature $ARGUMENTS (if PASS) or specific fixes needed (if FAIL)
- **Risks**: [critical gaps or concerns, or "None"]
```

## Rules
- **Delegate, don't execute**: Launch sub-agents for the heavy lifting, synthesize their results.
- **Run real tests**: The compliance matrix must be based on actual test execution, not assumptions.
- Be specific — reference files and line numbers.
- Don't nitpick style unless it violates repo conventions.
- Focus on correctness, completeness, and alignment with the spec.
- Always validate that delta specs in `decisions.md` cover all divergences.
- Always output the result envelope at the end.
