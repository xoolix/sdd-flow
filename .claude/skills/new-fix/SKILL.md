---
name: new-fix
description: Create a quick-spec.md for a single-domain bugfix (Kiro-style Current/Expected/Unchanged)
user-invocable: true
disable-model-invocation: true
arguments: bug description
---

# New fix (router)

Launch the native agent `sdd-new-fix` with `bug: $ARGUMENTS`.

The agent runs in sonnet (executor — `disallowedTools: [Agent]`) and runs the fast-lane entry gate (single-domain, no new deps, ≤2 GWT) followed by Kiro-style intake (Current / Expected / Unchanged) + `quick-spec.md` generation. See `.claude/agents/sdd-new-fix.md` for the full body.

**Fallback** — if `.claude/agents/sdd-new-fix.md` is not present, run `bin/sdd update` to deploy the agent layer, then retry.
