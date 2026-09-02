# SDD Phase — Common Protocol

This file contains shared rules for ALL SDD phase skills. Sub-agents MUST follow these sections.

---

## A. Executor Boundary

You are an **EXECUTOR**, not an orchestrator. Do the phase work yourself.

- Do NOT launch sub-agents, do NOT call `delegate`/`task`, and do NOT bounce work back to another agent.
- The ONLY exception is if the phase skill explicitly tells you to delegate (e.g., plan-feature launching parallel agents for plan + tasks).
- If you are blocked, STOP and report the blocker in the return envelope — do NOT try to work around it by delegating.

## A2. No Plan Mode

**NEVER use `EnterPlanMode` or Claude Code's native Plan Mode.** You must write files directly using `Write` or `Edit` tools. Plan Mode creates an interactive approval flow that breaks the SDD pipeline. Your output is always **files** (plan.md, tasks.md, etc.), never a plan proposal waiting for user approval.

---

## B. Project Standards (Compact Rules)

If the orchestrator included a `## Project Standards (auto-resolved)` section in your launch prompt:

1. These are **compact rules** extracted from project-specific skills (e.g., React 19 patterns, testing conventions).
2. Each rule is an actionable constraint — follow them when writing or reviewing code.
3. They are already resolved and injected by the orchestrator — do NOT read the original skill files.

If no Project Standards section was provided, proceed with your phase skill only.

---

## C. File-Based Persistence

All artifacts live in `specs/<feature-id>/`:

| Artifact | File |
|----------|------|
| Spec | `specs/<feature-id>/spec.md` |
| Plan | `specs/<feature-id>/plan.md` |
| Tasks | `specs/<feature-id>/tasks.md` |
| Decisions | `specs/<feature-id>/decisions.md` |
| **Fast-lane combined spec** | `specs/<feature-id>/quick-spec.md` (replaces spec+plan+tasks — see §I) |

Rules:
- Always write artifacts to these paths.
- If the file exists, read it before overwriting.
- Never create directories outside `specs/`.

---

## D. Return Envelope

Every phase MUST return this envelope at the end:

```
## Result
- **Status**: success | partial | blocked | ESCALATED
- **Summary**: [1-3 sentences describing what was done]
- **Artifacts**: [files created/modified]
- **Next**: [next phase to run, or specific action needed]
- **Risks**: [risks discovered, or "None"]
- **Validations-Output** _(optional)_: [concrete test/lint/typecheck output from the phase]
- **TDD-Evidence** _(optional)_: [RED failure output, GREEN pass output, TRIANGULATE case count or skip note]
- **Review-Feedback** _(optional)_: [structured list of failed criteria and fix instructions from review]
- **Commit** _(optional)_: [commit SHA when this phase committed, or `none` when the phase does not commit]
```

Rules:
- Always include the five core fields (Status, Summary, Artifacts, Next, Risks).
- `Validations-Output` is optional. Include it when the phase runs tests, lint, or typecheck. Paste the concrete command output so downstream phases and the orchestrator can act on it. Primarily used by `/implement-task`.
- `TDD-Evidence` is optional at the schema level, the same way `Commit` is — but mandatory in `/implement-task`'s own contract for every task with testable behavior: RED output, GREEN output, and TRIANGULATE case count or skip note (see `sdd-implement-task.md`). A missing or incomplete field there is a failed validation for that phase.
- `Review-Feedback` is optional. Include it when a review phase produces a FAIL or PASS WITH WARNINGS verdict. It must be a structured list of failed criteria with actionable fix instructions. Primarily used by `/review-feature` to feed the evaluator-optimizer loop.
- `Commit` is optional. It holds the commit SHA when the phase calls `sdd commit-slice` (the committing phases are `/implement-task`, `/simplify-code`, and `/archive-feature`); it is `none` when the phase does not commit. A commit failure is reported via `Status: blocked`, never through this field.
- Envelopes without the optional fields remain valid — existing phases are not required to emit them.
- `Next` should name the specific skill (e.g., `/implement-task 001-feature-name`).
- If blocked, explain what's needed before the phase can continue.
- `ESCALATED`: Used when the orchestrator exhausts its retry budget (max 2 retries) for a phase and escalates to the human. The envelope must include a diagnostic explaining what failed and the error output from each attempt.

---

