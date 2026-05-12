---
name: sdd-new
description: Start a new feature — alias that runs the new-feature adversarial interview inline
user-invocable: true
disable-model-invocation: true
arguments: idea or request description
---

# Start new SDD feature

User's input: `$ARGUMENTS`

This skill is an **alias** for `/new-feature`. The two are equivalent.

## What to do

**Main Claude executes this inline.** Do NOT launch a sub-agent.

1. Read `.claude/skills/new-feature/SKILL.md` from the project (or `~/.claude/skills/new-feature/SKILL.md` if not present locally).
2. Execute its body **inline in this conversation**, substituting `$ARGUMENTS` as the feature idea.
3. The body runs the Pocock-style adversarial interview turn-by-turn with the user (8 categories, 1-3 questions per turn, wait for answer before advancing).

**CRITICAL — why this skill must NOT delegate to a sub-agent**: the adversarial interview requires multi-turn dialogue with the user. Sub-agents run one-shot and return; they cannot pause to ask the user mid-flow. If you delegate, the agent will silently auto-fill answers with assumptions and surface them only as "Open Questions" in its final envelope — defeating the entire purpose of the interview.

4. When `new-feature` produces its result envelope, relay it to the user and append: "Para continuar con plan + tasks, escribí `/sdd-next`".
