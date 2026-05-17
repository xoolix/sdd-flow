---
name: review-feature
description: Review implementation with one conformance reviewer plus one adversarial judge
user-invocable: true
disable-model-invocation: true
arguments: feature-id
---

# Review feature implementation

Feature-id: `$ARGUMENTS`

**Main Claude executes this skill body inline. You orchestrate sub-agents and synthesize results.**

> Sub-agents you launch MUST follow the executor boundary from `.claude/skills/_shared/sdd-phase-common.md` — they do the work themselves without re-delegating.

## Hard-stop: Orchestrator boundaries

Before using Read, Edit, Write, Grep, or Glob on ANY file, ask: **"Is this a state file or source code?"**

| | Detail |
|---|---|
| **NEVER use on** | Source code, config files, test files — any `.ts`, `.py`, `.json`, `.yaml`, etc. |
| **Allowed reads** | `spec.md`, `quick-spec.md`, `plan.md`, `tasks.md`, `decisions.md`, architecture-map output |
| **If source analysis needed** | Delegate to `sdd-reviewer` or `sdd-judge` |
| **"It's just a quick look"** | NOT a valid reason to skip delegation — delegate anyway |

If you catch yourself about to use Read/Grep/Glob on a source file, STOP and delegate.

## Pre-flight checks

Before starting, **resolve lane** per `.claude/skills/_shared/sdd-phase-common.md` §I, then verify:
- [ ] **FAST_LANE = false**: all tasks in `specs/$ARGUMENTS/tasks.md` are checked (`- [x]`).
- [ ] **FAST_LANE = true**: all `- [ ]` in `specs/$ARGUMENTS/quick-spec.md` `## Tasks` section are checked (`- [x]`).

If unchecked tasks remain, **block** and tell the user to complete them first with `/implement-task` or `/sdd-next`.

## Steps

### 0. Session lifecycle guard

(Avoids redundant session_start when invoked from sdd-next/sdd-auto.)

- Call `mem_context` with `project: "{project}"`.
- Per "Active session detection" in `engram-protocol.md`: check whether `### Recent Sessions` is present in the response.
  - If present → an active session exists → SKIP `mem_session_start`.
  - If absent, OR if `mem_context` errors / returns a malformed response → call `mem_session_start` with `project: "{project}"`, `description: "SDD review-feature: $ARGUMENTS"`.
- Mirror at phase end: if this step opened a session, close it with `mem_session_end` after the result envelope. If the session was pre-existing, do NOT call `mem_session_end`.
- If Engram is unavailable, skip this step entirely.

### 1. Recover prior context

Call `mem_search` with query `sdd/$ARGUMENTS`, `project: "{project}"` to load implementation observations that may inform the review. If Engram is unavailable, skip.

### 1.5. Read state files

Read state files:
- **FAST_LANE = false**: Read `specs/$ARGUMENTS/spec.md`, `plan.md`, `tasks.md`, and `decisions.md`.
- **FAST_LANE = true**: Read `specs/$ARGUMENTS/quick-spec.md` and `decisions.md`.

### 2. Resolve review mode

Parse `$ARGUMENTS` for flags.

**Flag extraction**:
- Split `$ARGUMENTS` on whitespace.
- Check if the exact token `--minimal` is present.

**Modes**:

| Condition | Mode | Agents |
|---|---|---|
| `--minimal` present | `minimal` | `sdd-reviewer` only |
| otherwise | `judgment-day` | `sdd-reviewer` + `sdd-judge` in parallel |

**Audit on downgrade**: if `--minimal` is present AND the folder has `spec.md`:

1. Write to stderr: `WARNING: downgrading review to minimal on user request`
2. Append to `specs/<feature-id>/decisions.md` (create file with `# Decisions\n` header if absent):
   ```
   [<ISO-8601 UTC timestamp>] review-mode=minimal (judgment-day skipped via --minimal)
   ```

### 3. Launch review agents

Launch `sdd-reviewer` always.

If mode is `judgment-day`, also launch `sdd-judge` in parallel. Do not wait for one before launching the other.

Each agent receives the same state context:

- **FAST_LANE = false**: full `spec.md`, `plan.md`, `tasks.md`, and `decisions.md`.
- **FAST_LANE = true**: full `quick-spec.md` and `decisions.md`.

Prompt both agents to run real tests where relevant and return their exact output format. For `sdd-judge`, explicitly remind it that a high finding must be scoped, plausible, and actionable; otherwise it should be medium/low or omitted.

### 4. Consolidate verdicts

Parse the reviewer verdict:
- `PASS`
- `PASS WITH WARNINGS`
- `FAIL`

Parse the judge verdict when present:
- `PASS`
- `PASS WITH WARNINGS`
- `FAIL`

Apply conservative consolidation:

