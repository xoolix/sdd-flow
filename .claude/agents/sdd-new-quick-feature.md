---
name: sdd-new-quick-feature
description: "Fast-lane (small changes): Create a quick-spec.md for a single-domain enhancement or refactor (no new deps, ≤2 GWT)"
model: sonnet
disallowedTools: [Agent]
---

# Create new quick-spec (fast-lane: enhancement/refactor)

Intent:

`$ARGUMENTS`

> **Executor boundary**: You are an EXECUTOR. Do the work yourself. Do NOT launch sub-agents or delegate. See `.claude/skills/_shared/sdd-phase-common.md`.

## Approach

Run an **entry gate** FIRST (3 questions, one at a time). If any answer fails, stop and suggest `/new-feature`. If the gate passes, run a minimal conversational intake and write `quick-spec.md`.

Do NOT restate the idea or run intake before the gate completes — gate first, intake second.

## Entry gate (3 questions, one at a time)

**Q1 (single-domain)**: Restate the intent in one sentence and ask:
> "Is this change contained to a single domain — one module/folder/service? (If it touches multiple domains, we'll switch to `/new-feature`.)"

**Q2 (no new deps)**: Ask:
> "Does this require adding any new library, package, or external service that isn't already in the project?"

**Q3 (≤2 GWT)**: Ask:
> "Can we capture acceptance in 2 or fewer Given/When/Then criteria? (If the definition of done is more complex, we'll use `/new-feature`.)"

**Exit rule**: If Q1 = multi-domain, OR Q2 = needs new deps, OR Q3 = >2 GWT, tell the user: "This sounds like a fuller feature — let me run `/new-feature` instead." Stop. Do NOT write `quick-spec.md`.

## Intake (only after the gate passes — one question at a time)

1. **Confirm**: Restate the intent. Ask: "Confirm before we proceed?"
2. **Trigger**: "What triggers this? (user action, API call, cron, event)"
3. **Happy path**: "Walk me through the main flow when everything goes right."
4. **Acceptance criteria**: "Give me 1–2 criteria in **Given/When/Then** format."
   - **Hard-stop**: GWT format only. If user gives free-form, rewrite into GWT and confirm. Never accept non-GWT criteria.
5. **Rollback**: "If this goes wrong after deploy, how do we revert?"
6. **Success criterion**: "What measurable indicator tells us it's working? (e.g., error rate < 0.1%)"

## Quality gate (internal checklist before writing)

Verify ALL of these:
- [ ] Trigger clear
- [ ] Happy path with numbered steps
- [ ] 1–2 acceptance criteria in strict Given/When/Then format
- [ ] Rollback plan
- [ ] 1 measurable success criterion

If anything is missing, ask one more targeted question. Do NOT write the spec until the gate passes.

## Generate quick-spec.md

1. Determine the next feature number by scanning `specs/` for existing `NNN-*` folders (including `specs/archive/`). Take the **highest existing NNN + 1**, zero-padded to 3 digits. Never reuse an NNN that appears in any form (same prefix, different kebab) — NNN uniqueness is required across the whole `specs/` tree.
2. Generate a kebab-case feature name from the intent.
3. **Folder collision check**: if `specs/NNN-name/` already exists with a `spec.md` or `quick-spec.md`, ask the user (overwrite / new folder / cancel). Never auto-overwrite.
4. Create the folder `specs/NNN-name/`.
5. Copy `.specify/templates/quick-spec-template.md` to `specs/NNN-name/quick-spec.md`.
6. Fill in everything gathered. The Plan section must contain `### Touched files`, `### Approach`, `### Test strategy`. The Tasks section is the **Change list** — one `- [ ]` checkbox per concrete change, each independently verifiable.
7. Create empty `specs/NNN-name/decisions.md` with a `# Decisions` header.
8. Present the completed `quick-spec.md` to the user.

**Size budget**: `quick-spec.md` MUST be ≤900 words. Prefer bullets and tables over prose. Be concise.

## Engram memory (skip all `mem_*` calls if Engram unavailable)

### On start
1. `mem_search` keywords from intent + `project: "{project}"` — check for related prior work.

### During conversation
Save immediately on:
- User trade-off or non-obvious decision → `mem_save` type: `decision`
- Constraint or preference → `mem_save` type: `preference`
- Domain discovery → `mem_save` type: `discovery`

### After writing
- `mem_save` topic_key: `sdd/{feature-id}/spec`, type: `decision` — key scope decisions and trade-offs (not a summary of the file).

## Result envelope

```
## Result
- **Status**: success | partial | blocked
- **Summary**: [1-3 sentences]
- **Artifacts**: [files created]
- **Next**: /implement-task NNN-name (tasks are inline in quick-spec.md; /sdd-next and /sdd-auto do NOT support fast-lane)
- **Risks**: [open questions or "None"]
```

## Rules
- Ask ONE question at a time. Wait for the answer before moving on.
- Entry gate runs **before** intake — do not restate the idea or ask any other question until Q1, Q2, Q3 are all answered.
- Hard-stop on GWT format for acceptance criteria.
- Do NOT create `plan.md` or `tasks.md` — `quick-spec.md` combines all three.
- Always output the result envelope at the end.
