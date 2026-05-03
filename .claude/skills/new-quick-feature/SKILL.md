---
name: new-quick-feature
description: "Fast-lane (small changes): Create a quick-spec.md for a single-domain enhancement or refactor (no new deps, ≤2 GWT)"
user-invocable: true
disable-model-invocation: true
arguments: idea or request description
---

# New quick-feature (router)

Launch the native agent `sdd-new-quick-feature` with `intent: $ARGUMENTS`.

The agent runs in sonnet (executor — `disallowedTools: [Agent]`) and runs the fast-lane entry gate (single-domain, no new deps, ≤2 GWT) followed by intake + `quick-spec.md` generation. See `.claude/agents/sdd-new-quick-feature.md` for the full body.

**Fallback** — if `.claude/agents/sdd-new-quick-feature.md` is not present, run `bin/sdd update` to deploy the agent layer, then retry.
