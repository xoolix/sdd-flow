---
name: prototype
description: Build a clearly throwaway prototype to answer a design question before committing production code. Use for state models, business logic, UI options, or "let me play with it".
user-invocable: true
disable-model-invocation: true
arguments: prototype goal
---

# Prototype

A prototype is throwaway code that answers one question. The result worth keeping is the decision, not the code.

## Input shape

Preferred feature-bound form:

```
/prototype "NNN-feature-name: question to answer"
```

If the argument starts with `NNN-...:`, treat it as linked to `specs/NNN-feature-name/`. Otherwise run standalone.

## Pick a branch

- **Logic/state question**: build a tiny runnable terminal or script prototype that exercises the state machine or business rule.
- **UI question**: build several visibly different variants behind one route/view, with a simple toggle or query param.
- If ambiguous and the user is unavailable, choose based on surrounding code: backend/service modules → logic; pages/components → UI. State the assumption at the top of the prototype.

## Rules

- Mark files clearly with `PROTOTYPE` in the filename, route, or top comment.
- Put the prototype close to the code it is testing, unless the project already has a prototype/sandbox convention.
- Provide one command to run it.
- Keep state in memory by default. Use scratch persistence only if persistence is the thing being tested.
- Skip production polish: no broad abstractions, no exhaustive error handling, no test suite unless the prototype question is specifically about testability.
- Surface the relevant state after each action or variant switch.
- Do not leave prototype code silently in the product path. Delete it or fold the validated decision into production code.

## Durable capture

Before finishing, record:

```
## Prototype Result
- Question:
- How to run:
- What we learned:
- Decision:
- Delete or absorb next:
```

Put that in the result envelope, an ADR, an issue, or a local `NOTES.md` next to the prototype.

For feature-bound prototypes, also append this exact block to `specs/<feature-id>/decisions.md`:

```markdown
## PROTOTYPE-RESULT — <feature-id>

- Question:
- How to run:
- What we learned:
- Decision:
- Delete or absorb next:
- Date:
```

If the prototype answers a `PROTOTYPE-REQUIRED` marker from `/new-feature`, this `PROTOTYPE-RESULT` unblocks `/plan-feature`.

## Engram memory

Skip if Engram is unavailable.

- Feature-bound: `mem_save` topic_key `sdd/<feature-id>/prototype`, type `decision`, content = the decision and why it was chosen over alternatives.
- Standalone but reusable: `mem_save` topic_key `project/prototypes`, type `learning` or `pattern`, content = the reusable lesson only.
- Do not save prototype code, screenshots, raw logs, secrets, or throwaway implementation details.

## Result envelope

Always finish with:

```
## Result
- **Status**: success | partial | blocked
- **Summary**: [what question the prototype answered]
- **Artifacts**: [prototype files, decisions.md if updated]
- **Prototype Result**: [Question / How to run / What we learned / Decision / Delete or absorb next]
- **Next**: delete prototype files, absorb decision into production plan, or /plan-feature <feature-id>
- **Risks**: [remaining unknowns or "None"]
```