## E. Artifact Size Budgets

Keep artifacts concise to prevent context bloat in downstream phases:

| Artifact | Max Words |
|----------|-----------|
| Spec | 650 |
| Plan | 800 |
| Tasks | 530 |

If you exceed the budget, cut prose first — prefer tables and bullet points.

---

## F. Post-Phase Validation Protocol

After a sub-agent completes a phase, the orchestrator MUST validate before advancing.

### 3-Step Validation

| Step | Check | How |
|------|-------|-----|
| 1. Artifacts exist | All files listed in `Artifacts` field exist on disk | `ls` each path |
| 2. Envelope complete | Return envelope has all required fields (Status, Summary, Artifacts, Next, Risks) and optional fields where applicable (Validations-Output, Review-Feedback) | Parse sub-agent output |
| 3. Lint/tests pass | Run lint, typecheck, and tests if applicable to the phase | Parallel Bash calls; skip if phase produces no code (e.g., spec, plan) — `archive-feature` is not exempt: it moves files, not prose, so this step still runs |

A phase passes validation only when **all three steps** succeed.

For `implement-task`, step 2 (Envelope complete) also covers `TDD-Evidence`: absent or incomplete TDD-Evidence counts as an envelope-complete failure — no separate mechanism, it rides the retry→ESCALATED budget below like any other envelope-complete failure.

### Retry Logic

**Non-retryable phases** — checked before the retry loop below starts: `archive-feature`. Its pre-flight requires `specs/<id>/spec.md`, `plan.md`, and `tasks.md`; archive's own move already removed them, so a retry would fail pre-flight and produce a misleading diagnostic, not a second chance. On validation failure for a non-retryable phase, the orchestrator MUST report `Status: blocked` with the validation output and stop — zero retries, never `ESCALATED`. The archive move itself is not in question; what broke is downstream.

- **Max retries**: 2 per phase invocation, for any phase not named in the non-retryable list above.
- On failure, re-launch the sub-agent with the original prompt **plus** the error context from the failed validation step(s).
- Each retry includes: which step(s) failed, the error output, and the retry attempt number.
- If **2 retries are exhausted** without passing validation, the orchestrator MUST stop and report with `Status: ESCALATED`, including a diagnostic with the error output from each attempt so the human can distinguish agent errors from environment issues.

---

## G. Engram Persistent Memory

All phases participate in Engram persistent memory to build cross-phase and cross-feature knowledge.

**Full protocol**: Read `.claude/skills/_shared/engram-protocol.md` for conventions, topic keys, and memory types.

### Project Name Resolution (MANDATORY — first Engram action in any phase)

Before any `mem_*` call, you need the project name. Resolve it in this order:

1. **If the orchestrator passed it**: Use the `Engram project name: "{project}"` value from your launch prompt.
2. **If running directly** (no orchestrator): Run `git remote get-url origin` → extract repo name (e.g., `github.com/user/my-app` → `my-app`). Fallback: current directory name.
3. **Never** use skill names, phase names, or invented names (e.g., never "sdd-flow").

### Session Init (when running without an orchestrator)

If you are running as a standalone skill (not launched by `sdd-next`/`sdd-auto`):
1. Call `mem_session_start` with `project: "{project}"`, description: `SDD {phase-name}: {feature-id}`
2. Call `mem_context` with `project: "{project}"` to load prior context

If an orchestrator launched you, it already did this — skip session init.

### Quick Reference

1. **Phase start**: Call `mem_search` with query `sdd/{feature-id}` + 2-4 broader domain keywords, `project: "{project}"`, to recover prior context and related knowledge.
2. **During phase**: Call `mem_save` immediately when you discover a gotcha, the user makes a trade-off, or you learn something non-obvious. Don't wait until the end.
3. **Phase end**: Save anything not yet saved before returning. You have the freshest context — don't rely on the orchestrator to save for you.

### Session Close (when running without an orchestrator)

If you called `mem_session_start` (i.e., running standalone):
1. Call `mem_session_summary` with `project: "{project}"` — what was done, key decisions, blockers
2. Call `mem_session_end`

### What to save

- User decisions and trade-offs (the "why", not the "what")
- Gotchas and unexpected behaviors discovered
- Cross-feature patterns useful for future work
- User preferences specific to this project
- Sparse lifecycle events that help recover from compaction (verdicts, blockers, unresolved human decisions)

