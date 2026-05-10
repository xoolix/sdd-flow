---
name: new-feature
description: "Adversarially interview the user to produce clarify.md + spec.md (and ADRs when applicable); use only when fast-lane criteria don't fit"
user-invocable: true
disable-model-invocation: true
arguments: idea or request description
---

# New feature (router)

Launch the native agent `sdd-new-feature` with `idea: $ARGUMENTS`.

The agent runs in opus (executor — `disallowedTools: [Agent]`) and runs a Pocock-style adversarial interview covering 8 ordered categories (problema → usuarios → scope → supuestos → edge cases → dominio → decisiones duras → acceptance), asking 1-3 questions per turn and not advancing until each category is closed. It pastes the user's literal answers into `clarify.md`, then auto-drafts the structured blocks (GWT acceptance criteria, rollback plan, measurable success metric) for the user to validate, and finally formalizes everything into `specs/NNN-feature-name/spec.md`. ADRs in `docs/adr/` are offered in-the-moment for architectural decisions. See `.claude/agents/sdd-new-feature.md` for the full body.

**Fallback** — if `.claude/agents/sdd-new-feature.md` is not present, run `bin/sdd update` to deploy the agent layer, then retry.
