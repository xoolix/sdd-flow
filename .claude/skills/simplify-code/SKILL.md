---
name: simplify-code
description: Apply KISS/DRY/YAGNI to files touched by a feature, re-validate, revert on regression
user-invocable: true
disable-model-invocation: true
arguments: feature-id
---

# Simplify code (router)

Launch the native agent `sdd-simplify-code` with `feature-id: $ARGUMENTS`.

The agent runs in sonnet (executor — `disallowedTools: [Agent]`) and executes the full simplification protocol (baseline validation, scope resolution, KISS/DRY/YAGNI edits, post-validation, revert-on-regression, `.simplified` sentinel). See `.claude/agents/sdd-simplify-code.md` for the full body.

**Fallback** — if `.claude/agents/sdd-simplify-code.md` is not present, run `bin/sdd update` to deploy the agent layer, then retry.
