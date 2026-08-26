---
name: new-fix
description: "Fast-lane (bugfix): Create a quick-spec.md for a low-risk single-domain bugfix (Kiro-style Current/Expected/Unchanged)"
user-invocable: true
arguments: bug description
---

# Create new fix-spec (fast-lane: bugfix)

Bug intent:

`$ARGUMENTS`

**Main Claude executes this skill body inline.** Do NOT launch a sub-agent — this intake is conversational and must ask the user one question at a time.

**Invocation guard**: run this intake only when the user explicitly typed `/new-fix`, or `/sdd-new` classified the lane and routed here. Never start it on your own initiative mid-conversation — if an intake seems warranted, suggest the command and let the user decide.

## Approach

`/sdd-new` already classified this as fast-lane — **do not re-interrogate the user to re-confirm the lane.** Instead:

1. **Scan the code first** (Step 0): try to locate the buggy code and infer the root cause before asking anything.
2. Run a **grill-me-style intake** around Current / Expected / Unchanged: one question at a time, each with a recommendation, skipping anything the code already answers.
3. **You draft** the acceptance criteria / rollback / success metric and present them for confirmation — the user does not have to type Given/When/Then.

There is no user-facing entry gate. The only escalation is the silent guard inside Step 0.

## Step 0 — Silent mini-scan (before the first question)

Ground yourself in the buggy code. ~30-60 seconds:

- `Grep` for the error message, symbol, or route from `$ARGUMENTS`; `Read` the suspect file(s) and the surrounding flow.
- Form a **root-cause hypothesis** from the code so your questions confirm a theory rather than start from zero.
- The scan is **for you** — do NOT dump file lists or excerpts. Absorb context and reference real names.

**Silent escalation guard** (no questions): if the fix as understood genuinely requires a schema/data migration, auth/permission change, billing/payments, a public API/integration contract change, background jobs, concurrency, or other rollback-hard behavior, stop the fast lane and tell the user once:
> "Esto toca `<concrete trigger found in code>` — lo trato como `/new-feature` para no subdimensionarlo."
Then invoke the `new-feature` skill via the Skill tool with the same intent. Otherwise stay fast-lane silently.

## Grill-me intake (one question at a time)

Walk Current / Expected / Unchanged in order, but **only ask what the scan left open**:

1. **Repro / trigger** — how is it reproduced? (Confirm from code if you can already see the path.)
2. **Current behavior** — what happens today. Lead with your code-derived hypothesis: "Por lo que vi en `<file:line>`, parece que <root cause>. ¿Coincide?"
3. **Expected behavior** — what should happen instead.
4. **Unchanged behavior** (regression guard) — what MUST NOT change. This one is rarely inferable; almost always ask. Non-empty is required.

Rules for the intake:
- One question at a time, each with a concrete **recommendation**. Wait for the answer.
- If the code answers it, state the inferred answer instead of asking open-ended.
- Stop when the remaining unknowns no longer change the fix or its verification.

## Auto-drafted quality gate (you draft, user confirms)

Once the intake has enough signal, **you write** the following from the conversation + code:

```
Antes de generar quick-spec.md, confirmá o corregí:

ACCEPTANCE CRITERIA (G/W/T):
- [ ] Given X, When Y, Then Z   (ideally one is a unit test that fails before the fix, passes after)
- [ ] Given A, When B, Then C   (máx 2)

UNCHANGED (regression guard):
- <what must stay the same>

ROLLBACK:
- <plan>

SUCCESS METRIC:
- <measurable indicator, e.g. error rate, log absence>
```

**Hard gate**: do NOT write `quick-spec.md` until the user confirms (or corrects) these blocks. The Unchanged list must be non-empty. The artifact still carries strict G/W/T acceptance criteria — you authored them, the user only validated.

If capturing "done" needs more than 2 G/W/T, the fix outgrew fast-lane — invoke the `new-feature` skill via the Skill tool with the same intent.

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
- **Scan before asking** (Step 0). Form a root-cause hypothesis from code; confirm it instead of asking from zero.
- **No user-facing entry gate.** `/sdd-new` already chose the lane; trust it. The only escalation is the silent Step 0 guard, firing only on a concrete trigger found in code.
- Ask ONE question at a time, each with a recommendation. Wait for the answer before moving on.
- Stop asking when remaining unknowns no longer change the fix or its verification.
- **You draft** acceptance criteria (strict G/W/T), rollback, and success metric; the user confirms or corrects.
- Unchanged Behavior list is the regression guard — non-empty required.
- Do NOT create `plan.md` or `tasks.md` — `quick-spec.md` combines all three.
- Do NOT launch sub-agents. This command owns the conversation inline.
- **NEVER use Plan Mode**: do NOT use `EnterPlanMode`.
- Always output the result envelope at the end.
