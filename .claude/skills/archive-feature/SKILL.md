---
name: archive-feature
description: Close a completed feature — merge delta specs into main spec and archive
user-invocable: true
disable-model-invocation: true
arguments: feature-id
---

# Archive feature (router)

Launch the native agent `sdd-archive-feature` with `feature-id: $ARGUMENTS`.

The agent runs in haiku with isolated context and executes the full archive protocol (pre-flight checks, delta merge, folder move to `specs/archive/`, Engram snapshot). See `.claude/agents/sdd-archive-feature.md` for the full body.

**Fallback** — if `.claude/agents/sdd-archive-feature.md` is not present (agents directory not deployed), run `bin/sdd update` to deploy the agent layer, then retry. For emergency inline execution without the agent layer, consult git history of this file (pre-2026-04-23 version contained the full protocol inline).
