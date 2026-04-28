---
name: sdd-new
description: Start a new feature — orchestrator entry point that runs the new-feature conversational flow
user-invocable: true
disable-model-invocation: true
arguments: idea or request description
---

# Start new SDD feature

You are the **orchestrator**. The user wants to start a new feature.

User's input:

`$ARGUMENTS`

## What to do

1. Invoke the native agent `sdd-new-feature` via the Agent tool:

   ```
   Agent(
     subagent_type: "sdd-new-feature",
     prompt: "<idea: $ARGUMENTS>\n\n<shared rules: sdd-phase-common.md + engram-protocol.md>"
   )
   ```

   The agent runs in opus (executor, `disallowedTools: [Agent]`) and handles the conversational spec intake (confirm → trigger → happy path → domains → edge cases → GWT criteria → rollback → success criterion).

   **Fallback** — if `subagent_type: "sdd-new-feature"` is not recognized by the runtime:
   - Read the body of `.claude/agents/sdd-new-feature.md` and execute inline (degrade path — loses context isolation and model-per-frontmatter).

2. When the spec is generated, output the result envelope from the agent.
3. After the envelope, tell the user: "Para continuar con plan + tasks, escribí `/sdd-next`"