| Reviewer | Judge | Final verdict | Action |
|---|---|---|---|
| FAIL | any | FAIL | code/test/spec-conformance fix cycle |
| PASS/PASS WITH WARNINGS | FAIL | BLOCKED-JUDGMENT-DAY-HIGH | human decision; no code fix loop |
| PASS WITH WARNINGS | PASS/PASS WITH WARNINGS | PASS WITH WARNINGS | continue with warnings |
| PASS | PASS WITH WARNINGS | PASS WITH WARNINGS | continue with warnings |
| PASS | PASS or absent | PASS | continue |

### 5. Invalidate simplify sentinel on conformance FAIL

If the reviewer verdict is **FAIL**:

- Delete `specs/$ARGUMENTS/.simplified` if it exists. The next `/sdd-next` after the fix cycle will re-launch `/simplify-code` before re-review.

Do NOT delete `.simplified` for judge-only failures. Judge failures are spec/risk decisions for a human, not automatic code-fix work.

### 6. Build Review-Feedback

If the reviewer verdict is `FAIL` or `PASS WITH WARNINGS`, copy the reviewer's `### Review-Feedback` table into the result envelope.

Rules:
- The table must use exact task bullets from `tasks.md` or `quick-spec.md` where possible.
- For missing tasks, use `(new task needed — not in list)`.
- This structured feedback is consumed by `/implement-task` and the evaluator-optimizer loop in `/sdd-next` and `/sdd-auto`.

### 6.5. Record judge findings

If the judge returns `PASS WITH WARNINGS` or `FAIL`, append its `### Findings` table to `decisions.md`.

Use this format:

```markdown
## JUDGMENT-DAY [or JUDGMENT-DAY-HIGH] — $ARGUMENTS

[paste the full ### Findings table from sdd-judge here]

Source: sdd-judge, review-feature phase
Date: [current date]
```

Use `JUDGMENT-DAY-HIGH` if judge verdict is `FAIL`; otherwise use `JUDGMENT-DAY`.

If judge verdict is `FAIL`, return `Status: blocked`, `Verdict: BLOCKED-JUDGMENT-DAY-HIGH`, and include the findings plus `### Blocking Rationale` in `Spec-Gaps`. The human must decide whether to update the spec, accept the risk, or cancel/re-scope.

### 7. Engram memory (skip if Engram unavailable)

- **On start**: `mem_search` query `sdd/$ARGUMENTS` + domain keywords, `project: "{project}"`.
- **After review**:
  - Always `mem_save` type: `event`, topic_key: `sdd/$ARGUMENTS/review`, content: `mode=<minimal|judgment-day> reviewer=<verdict> judge=<verdict|skipped> final=<verdict> feature=$ARGUMENTS`.
  - If a recurring quality issue was found → `mem_save` type: `learning`, topic_key: `project/quality-patterns`.
  - If judge found a reusable gap pattern → `mem_save` type: `discovery`.

For the blocked judge path, run this step BEFORE returning.

## Result envelope

After completing, output:

```
## Result
- **Status**: success | blocked
- **Verdict**: PASS | PASS WITH WARNINGS | FAIL | BLOCKED-JUDGMENT-DAY-HIGH
- **Summary**: [1-3 sentences: reviewer verdict, judge verdict, key findings]
- **Artifacts**: [decisions.md if updated, review report if written, .simplified if deleted]
- **mode**: minimal | judgment-day
- **Next**: /archive-feature $ARGUMENTS (if PASS/PASS WITH WARNINGS) or /implement-task $ARGUMENTS with Review-Feedback (if FAIL) or human decision (if BLOCKED-JUDGMENT-DAY-HIGH)
- **Risks**: [critical gaps or concerns, or "None"]
- **Review-Feedback**: [structured table from reviewer — include when reviewer verdict is FAIL or PASS WITH WARNINGS]
- **Spec-Gaps**: [judge findings — include when Status is blocked due to BLOCKED-JUDGMENT-DAY-HIGH]
```

## Rules
- **NEVER use Plan Mode**: Do NOT use `EnterPlanMode`.
- **Delegate, don't execute**: Launch `sdd-reviewer` and, unless `--minimal`, `sdd-judge`.
- **Run real tests**: The reviewer must run actual tests; the judge may run tests when relevant.
- **No voting**: There is no majority logic. Reviewer and judge are distinct signals.
- **Conservative consolidation**: Reviewer FAIL means code/test fix loop. Judge FAIL means human spec/risk decision, but judge FAIL requires a scoped, plausible, actionable high-severity finding.
- **Structured feedback**: Review-Feedback must be actionable and map to task bullets.
- Be specific — reference files and line numbers.
- Don't nitpick style unless it violates repo conventions.
- Always validate that delta specs in `decisions.md` cover all divergences.
- Always output the result envelope at the end.
