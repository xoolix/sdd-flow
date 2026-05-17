---
name: new-fix
description: "Fast-lane (bugfix): Create a quick-spec.md for a low-risk single-domain bugfix (Kiro-style Current/Expected/Unchanged)"
user-invocable: true
disable-model-invocation: true
arguments: bug description
---

# Create new fix-spec (fast-lane: bugfix)

Bug intent:

`$ARGUMENTS`

**Main Claude executes this skill body inline.** Do NOT launch a sub-agent — this intake is conversational and must ask the user one question at a time.

## Approach

Run an **entry gate** FIRST (4 questions, one at a time). If any answer fails, stop and suggest `/new-feature`. If the gate passes, run a minimal Kiro-style intake (Current / Expected / Unchanged) and write `quick-spec.md`.

Do NOT restate the bug or run intake before the gate completes — gate first, intake second.

## Entry gate (4 questions, one at a time)

**Q1 (single-domain)**: Restate the intent in one sentence and ask:
> "Is this fix contained to a single domain — one module/folder/service? (If it touches multiple domains, we'll switch to `/new-feature`.)"

**Q2 (no new deps)**: Ask:
> "Does this fix require adding any new library, package, or external service that isn't already in the project?"

**Q3 (≤2 GWT)**: Ask:
> "Can we capture acceptance in 2 or fewer Given/When/Then criteria? (If the definition of done is more complex, we'll use `/new-feature`.)"

**Q4 (risk screen)**: Ask:
> "Does this fix touch schema/data migration, auth/permissions, billing/payments, public API/integration contracts, background jobs, concurrency, security/privacy, perf-critical paths, or rollback-hard behavior?"

**Exit rule**: If Q1 = multi-domain/unknown, OR Q2 = needs new deps/unknown, OR Q3 = >2 GWT/unknown, OR Q4 = any risk trigger/unknown, tell the user: "This sounds like a fuller feature — let me run `/new-feature` instead." Stop. Do NOT write `quick-spec.md`.

## Intake (only after the gate passes — one question at a time)

1. **Confirm**: Restate the bug. Ask: "Confirm bug description before we proceed?"
2. **Trigger**: "How is this bug reproduced? (steps or conditions)"
3. **Current behavior**: "What happens today (the bug)?"
4. **Expected behavior**: "What should happen instead?"
5. **Unchanged behavior** (regression guard): "What MUST NOT change — what existing behavior do you want to guarantee stays the same?"
6. **Acceptance criteria**: "Give me 1–2 criteria in **Given/When/Then** format. Ideally one criterion is a unit test that fails before the fix and passes after."
   - **Hard-stop**: GWT format only. If user gives free-form, rewrite into GWT and confirm. Never accept non-GWT criteria.
7. **Rollback**: "If the fix goes wrong after deploy, how do we revert?"
8. **Success criterion**: "What measurable indicator tells us the bug is gone? (e.g., error rate, log absence)"

## Quality gate (internal checklist before writing)

Verify ALL of these:
- [ ] Trigger clear
- [ ] Current Behavior, Expected Behavior, **Unchanged Behavior** all have >=1 entry each (Unchanged is the regression guard — non-empty required)
- [ ] 1–2 acceptance criteria in strict Given/When/Then format
- [ ] Rollback plan
- [ ] 1 measurable success criterion

If anything is missing, ask one more targeted question.

## Generate quick-spec.md

1. Determine the next feature number by scanning `specs/` for existing `NNN-*` folders (including `specs/archive/`). Take the **highest existing NNN + 1**, zero-padded to 3 digits. Never reuse an NNN that appears in any form — NNN uniqueness is required across the whole `specs/` tree.
2. Generate a kebab-case feature name from the intent.
3. **Folder collision check**: if `specs/NNN-name/` already exists with a `spec.md` or `quick-spec.md`, ask the user (overwrite / new folder / cancel). Never auto-overwrite.
4. Create the folder `specs/NNN-name/`.
5. Copy `.specify/templates/fix-spec-template.md` (NOT `quick-spec-template.md`) to `specs/NNN-name/quick-spec.md`.
6. Fill in everything gathered. The Plan section must contain `### Root cause`, `### Touched files`, `### Fix description`, `### Test strategy` (with the bug-reproduction unit test called out). The Tasks section is the **Vertical slice change list** — one `- [ ]` checkbox per independently verifiable slice using:
   ```
   - [ ] **T001 [AFK] <title>**: <bug repro test plus minimal fix slice>
     - blocked_by: none
     - verifies: AC1
     - touches: <modules/files/domains>
   ```
   Use `[HITL]` only when a human decision is required before implementation can continue.
7. Create empty `specs/NNN-name/decisions.md` with a `# Decisions` header.
8. Present the completed `quick-spec.md` to the user.

**Size budget**: `quick-spec.md` MUST be <=900 words. Prefer bullets and tables over prose. Be concise.

## Engram memory (skip all `mem_*` calls if Engram unavailable)

### On start
1. `mem_search` keywords from bug description + `project: "{project}"` — check for related prior bugs or fixes.

### During conversation
Save immediately on:
- Non-obvious root cause → `mem_save` type: `discovery`
- Trade-off in fix approach → `mem_save` type: `decision`
- Constraint or preference → `mem_save` type: `preference`

### After writing
- `mem_save` topic_key: `sdd/{feature-id}/spec`, type: `decision` — key scope decisions and the root cause if non-obvious.

## Result envelope

```
## Result
- **Status**: success | partial | blocked
- **Summary**: [1-3 sentences]
- **Artifacts**: [files created]
- **Next**: /sdd-next NNN-name (or /implement-task NNN-name if you want manual control; tasks are inline in quick-spec.md)
- **Risks**: [open questions or "None"]
```

## Rules
- Ask ONE question at a time. Wait for the answer before moving on.
- Entry gate runs **before** intake — do not restate the bug or ask any other question until Q1, Q2, Q3, and Q4 are all answered.
- Hard-stop on GWT format for acceptance criteria.
- Unchanged Behavior list is the regression guard — non-empty required.
- Do NOT create `plan.md` or `tasks.md` — `quick-spec.md` combines all three.
- Do NOT launch sub-agents. This command owns the conversation inline.
- Always output the result envelope at the end.
