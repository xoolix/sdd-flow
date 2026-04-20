---
name: review-feature
description: Review implementation against the feature spec and plan using 3-agent voting
user-invocable: true
disable-model-invocation: true
arguments: feature-id
---

# Review feature implementation

You received a feature-id in `$ARGUMENTS`.

**You are an orchestrator. Delegate the review work to 3 independent sub-agents launched in parallel — do NOT read implementation files yourself.**

> Sub-agents you launch MUST follow the executor boundary from `.claude/skills/_shared/sdd-phase-common.md` — they do the work themselves without re-delegating.

## Hard-stop: Orchestrator boundaries

Before using Read, Edit, Write, Grep, or Glob on ANY file, ask: **"Is this a state file or source code?"**

| | Detail |
|---|---|
| **NEVER use on** | Source code, config files, test files — any `.ts`, `.py`, `.json`, `.yaml`, etc. |
| **Allowed reads** | `spec.md`, `plan.md`, `tasks.md`, `decisions.md`, architecture-map output |
| **If source analysis needed** | Delegate to a review agent |
| **"It's just a quick look"** | NOT a valid reason to skip delegation — delegate anyway |

If you catch yourself about to use Read/Grep/Glob on a source file, STOP and delegate.

## Pre-flight checks

Before starting, verify:
- [ ] All tasks in `specs/$ARGUMENTS/tasks.md` are checked (`- [x]`). If unchecked tasks remain, **block** and tell the user to complete them first with `/implement-task`.

If the check fails, stop and tell the user what's needed.

## Steps

### 0. Recover prior context

Call `mem_search` with query `sdd/$ARGUMENTS`, `project: "{project}"` to load implementation observations that may inform the review. If Engram is unavailable, skip.

### 1. Read state files

Read `specs/$ARGUMENTS/spec.md`, `specs/$ARGUMENTS/plan.md`, `specs/$ARGUMENTS/tasks.md`, and `specs/$ARGUMENTS/decisions.md`.

### 2. Launch 3 independent review agents in parallel

Launch **3 independent sub-agents in parallel** with `model: "sonnet"`. Each agent performs a **complete, independent review** of the entire feature. Give each agent a different agent label (Agent-A, Agent-B, Agent-C) for tracking.

Each agent receives the **same prompt** containing:

- The full spec (acceptance criteria, GWT scenarios)
- The plan (design, touched areas)
- The tasks list (what was implemented)
- The decisions log (documented deltas)
- Instructions to perform a complete review (below)

