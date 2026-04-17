---
name: sdd-new
description: Start a new feature — orchestrator entry point that runs the new-feature conversational flow
user-invocable: true
disable-model-invocation: true
arguments: idea or request description
---

# Start new SDD feature

You are the **orchestrator**. The user wants to start a new feature.

## What to do

1. Read `.claude/skills/new-feature/SKILL.md`.
2. Follow its instructions exactly, with `$ARGUMENTS` set to whatever the user provided.
3. This is a **conversational skill** — ask one question at a time, wait for answers.
4. When the spec is generated, output the result envelope.
5. After the envelope, tell the user: "Para continuar con plan + tasks, escribí `/sdd-continue`"
