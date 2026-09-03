---
name: new-quick-feature
description: "Fast-lane (small changes): Create a quick-spec.md for a low-risk single-domain enhancement or refactor (no new deps, ≤2 GWT)"
user-invocable: true
arguments: idea or request description
---

# Create new quick-spec (fast-lane: enhancement/refactor)

Intent:

`$ARGUMENTS`

**Main Claude executes this skill body inline.** Do NOT launch a sub-agent — this intake is conversational and must ask the user one question at a time.

**Invocation guard**: run this intake only when the user explicitly typed `/new-quick-feature`, or `/sdd-new` classified the lane and routed here. Never start it on your own initiative mid-conversation — if an intake seems warranted, suggest the command and let the user decide.

## Approach

`/sdd-new` already classified this as fast-lane — **do not re-interrogate the user to re-confirm the lane.** Instead:

1. **Scan the code first** (Step 0) so your questions are grounded and you can infer most answers.
2. Run a **grill-me-style intake**: one question at a time, each with a recommendation, skipping anything the code or the idea already answers. Stop asking when remaining unknowns no longer change the implementation or verification strategy.
3. **You draft** the acceptance criteria / rollback / success metric from the conversation and present them for confirmation — the user does not have to type Given/When/Then.

There is no user-facing entry gate. The only escalation is the silent guard inside Step 0.

## Step 0 — Silent mini-scan (before the first question)

Ground yourself in the codebase. ~30-60 seconds:

- `Glob` for paths the idea likely touches; `Grep` for symbols/strings from `$ARGUMENTS`; `Read` the top 2-3 most relevant files.
- The scan is **for you** — do NOT dump file lists or excerpts to the user. Absorb context and reference real names in your questions.
- If a question can be answered from code, answer it from code instead of asking.

**Silent escalation guard** (no questions): while scanning, if the change as understood genuinely requires a schema/data migration, auth/permission change, billing/payments, a public API/integration contract change, background jobs, concurrency, or other rollback-hard behavior, stop the fast lane and tell the user once:
> "Esto toca `<concrete trigger found in code>` — lo trato como `/new-feature` para no subdimensionarlo."
Then invoke the `new-feature` skill via the Skill tool with the same intent. Do NOT ask the four old gate questions; this guard fires only on a concrete trigger you actually found, otherwise stay fast-lane silently.

## Grill-me intake (one question at a time)

Walk the decision tree in dependency order, but **only ask what the scan left open**:

1. **Behavior** — what changes from the user's/system's point of view? (Was X, now Y.)
2. **Scope** — which file/module/symbol does it land in? Reuse vs new? (Reference what you found in Step 0; confirm rather than ask open-ended when the scan already suggests the answer.)
3. **Trigger** — user action, API call, cron, event — if not obvious from the code.
4. **Edge / failure modes** — only the 1-2 that actually affect this slice.

Rules for the intake:
- One question at a time. Wait for the answer.
- Every question carries a concrete **recommendation** ("Recomendación: …, porque …") the user can accept, reject, or edit.
- If the code answers it, do not ask it — state the inferred answer as part of your recommendation so the user can correct it.
- Challenge fuzzy terms once with a concrete referent, then move on.
- Stop when the remaining unknowns no longer change implementation or verification.

## Auto-drafted quality gate (you draft, user confirms)

Once the intake has enough signal, **you write** the following from the conversation + code — do not make the user phrase them:

```
Antes de generar quick-spec.md, confirmá o corregí:

ACCEPTANCE CRITERIA (G/W/T):
- [ ] Given X, When Y, Then Z
- [ ] Given A, When B, Then C   (máx 2)

ROLLBACK:
- <plan>

SUCCESS METRIC:
- <measurable indicator, e.g. error rate < 0.1%>
```

**Hard gate**: do NOT write `quick-spec.md` until the user confirms (or corrects) the three blocks. If they correct, rewrite and re-present. The artifact still carries strict Given/When/Then acceptance criteria — you authored them, the user only validated.

If drafting the acceptance criteria forces you past 2 G/W/T to capture "done", that is a signal the change outgrew fast-lane — invoke the `new-feature` skill via the Skill tool with the same intent.

## Generate quick-spec.md

1. Determine the next feature number by scanning `specs/` for existing `NNN-*` folders (including `specs/archive/`). Take the **highest existing NNN + 1**, zero-padded to 3 digits. Never reuse an NNN that appears in any form (same prefix, different kebab) — NNN uniqueness is required across the whole `specs/` tree.
2. Generate a kebab-case feature name from the intent.
3. **Folder collision check**: if `specs/NNN-name/` already exists with a `spec.md` or `quick-spec.md`, ask the user (overwrite / new folder / cancel). Never auto-overwrite.
4. Create the folder `specs/NNN-name/`.
5. Copy `.specify/templates/quick-spec-template.md` to `specs/NNN-name/quick-spec.md`.
6. Fill in everything gathered. The Plan section must contain `### Touched files`, `### Approach`, `### Test strategy`. The Tasks section is the **Vertical slice change list** — one `- [ ]` checkbox per independently verifiable slice using:
   ```
   - [ ] **T001 [AFK] <title>**: <thin slice>
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
- **Next**: /sdd-next NNN-name (or /implement-task NNN-name if you want manual control; tasks are inline in quick-spec.md)
- **Risks**: [open questions or "None"]
```

## Rules
- **Scan before asking** (Step 0). Never ask what the code answers — infer it and let the user correct.
- **No user-facing entry gate.** `/sdd-new` already chose the lane; trust it. The only escalation is the silent Step 0 guard, and it fires only on a concrete trigger found in code.
- Ask ONE question at a time, each with a recommendation. Wait for the answer before moving on.
- Stop asking when remaining unknowns no longer change implementation or verification.
- **You draft** acceptance criteria (strict G/W/T), rollback, and success metric; the user confirms or corrects — they do not type G/W/T.
- Do NOT create `plan.md` or `tasks.md` — `quick-spec.md` combines all three.
- Do NOT launch sub-agents. This command owns the conversation inline.
- **NEVER use Plan Mode**: do NOT use `EnterPlanMode`.
- Always output the result envelope at the end.
