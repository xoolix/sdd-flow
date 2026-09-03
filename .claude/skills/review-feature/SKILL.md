---
name: review-feature
description: Review implementation with one conformance reviewer plus one adversarial judge
user-invocable: true
arguments: feature-id
---

# Review feature implementation

Feature-id: `$ARGUMENTS`

**Main Claude executes this skill body inline. You orchestrate sub-agents and synthesize results.**

**Invocation guard**: run this phase only when the user explicitly typed `/review-feature`, or an SDD orchestrator (`/sdd-next`, `/sdd-auto`) detected it as the next phase and invoked it (including fix→re-review cycles). Never start it on your own initiative — if a review seems warranted, suggest the command and let the user decide.

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

## Argument parsing

**Do this before anything else — before Pre-flight, before any path or sub-agent prompt is built from `$ARGUMENTS`.** `review-feature` is the one phase in this pipeline that can receive `<feature-id> --minimal` as its raw argument (from `/sdd-next`/`/sdd-auto`'s fix loops re-appending the flag, or a user typing it directly) — every other phase only ever receives a clean id. Extract the flag with the same exact-token semantics `sdd-next`/`sdd-auto` already use in their own pre-loop flag extraction:

1. Split `$ARGUMENTS` on whitespace.
2. `has_minimal_flag = true` if the exact token `--minimal` is present in that split (NOT substring match — `--minimal-foo` must NOT match); otherwise `false`.
3. `FEATURE_ID` = the remaining tokens, with `--minimal` removed, joined back together. This is the clean feature-id.

From this point on, every path under `specs/`, every `sdd` CLI invocation, every Engram topic key, and every sub-agent prompt in this skill is built from `FEATURE_ID` — never from raw `$ARGUMENTS`. Step 2 ("Resolve review mode") below consumes `has_minimal_flag` computed here; it does not re-split `$ARGUMENTS`.

## Pre-flight checks

Before starting, **resolve lane** per `.claude/skills/_shared/sdd-phase-common.md` §I using `FEATURE_ID` from Argument parsing above (§I expects an already-clean id; never pass it raw `$ARGUMENTS`), then verify:
- [ ] **FAST_LANE = false**: all tasks in `specs/$FEATURE_ID/tasks.md` are checked (`- [x]`).
- [ ] **FAST_LANE = true**: all `- [ ]` in `specs/$FEATURE_ID/quick-spec.md` `## Tasks` section are checked (`- [x]`).

If unchecked tasks remain, **block** and tell the user to complete them first with `/implement-task` or `/sdd-next`.

## Steps

### 0. Session lifecycle guard

(Avoids redundant session_start when invoked from sdd-next/sdd-auto.)

- Call `mem_context` with `project: "{project}"`.
- Per "Active session detection" in `engram-protocol.md`: check whether `### Recent Sessions` is present in the response.
  - If present → an active session exists → SKIP `mem_session_start`.
  - If absent, OR if `mem_context` errors / returns a malformed response → call `mem_session_start` with `project: "{project}"`, `description: "SDD review-feature: $FEATURE_ID"`.
- Mirror at phase end: if this step opened a session, close it with `mem_session_end` after the result envelope. If the session was pre-existing, do NOT call `mem_session_end`.
- If Engram is unavailable, skip this step entirely.

### 1. Recover prior context

Call `mem_search` with query `sdd/$FEATURE_ID`, `project: "{project}"` to load implementation observations that may inform the review. If Engram is unavailable, skip.

### 1.5. Read state files

Read state files:
- **FAST_LANE = false**: Read `specs/$FEATURE_ID/spec.md`, `plan.md`, `tasks.md`, and `decisions.md`.
- **FAST_LANE = true**: Read `specs/$FEATURE_ID/quick-spec.md` and `decisions.md`.

**Resolve implementing model** (for cross-review routing): search `decisions.md` for lines matching `implemented-by: <runtime>`. Take the LAST such line's value as the implementing model. If no `implemented-by` line exists, assume the current runtime (`claude`) and note that this was an assumption — it gets recorded in Step 6.6 if cross-review runs. `CROSS_REVIEW_MODEL` is the opposite of the implementing model (`claude` → `codex`; `codex` → `claude`).

### 2. Resolve review mode

`has_minimal_flag` was already computed in **Argument parsing** above — this step does not re-parse `$ARGUMENTS`.

**Modes**:

| Condition | Mode | Agents |
|---|---|---|
| `has_minimal_flag` is true | `minimal` | `sdd-reviewer` only |
| otherwise | `judgment-day` | `sdd-reviewer` + `sdd-judge` in parallel |

**Audit on downgrade**: if `has_minimal_flag` is true AND the folder has `spec.md`:

1. Write to stderr: `WARNING: downgrading review to minimal on user request`
2. Append to `specs/$FEATURE_ID/decisions.md` (create file with `# Decisions\n` header if absent):
   ```
   [<ISO-8601 UTC timestamp>] review-mode=minimal (judgment-day skipped via --minimal)
   ```

### 2.5. Detect cross-review availability

Only run this step when mode is `judgment-day` (resolved in Step 2). Under `--minimal`, skip this step entirely — no detection, no audit line, no `CROSS_REVIEW_AVAILABLE`.

Determine `CROSS_REVIEW_AVAILABLE`:

1. Read `~/.claude/plugins/installed_plugins.json`. Its real shape is `{ "version": <int>, "plugins": { "<name>@<marketplace>": [ { "scope", "installPath", "version", "installedAt", "lastUpdated", "gitCommitSha" }, ... ] } }` — a registry of install records. **It does NOT carry an enabled/disabled flag.** Check `.plugins["codex@openai-codex"]` is a non-empty array.
2. Read `~/.claude/settings.json`. The actual enable/disable state lives here, under `.enabledPlugins["codex@openai-codex"]` (a boolean). Check that value is exactly `true`.
3. Check `command -v codex` resolves.
4. Take the highest-`version` install record and resolve its `installPath`. If `installPath` is missing, empty, or does not exist on disk, `CROSS_REVIEW_AVAILABLE = false` with reason `skipped — codex plugin registry entry has no valid installPath` — never fall back to globbing `~/.claude/plugins/cache/openai-codex/codex/*/scripts/codex-companion.mjs` for an unregistered cache version. When `installPath` resolves, confirm the companion script exists at `<installPath>/scripts/codex-companion.mjs`.

`CROSS_REVIEW_AVAILABLE = true` only if ALL of: the plugin is registered and non-empty in `installed_plugins.json`, `enabledPlugins["codex@openai-codex"]` is `true` in `settings.json` (an unreadable or absent `settings.json` counts as this check failing, identical to `enabledPlugins` being missing), the codex CLI resolves, AND the registry's own `installPath` resolves to an existing companion script. An unregistered cache directory is never a substitute for a valid `installPath` — trusting an orphaned cache entry would run a review the user turned off or uninstalled, defeating the kill-switch.

If `CROSS_REVIEW_AVAILABLE = false`:
- Record `Cross-Review: skipped — <reason>` for the result envelope (e.g., `skipped — codex plugin not active`, `skipped — codex plugin not installed`, `skipped — codex CLI not on PATH`).
- Append one audit line to `specs/$FEATURE_ID/decisions.md` (create with `# Decisions\n` header if absent):
  ```
  [<ISO-8601 UTC timestamp>] Cross-Review: skipped — <reason>
  ```

### 3. Launch review agents

Launch `sdd-reviewer` always.

If mode is `judgment-day`, also launch `sdd-judge` in parallel. Do not wait for one before launching the other.

If mode is `judgment-day` AND `CROSS_REVIEW_AVAILABLE` is true, also launch `sdd-cross-reviewer` in the same parallel batch. Pass it `FEATURE_ID` (never raw `$ARGUMENTS`) and a brief focus summary (acceptance criteria + touched files distilled from the state files read in Step 1.5). Do NOT compute scope (working-tree vs base-branch) for it — `sdd-cross-reviewer` determines that itself per its own protocol. `sdd-cross-reviewer` is excluded entirely under `--minimal` and whenever `CROSS_REVIEW_AVAILABLE` is false.

**Cross-agent failure handling (fail-open, never blocks the phase)**: `sdd-cross-reviewer` is launched via the Agent tool alongside `sdd-reviewer`/`sdd-judge`, but its failures must never fail the phase or consume `review-feature`'s own retry budget (`sdd-phase-common.md` §F, max 2 retries). Treat all of the following the same way — record `Cross-Review: skipped — cross-agent failure: <detail>` and proceed to consolidate using only `sdd-reviewer` + `sdd-judge`:
- The Agent tool fails to launch it (unregistered agent type, launch exception) — `<detail>` = the launch error.
- It crashes or returns no usable output mid-run — `<detail>` = what was observed (e.g., `no response returned`).
- It exceeds its own internal deadline and never returns to the orchestrator — `<detail>` = `timeout`.
- Its response contains no `### Cross-Verdict:` line (malformed or truncated output) — `<detail>` = `no Cross-Verdict line in response`.

None of these cases are retried by the orchestrator, and none of them count toward the 2-retry validation budget — the cross-reviewer is advisory-only, so an unusable result from it is equivalent to `CROSS_REVIEW_AVAILABLE = false` for consolidation purposes, just detected after launch instead of before.

Each agent receives the same state context:

- **FAST_LANE = false**: full `spec.md`, `plan.md`, `tasks.md`, and `decisions.md`.
- **FAST_LANE = true**: full `quick-spec.md` and `decisions.md`.

This state context's `decisions.md` copy carries its `## TDD-Evidence` section verbatim — the durable source `sdd-reviewer`'s step 2.5 reads for its RED/GREEN/TRIANGULATE reality check.

Prompt `sdd-reviewer` and `sdd-judge` to run real tests where relevant and return their exact output format. For `sdd-judge`, explicitly remind it that a high finding must be scoped, plausible, and actionable; otherwise it should be medium/low or omitted. `sdd-cross-reviewer` follows its own agent protocol (companion invocation) — it does not run the repo's test suite itself.

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

**Invariant**: `sdd-cross-reviewer`'s output NEVER enters this table and NEVER sets the Final verdict. It returns a `### Cross-Verdict:` field — a distinct, differently-named field precisely so it cannot be confused with `Verdict` by any consumer, including the fix loops in `sdd-next`/`sdd-auto`, which branch only on `Verdict`. A cross-review `FAIL` degrades to a warning line — `cross-review reported FAIL (advisory)` — appended to the result envelope's `Risks` field; it never changes the Final verdict computed above.

**Seal the verdict (025/T006)**: right after computing the Final verdict above — before doing anything in Step 5 onward — write the durable receipt so a fresh `/sdd-next` can recover this outcome without re-running review:

| Final verdict | Action |
|---|---|
| `PASS` | run `sdd state-write $FEATURE_ID --phase reviewed --verdict PASS` |
| `PASS WITH WARNINGS` | run `sdd state-write $FEATURE_ID --phase reviewed --verdict PASS-WITH-WARNINGS` |
| `FAIL` | do **not** write here — Step 5 clears `specs/$FEATURE_ID/.sdd-state` instead, so the phase falls back to `ready-to-simplify` and the fix loop's mandatory `/simplify-code` pass still runs |
| `BLOCKED-JUDGMENT-DAY-HIGH` | do **not** write here — sealed in Step 6.5, at the point the block is confirmed, so the call still fires even though that branch returns `Status: blocked` |

### 5. Invalidate simplify sentinel on conformance FAIL

If the reviewer verdict is **FAIL**:

- Delete `specs/$FEATURE_ID/.sdd-state` if it exists. The next `/sdd-next` after the fix cycle will re-launch `/simplify-code` before re-review — same fallback the old `.simplified` deletion produced, now applied to the file that also carries `phase`/`git-head`/`tree-digest`. Its absence (not a stored value) is what signals "not reviewed."

Do NOT delete `.sdd-state` for judge-only failures. Judge failures are spec/risk decisions for a human, not automatic code-fix work — Step 6.5 instead WRITES `phase: reviewed, verdict: FAIL` durably, precisely so this case is never confused with the one this step handles.

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
## JUDGMENT-DAY [or JUDGMENT-DAY-HIGH] — $FEATURE_ID

[paste the full ### Findings table from sdd-judge here]

Source: sdd-judge, review-feature phase
Date: [current date]
```

Use `JUDGMENT-DAY-HIGH` if judge verdict is `FAIL`; otherwise use `JUDGMENT-DAY`.

If judge verdict is `FAIL` (Final verdict `BLOCKED-JUDGMENT-DAY-HIGH`): before returning, run `sdd state-write $FEATURE_ID --phase reviewed --verdict FAIL`. This is the state-write deferred from Step 4 — it fires even though this branch returns `Status: blocked`, so a fresh `/sdd-next` reading `.sdd-state` afterward sees `phase: reviewed, verdict: FAIL` and knows review ran and is blocked on a human decision. This combination is unambiguous: a reviewer conformance FAIL never reaches this value (Step 5 clears the sentinel for that case instead), so `reviewed` + `FAIL` here means exactly one thing — judgment-day block, never "apply an automatic code fix."

Then return `Status: blocked`, `Verdict: BLOCKED-JUDGMENT-DAY-HIGH`, and include the findings plus `### Blocking Rationale` in `Spec-Gaps`. The human must decide whether to update the spec, accept the risk, or cancel/re-scope.

### 6.6. Record cross-review findings

If mode was `judgment-day`, `CROSS_REVIEW_AVAILABLE` was true, and `sdd-cross-reviewer` ran to a usable result (its response contains a `### Cross-Verdict:` line), append its output to `decisions.md`:

```markdown
## CROSS-REVIEW — $FEATURE_ID

[paste the full ### Cross-Findings block (table, "None.", or the unparseable raw-output block) from sdd-cross-reviewer here]

Cross-Verdict: [paste the ### Cross-Verdict: line]
Source: sdd-cross-reviewer (codex), review-feature phase
Date: [current date]
```

If the implementing model was assumed rather than read from a marker (Step 1.5 found no `implemented-by` line), add: `Implementing model assumed: claude (no implemented-by marker found)`.

If `CROSS_REVIEW_AVAILABLE` was false, Step 2.5's audit line already covers the skip — do not duplicate an entry here. Under `--minimal`, skip this step entirely (no section, no audit).

If the cross-agent failed per Step 3's fail-open handling (launch failure, crash, timeout, or no `### Cross-Verdict:` line), append one audit line instead of the full CROSS-REVIEW section:
```
[<ISO-8601 UTC timestamp>] Cross-Review: skipped — cross-agent failure: <detail>
```
Set the result envelope's `Cross-Review` field to the same value. This is audited exactly like a `CROSS_REVIEW_AVAILABLE = false` skip and is never treated as a phase failure — Step 4 consolidation proceeds using only `sdd-reviewer` + `sdd-judge`.

If the cross-review verdict is `FAIL`, add `cross-review reported FAIL (advisory)` to the result envelope's `Risks` field — never to `Verdict` or the Step 4 consolidation table.

### 7. Engram memory (skip if Engram unavailable)

- **On start**: `mem_search` query `sdd/$FEATURE_ID` + domain keywords, `project: "{project}"`.
- **After review**:
  - Always `mem_save` type: `event`, topic_key: `sdd/$FEATURE_ID/review`, content: `mode=<minimal|judgment-day> reviewer=<verdict> judge=<verdict|skipped> final=<verdict> feature=$FEATURE_ID`.
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
- **Artifacts**: [decisions.md if updated, review report if written, .sdd-state if written or deleted]
- **mode**: minimal | judgment-day
- **Cross-Review** _(optional, judgment-day only)_: <verdict> (advisory, model: codex) | skipped — <razón>
- **Next**: /archive-feature $FEATURE_ID (if PASS/PASS WITH WARNINGS) or /implement-task $FEATURE_ID with Review-Feedback (if FAIL) or human decision (if BLOCKED-JUDGMENT-DAY-HIGH)
- **Risks**: [critical gaps or concerns, or "None" — include `cross-review reported FAIL (advisory)` here if applicable]
- **Review-Feedback**: [structured table from reviewer — include when reviewer verdict is FAIL or PASS WITH WARNINGS]
- **Spec-Gaps**: [judge findings — include when Status is blocked due to BLOCKED-JUDGMENT-DAY-HIGH]
```

## Rules
- **NEVER use Plan Mode**: Do NOT use `EnterPlanMode`.
- **Delegate, don't execute**: Launch `sdd-reviewer` and, unless `--minimal`, `sdd-judge`; also launch `sdd-cross-reviewer` when judgment-day AND `CROSS_REVIEW_AVAILABLE`.
- **Run real tests**: The reviewer must run actual tests; the judge may run tests when relevant.
- **No voting**: There is no majority logic. Reviewer and judge are distinct signals.
- **Cross-review is advisory only**: it never contributes to Step 4 consolidation and never sets `Verdict`. A cross `FAIL` is recorded as a warning in `Risks`, never as a blocker. Every skip or unparseable result is audited in `decisions.md`, never silent.
- **Conservative consolidation**: Reviewer FAIL means code/test fix loop. Judge FAIL means human spec/risk decision, but judge FAIL requires a scoped, plausible, actionable high-severity finding.
- **Structured feedback**: Review-Feedback must be actionable and map to task bullets.
- Be specific — reference files and line numbers.
- Don't nitpick style unless it violates repo conventions.
- Always validate that delta specs in `decisions.md` cover all divergences.
- Always output the result envelope at the end.
