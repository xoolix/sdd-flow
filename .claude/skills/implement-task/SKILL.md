---
name: implement-task
description: Execute the next uncompleted task from a feature's task list
user-invocable: true
disable-model-invocation: true
arguments: feature-id
---

# Implement task (router)

Launch the native agent `sdd-implement-task` with `feature-id: $ARGUMENTS`.

The agent runs in sonnet (executor — `disallowedTools: [Agent]`) and executes the full task-batch implementation protocol (TDD detection, batch scoping, per-task writes, validation, delta capture, Engram save). See `.claude/agents/sdd-implement-task.md` for the full body.

**Review-fix cycle**: if the user passes a `### Review-Feedback` block, the agent's Step 2b handles the bullet reopen/add logic.

**Fallback** — if `.claude/agents/sdd-implement-task.md` is not present, run `bin/sdd update` to deploy the agent layer, then retry.
