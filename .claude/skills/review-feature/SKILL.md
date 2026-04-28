---
name: review-feature
description: Review implementation against the feature spec and plan using 3-agent voting
user-invocable: true
disable-model-invocation: true
arguments: feature-id
---

# Review feature (router)

Launch the native agent `sdd-review-feature` with `feature-id: $ARGUMENTS`.

The agent runs in sonnet (orchestrator — preserves Agent tool to delegate to 3 parallel `sdd-reviewer-voter` agents + `sdd-adversarial-reviewer` for spec-gap analysis). See `.claude/agents/sdd-review-feature.md` for the full body including voting logic, fix loop trigger, and Review-Feedback / Spec-Gaps output fields.

**Fallback** — if `.claude/agents/sdd-review-feature.md` is not present, run `bin/sdd update` to deploy the agent layer, then retry.
