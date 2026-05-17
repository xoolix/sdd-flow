---
name: sdd-hitl
description: List or resolve human-in-the-loop SDD task checkpoints
user-invocable: true
disable-model-invocation: true
arguments: feature-id [task-id] [decision text]
---

# SDD HITL checkpoint helper

Resolve `[HITL]` task checkpoints without launching a sub-agent.

Feature/task/decision: `$ARGUMENTS`

## Modes

- `/sdd-hitl` - auto-detect the only active feature and list unlocked HITL tasks.
- `/sdd-hitl <feature-id>` - list unlocked HITL tasks for that feature.
- `/sdd-hitl <feature-id> Tnnn "<decision>"` - record the decision and mark that HITL task complete.

If multiple active feature folders exist and no feature-id was passed, ask the user which one. If a task ID is passed without decision text, show the exact task and ask for the decision text.

## Steps

1. **Resolve feature-id and optional task**
   - Split `$ARGUMENTS` on whitespace.
   - The first token matching `T[0-9][0-9][0-9]` is `task_id`.
   - Tokens before `task_id` form `feature-id`.
   - Tokens after `task_id` form `decision_text` (strip surrounding quotes if present).
   - If no feature-id was provided, auto-detect only when exactly one folder exists under `specs/` excluding `archive/`.

2. **Resolve task source**
   - If `specs/<feature-id>/quick-spec.md` exists and `plan.md` does not, use its `## Tasks` section.
   - Else use `specs/<feature-id>/tasks.md`.
   - If neither exists, return `Status: blocked` and `Next: /sdd-new`.

3. **Parse tasks**
   - Read checkbox task bullets plus indented metadata.
   - A HITL task is any task bullet containing `[HITL]`.
   - A task is unlocked only when every `blocked_by` ID is already checked (`- [x]`).

4. **List mode**
   - If no `task_id` was passed, list unlocked unchecked `[HITL]` tasks.
   - If none are unlocked but locked HITL tasks exist, list the first locked HITL task and missing blockers.
   - If no HITL tasks exist, return `Status: success` with `Next: /sdd-next <feature-id>`.

5. **Resolve mode**
   - Locate `task_id`. If missing, return `Status: blocked`.
   - If the task is not `[HITL]`, return `Status: blocked`; `/implement-task` owns `[AFK]` work.
   - If the task is locked, return `Status: blocked` with missing blockers.
   - If `decision_text` is empty, show the exact task and return `Status: blocked` asking the user to re-run with a decision.
   - Append this entry to `specs/<feature-id>/decisions.md`:
     ```
     ## HITL Decision: <YYYY-MM-DD> - <task_id>
     - **Task**: <exact task bullet before checking>
     - **Decision**: <decision_text>
     ```
   - Mark only that exact task bullet checked in the task source (`- [ ]` -> `- [x]`).

## Result envelope

Always output:

```
## Result
- **Status**: success | blocked
- **Summary**: [listed HITL checkpoints or recorded decision]
- **Artifacts**: [tasks file and decisions.md if modified]
- **Next**: /sdd-next <feature-id>
- **Risks**: [missing blockers, missing decision, or None]
```

## Rules
- Do not launch sub-agents.
- Do not edit source code.
- Do not mark AFK tasks.
- Record human decisions before marking HITL complete.
- Preserve task IDs and task bullet text except for the checkbox.