### What NOT to save

- Summaries of files created (that's in git)
- Restating spec/plan content (that's in the files)
- "Feature archived" notifications (that's in the archive folder)
- Secrets, credentials, private URLs, PII, copied specs, or raw logs

### Rules
- Engram complements file-based persistence (section C) — it does NOT replace spec.md, plan.md, etc.
- Authority order is: current user input, repo state files, current codebase, then Engram. Memory can suggest a question or pattern, never override files or skip SDD gates.
- Keep entries concise: 2-5 sentences. Exception: `/archive-feature` saves a longer snapshot (see archive skill).
- Topic key patterns: `sdd/{feature-id}/{phase-name}` for feature-specific, `sdd/research/{topic}` for research, `project/{topic}` for cross-feature.
- Before saving, ask: would this help someone starting a new feature in this project 3 months from now, is it still true after checking files, and is it safe to persist?
- If Engram tools are unavailable, skip all memory calls and continue normally.

---

## H. Compaction Safety

Context compaction may occur mid-session, erasing working memory. Follow these rules to remain resilient:

1. **Save during work, not just at the end**: Call `mem_save` as discoveries happen. Don't accumulate saves for the end — compaction may erase them.
2. **Save before returning**: You have the freshest context. Save key observations before producing the return envelope (section D).
3. **Session management**: Orchestrators (`sdd-next`, `sdd-auto`) or standalone skills (section G) manage sessions. Project name is resolved once and reused.
4. **Recovery after compaction**: If you lose context, call `mem_context` with `project: "{project}"` and re-read state files to re-derive your position in the pipeline.
5. **Sub-agents are stateless**: Each sub-agent starts fresh. The `mem_search` at phase start (section G) is how sub-agents inherit knowledge from prior phases. The orchestrator passes the resolved project name in the launch prompt.

---

## I. Fast-Lane Resolution

Fast-lane features (created via `/sdd-new`, `/new-quick-feature`, or `/new-fix`) use a single `quick-spec.md` artifact instead of separate `spec.md` + `plan.md` + `tasks.md`. Skills that read spec artifacts MUST resolve the lane in their pre-flight using this canonical pattern:

```
Resolve lane:
- If `specs/<feature-id>/quick-spec.md` exists AND `specs/<feature-id>/plan.md` does NOT exist
    → FAST_LANE = true,  SPEC_FILE = quick-spec.md
- Else if `specs/<feature-id>/spec.md`, `plan.md`, AND `tasks.md` all exist
    → FAST_LANE = false, SPEC_FILE = spec.md
- Else
    → blocked: tell the user which artifact is missing and suggest `/plan-feature` or `/new-quick-feature`
```

### Behavior table

| Concern | Full-flow (`FAST_LANE=false`) | Fast-lane (`FAST_LANE=true`) |
|---|---|---|
| Spec content source | `spec.md` + `plan.md` + `tasks.md` | `quick-spec.md` (combined) |
| Task list location | `tasks.md` checkboxes | `quick-spec.md` `## Tasks` section |
| Task writeback target | `tasks.md` | `quick-spec.md` `## Tasks` section (NOT `tasks.md`) |
| All-`[x]` gate target | `tasks.md` | `quick-spec.md` `## Tasks` section |
| `decisions.md` delta merge target | `spec.md` | `quick-spec.md` |

### Skills that MUST apply this resolution

- `/implement-task`
- `/simplify-code`
- `/review-feature`
- `/archive-feature`

### Orchestrator support

`/sdd-next` and `/sdd-auto` support fast-lane by detecting `quick-spec.md`, reading the `## Tasks` section, and skipping `/plan-feature`.

### Tasks section format

The `## Tasks` section in `quick-spec.md` uses the SAME vertical-slice checkbox format as `tasks.md`; only the file target changes.

```markdown
- [ ] **T001 [AFK] Title**: thin independently verifiable slice
  - blocked_by: none
  - verifies: AC1
  - touches: api, ui, tests
```

- `[AFK]` means `/implement-task` may execute it.
- `[HITL]` means human decision checkpoint; record the decision in `decisions.md`, then mark the task `[x]`.
- `blocked_by` is `none` or comma-separated task IDs.
- Downstream all-done gates still count only top-level `- [ ]` / `- [x]` task bullets.
