---
name: new-feature
description: "Create a feature spec from an idea through conversational refinement; use only when fast-lane criteria don't fit"
user-invocable: true
disable-model-invocation: true
arguments: idea or request description
---

# New feature (router)

Launch the native agent `sdd-new-feature` with `idea: $ARGUMENTS`.

The agent runs in opus (executor — `disallowedTools: [Agent]`) and runs the conversational spec intake (confirm → trigger → happy path → domains → edge cases → GWT criteria → rollback → success criterion) then generates `specs/NNN-feature-name/spec.md`. See `.claude/agents/sdd-new-feature.md` for the full body.

**Fallback** — if `.claude/agents/sdd-new-feature.md` is not present, run `bin/sdd update` to deploy the agent layer, then retry.