**Per-agent instructions** (include verbatim in each agent's prompt):

```
You are Review $AGENT_LABEL. Perform a complete, independent review of feature `$ARGUMENTS`.

Follow the executor boundary from `.claude/skills/_shared/sdd-phase-common.md` — do the work yourself, do NOT delegate.

### Your review steps:

1. **Explore the implementation**: Find and read all changed/created files for this feature. Use the plan's "Touched areas" section as a guide, but also search for any other changes.

2. **Run tests**: Execute the project's test suite (or relevant subset) to get real test results. Do NOT rely on static analysis alone.

3. **Build GWT compliance matrix**: Each row MUST map to a specific Given/When/Then scenario from the spec. Preserve the exact GWT wording.

   | # | Given | When | Then | Test | Result | Status |
   |---|-------|------|------|------|--------|--------|
   | 1 | precondition X | action Y | expected Z | test_xyz | PASSED | COMPLIANT |
   | 2 | precondition A | action B | expected C | test_abc | FAILED | NON-COMPLIANT |
   | 3 | precondition D | action E | expected F | — | — | UNTESTED |

   Rules:
   - Only mark **COMPLIANT** if a test EXISTS and PASSES
   - Mark **NON-COMPLIANT** if a test exists but FAILS
   - Mark **UNTESTED** if no test covers the criterion
   - Mark **MALFORMED** if the criterion is not in GWT format — flag as spec issue
   - Include ALL acceptance criteria — none should be missing

4. **Validate delta specs**: Check `decisions.md` for delta entries (ADDED/MODIFIED/REMOVED). Verify every spec divergence is documented. Flag undocumented changes as CRITICAL gaps.

5. **Check completeness**: Look for gaps in tests, docs, observability, error handling.

6. **Produce your verdict**: Based on your findings:
   - **PASS**: All criteria COMPLIANT, no CRITICAL gaps
   - **PASS WITH WARNINGS**: All criteria COMPLIANT but minor gaps exist
   - **FAIL**: Any criterion NON-COMPLIANT or UNTESTED, or CRITICAL gaps found

7. **Return your result** in this exact format:

   ## Review by $AGENT_LABEL
   ### Compliance Matrix
   [the matrix]
   ### Passes
   [what's correctly implemented]
   ### Gaps
   [what's missing — include severity: CRITICAL / MINOR]
   ### Risks
   [potential issues]
   ### Failed Criteria
   [list each failed/non-compliant/untested criterion with what needs fixing — leave empty if verdict is PASS]
   ### Verdict: [PASS | PASS WITH WARNINGS | FAIL]
```

### 3. Collect verdicts and apply voting logic

Once all 3 agents return, collect their verdicts and apply these rules:

| Scenario | Action |
|----------|--------|
| **Unanimous agreement** (all 3 same verdict) | Use that verdict. High confidence. |
| **Majority, no FAIL present** (e.g., 2 PASS + 1 PASS WITH WARNINGS) | Use majority verdict. Note the dissent. |
| **Majority PASS/WARN but 1 FAIL** | **Flag to human**. Include the FAIL agent's rationale and failed criteria. Verdict = FAIL (conservative). |
| **Majority FAIL** (2+ FAIL) | Verdict = FAIL. Merge failed criteria from all FAIL agents. |
| **No majority** (all 3 different) | **Flag to human**. Include all 3 rationales. Verdict = FAIL (conservative). |

### 4. Build consolidated review report

Combine the 3 agents' findings into a single report:

- **Vote Summary**: Show each agent's verdict (e.g., `Agent-A: PASS, Agent-B: PASS, Agent-C: PASS WITH WARNINGS`)
- **Consensus**: The final verdict from voting logic
- **Compliance Matrix**: Use the most detailed/complete matrix among the 3 agents. If agents disagree on a criterion's status, use the most conservative (FAIL > UNTESTED > WARN > PASS).
- **Passes**: Merge from all agents (deduplicated)
- **Gaps**: Merge from all agents (deduplicated, preserve severity)
- **Risks**: Merge from all agents (deduplicated)
- **Dissent** (if any): Include the dissenting agent's rationale verbatim

### 4.5. Invalidate simplify sentinel on conformance FAIL

If the consolidated conformance verdict is **FAIL**:

- Delete `specs/$ARGUMENTS/.simplified` if it exists. The next `/sdd-continue` after the fix cycle will re-launch `/simplify-code` before re-review — this guarantees the fix code also passes through simplify.

**Scope**: this deletion fires **only on conformance FAIL**. PASS and PASS WITH WARNINGS leave the sentinel intact. SPEC-GAP-HIGH (Step 5.5) also leaves the sentinel intact — that path pauses for a human spec edit, not a code fix.

### 5. Build Review-Feedback (when verdict is FAIL or PASS WITH WARNINGS)

If the final verdict includes failures, construct the `Review-Feedback` field as a structured list:

```
### Review-Feedback

| # | Criterion | Status | Agent(s) | Fix Required |
|---|-----------|--------|----------|-------------|
| 1 | [GWT or gap description] | NON-COMPLIANT | A, B | [specific fix instruction] |
| 2 | [GWT or gap description] | UNTESTED | B, C | [what test to add] |
| 3 | [gap description] | CRITICAL GAP | A | [what's missing] |
```

This structured feedback is consumed by the evaluator-optimizer loop in `/sdd-continue` and `/sdd-ff` to re-launch `/implement-task` with targeted fix instructions.

### Adversarial Agent Prompt

Use this prompt verbatim when launching the adversarial agent in Step 5.5:

```
You are the Adversarial Review Agent for feature `$ARGUMENTS`.

Follow the executor boundary from `.claude/skills/_shared/sdd-phase-common.md` — do the work yourself, do NOT delegate.

Your role is NOT to check whether the code matches the spec. The 3 conformance agents already did that. Your role is to challenge the spec itself — find what it never considered, what it assumed without stating, and what could go wrong that nobody wrote down.

You receive:
- The full spec (spec.md)
- The plan (plan.md)
- The tasks list (tasks.md)
- The decisions log (decisions.md)
- The consolidated conformance report (provided inline)

### Your analysis steps:

1. **Uncovered scenarios**: What user journeys or system states does the spec never mention? Think about failure paths, concurrent actions, empty states, permission boundaries, and unusual but valid inputs.

2. **Incomplete acceptance criteria**: Which GWT criteria are vague, untestable, or ambiguous? Are there "Given" conditions that are never fully defined? Are there "Then" outcomes that could be interpreted in multiple ways?

3. **Missing edge cases**: What boundary conditions, large-scale inputs, or rare-but-valid states did the spec not address? Think about zero values, maximum values, encoding edge cases, race conditions.

4. **Security and integrity gaps**: What trust assumptions does the spec make without stating them? What could a malicious or mistaken actor do that the spec doesn't defend against?

5. **Undocumented assumptions**: What does the spec assume about the environment, data format, user behavior, or existing system state without ever saying so?

### Output format:

If you find gaps, output:

## Spec Gaps
| # | Severity | Category | Description | Suggested Action |
|---|----------|----------|-------------|------------------|
| 1 | high/medium/low | uncovered-scenario / incomplete-AC / edge-case / security-integrity / undocumented-assumption | [clear description of the gap] | [concrete suggestion to close it] |

Severity guide:
- **high**: The gap could cause a real failure, data loss, security breach, or product behavior that contradicts user expectations — and the spec gives no guidance.
- **medium**: The gap is a real blind spot but unlikely to cause critical issues in the near term. Worth addressing before v1 is stable.
- **low**: A minor ambiguity or a scenario so unlikely it's informational only.

If you find NO gaps, output:

## Spec Gaps
None — spec appears complete for the scope defined.
```

### 5.5. Adversarial spec review (runs only when conformance verdict is PASS or PASS WITH WARNINGS)

**Gate**: Skip this step entirely if the conformance verdict is FAIL. Only run when the consolidated conformance verdict is PASS or PASS WITH WARNINGS.

**Action**: Launch 1 adversarial agent with `model: "sonnet"` using the **Adversarial Agent Prompt** above. Pass as context:
- Full contents of `spec.md`, `plan.md`, `tasks.md`, `decisions.md`
- The consolidated conformance report from Step 4

**Branching logic based on adversarial agent output**:

| Adversarial result | Orchestrator action |
|-------------------|---------------------|
| No gaps (output says "None") | Continue — proceed to Step 6 (Engram save) |
| Only medium/low severity gaps | Write gaps to `decisions.md` with `SPEC-GAP` tag (format below); continue to Step 6 |
| Any high-severity gap present | Write gaps to `decisions.md` with `SPEC-GAP-HIGH` tag (format below); stop pipeline — run Step 6 (Engram save) BEFORE returning `Status: blocked` with `Spec-Gaps` field in result envelope |

**Combined-verdict clarification**: When the conformance verdict is PASS WITH WARNINGS and the adversarial agent finds only medium/low gaps, the result envelope status remains `PASS WITH WARNINGS` (the conformance verdict). The adversarial step does not upgrade or downgrade the conformance verdict — it only blocks on high-severity gaps or continues.

**Blocked path — Engram save**: Before returning a `Status: blocked` envelope (high-severity gap found), the orchestrator MUST still run Step 6 (Engram save). This ensures conformance review findings are persisted even when the adversarial agent stops the pipeline.

**Write format for `decisions.md`** (append to the file):

```markdown
## SPEC-GAP [or SPEC-GAP-HIGH] — $ARGUMENTS — adversarial review

[paste the full ## Spec Gaps table from the adversarial agent here]

Source: adversarial review agent, review-feature phase
Date: [current date]
```

Use tag `SPEC-GAP-HIGH` if any row has severity = high. Use tag `SPEC-GAP` if all rows are medium or low.

**No retry loop**: Unlike conformance failures, adversarial gaps are spec-level concerns. They go to the human for a decision — the orchestrator does NOT auto-retry or auto-fix.

### 6. Engram memory (skip if Engram unavailable)

- **On start** (Step 0): `mem_search` query `sdd/$ARGUMENTS` + domain keywords, `project: "{project}"` — recover implementation context and find patterns from prior reviews
- **After review**: Save only what would help future features:
  - If a recurring quality issue was found across reviews → `mem_save` type: `learning`, topic_key: `project/quality-patterns` — e.g., "Tests in this project tend to miss edge case X"
  - If the adversarial agent found a gap pattern → `mem_save` type: `discovery` — the pattern, not the specific gap (that's in decisions.md)
  - Don't save "review passed 3/3" — that's not actionable for future work

## Result envelope

After completing, output:

```
## Result
- **Status**: success | partial | blocked
- **Summary**: [1-3 sentences: vote breakdown, final verdict, key findings]
- **Artifacts**: [review report location]
- **Next**: /archive-feature $ARGUMENTS (if PASS) or specific fixes needed (if FAIL)
- **Risks**: [critical gaps or concerns, or "None"]
- **Review-Feedback**: [structured table of failed criteria — include ONLY when verdict is FAIL or PASS WITH WARNINGS]
- **Spec-Gaps**: [structured Spec Gaps table from adversarial agent — include ONLY when Status is blocked due to SPEC-GAP-HIGH]
```

## Rules
- **NEVER use Plan Mode**: Do NOT use `EnterPlanMode`. Write files directly. Plan Mode breaks the SDD pipeline.
- **Delegate, don't execute**: Launch 3 parallel review agents, synthesize their results via voting.
- **Run real tests**: Each agent must run actual tests — compliance matrices must be based on real test execution.
- **Conservative voting**: When in doubt, use the more conservative verdict. Any FAIL means the feature FAILs.
- **Structured feedback**: The `Review-Feedback` field must be actionable — specific criteria and specific fixes, not vague suggestions.
- Be specific — reference files and line numbers.
- Don't nitpick style unless it violates repo conventions.
- Focus on correctness, completeness, and alignment with the spec.
- Always validate that delta specs in `decisions.md` cover all divergences.
- Always output the result envelope at the end.
