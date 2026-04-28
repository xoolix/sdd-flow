---
name: sdd-review-feature
description: Review implementation against the feature spec and plan using 3-agent voting
model: sonnet
---

# Review feature implementation

Feature-id: `$ARGUMENTS`

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

Before starting, **resolve lane** per `.claude/skills/_shared/sdd-phase-common.md` §I, then verify:
- [ ] **FAST_LANE = false**: all tasks in `specs/$ARGUMENTS/tasks.md` are checked (`- [x]`).
- [ ] **FAST_LANE = true**: all `- [ ]` in `specs/$ARGUMENTS/quick-spec.md` `## Tasks` section are `- [x]`.

If unchecked tasks remain, **block** and tell the user to complete them first with `/implement-task`.

## Steps

### 0. Recover prior context

Call `mem_search` with query `sdd/$ARGUMENTS`, `project: "{project}"` to load implementation observations that may inform the review. If Engram is unavailable, skip.

### 1. Read state files

Read state files:
- **FAST_LANE = false**: Read `specs/$ARGUMENTS/spec.md`, `plan.md`, `tasks.md`, and `decisions.md`.
- **FAST_LANE = true**: Read `specs/$ARGUMENTS/quick-spec.md` (combined spec + plan + change list) and `decisions.md`.

### 2. Launch 3 independent review agents in parallel

Launch **3 independent `sdd-reviewer-voter` sub-agents in parallel**. Each performs a **complete, independent review** of the entire feature. Give each a different agent label (Agent-A, Agent-B, Agent-C) for tracking.

Each agent receives the **same prompt** containing:

- **FAST_LANE = false**: The full spec (acceptance criteria, GWT scenarios), the plan (design, touched areas), the tasks list (what was implemented), the decisions log (documented deltas).
- **FAST_LANE = true**: The full `quick-spec.md` content (combined spec + plan + change list) and the decisions log.
- `$AGENT_LABEL` (A, B, or C) — pass as part of the prompt.

The `sdd-reviewer-voter` agent body encodes the per-agent review protocol (GWT compliance matrix, verdict rules).

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

- Delete `specs/$ARGUMENTS/.simplified` if it exists. The next `/sdd-next` after the fix cycle will re-launch `/simplify-code` before re-review — this guarantees the fix code also passes through simplify.

**Scope**: this deletion fires **only on conformance FAIL**. PASS and PASS WITH WARNINGS leave the sentinel intact. SPEC-GAP-HIGH (Step 5.5) also leaves the sentinel intact — that path pauses for a human spec edit, not a code fix.

### 5. Build Review-Feedback (when verdict is FAIL or PASS WITH WARNINGS)

If the final verdict includes failures, construct the `Review-Feedback` field as a structured list. Each row MUST name a **task bullet** so `/implement-task` Step 2b can reopen the right item. Use the exact verbatim text of the bullet from `tasks.md` (full-flow) or `quick-spec.md` `## Tasks` (fast-lane):

```
### Review-Feedback

| # | Task bullet (verbatim) | Criterion | Status | Agent(s) | Fix Required |
|---|------------------------|-----------|--------|----------|-------------|
| 1 | - [x] **T03** Add snippet to ... | [GWT or gap] | NON-COMPLIANT | A, B | [specific fix] |
| 2 | - [x] Validate input X | [GWT or gap] | UNTESTED | B, C | [what to add] |
| 3 | (new task needed — not in list) | [gap description] | CRITICAL GAP | A | [what's missing] |
```

- If a gap has no corresponding task bullet (e.g., a test was never written for an AC), put `(new task needed — not in list)` in the bullet column. `/implement-task` will add the task and implement it.
- The **Task bullet** column is how Step 2b maps criteria → bullets. Exact string match required.

**Manual-mode handoff (fast-lane / no-orchestrator users)**: copy the entire `### Review-Feedback` block verbatim from this result and paste it into your next `/implement-task <feature-id>` message (before or after the feature-id argument). Step 2b of `/implement-task` will parse the Task-bullet column to flip the right `- [x]` back to `- [ ]` before re-implementing.

This structured feedback is consumed by the evaluator-optimizer loop in `/sdd-next` and `/sdd-auto` to re-launch `/implement-task` automatically.

### 5.5. Adversarial spec review (runs only when conformance verdict is PASS or PASS WITH WARNINGS)

**Gate**: Skip this step entirely if the conformance verdict is FAIL. Only run when the consolidated conformance verdict is PASS or PASS WITH WARNINGS.

**Action**: Launch 1 `sdd-adversarial-reviewer` sub-agent. Pass as context:
- **FAST_LANE = false**: Full contents of `spec.md`, `plan.md`, `tasks.md`, `decisions.md`
- **FAST_LANE = true**: Full contents of `quick-spec.md`, `decisions.md`
- The consolidated conformance report from Step 4

The `sdd-adversarial-reviewer` agent body encodes the adversarial spec-gap analysis protocol.

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
