---
name: research-spike
description: Investigate an uncertain technical or product topic
user-invocable: true
disable-model-invocation: true
arguments: topic to investigate
---

# Research spike (router)

Launch the native agent `sdd-research-spike` with `topic: $ARGUMENTS`.

The agent runs in sonnet with forked context and executes the full research protocol (clarification phase, parallel exploration, research.md generation, Engram saves). See `.claude/agents/sdd-research-spike.md` for the full body.

**Fallback** — if `.claude/agents/sdd-research-spike.md` is not present, run `bin/sdd update` to deploy the agent layer, then retry.
