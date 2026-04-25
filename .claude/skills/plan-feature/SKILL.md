---
name: plan-feature
description: Turn a feature spec into a technical plan and task list
user-invocable: true
disable-model-invocation: true
arguments: feature-id
---

# Plan feature (router)

Launch the native agent `sdd-plan-feature` with `feature-id: $ARGUMENTS`.

The agent runs in opus (orchestrator — preserves Agent tool to delegate to internal sub-agents like `sdd-explore-agent`, `sdd-discovery-evaluator`, `sdd-designer`, `sdd-task-planner`). See `.claude/agents/sdd-plan-feature.md` for the full body.

**Fallback** — if `.claude/agents/sdd-plan-feature.md` is not present, run `bin/sdd update` to deploy the agent layer, then retry.
