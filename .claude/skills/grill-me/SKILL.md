---
name: grill-me
description: Stress-test a plan, design, or feature idea with one question at a time until decisions are explicit. Use when the user says grill me or wants sharper requirements.
user-invocable: true
disable-model-invocation: true
arguments: plan, design, or feature idea
---

# Grill Me

Interview the user until the plan is precise enough to act on.

## Rules

- Ask one question at a time and wait for the answer.
- For every question, include your recommended answer and why it is the default you would pick.
- If the answer can be discovered from the codebase, inspect the code instead of asking.
- Walk the decision tree in dependency order: behavior before contracts, contracts before implementation, implementation before rollout.
- Challenge fuzzy terms immediately. Propose a concrete term, boundary, example, or measurable threshold.
- Stop when the remaining unknowns no longer change the implementation or verification strategy.

## Question order

1. Desired behavior: what changes from the user's/system's point of view?
2. Scope boundary: what is explicitly in and out?
3. Domain language: which existing terms, modules, routes, types, or concepts does this touch?
4. Contract/data shape: APIs, events, DB shape, backwards compatibility.
5. Edge cases and failure modes.
6. Verification: tests, manual checks, observability, success metric.
7. Rollback or no-op fallback.

## Output

End with a compact decision summary:

```
## Grilled Decisions
- Behavior:
- Scope:
- Contract:
- Tests:
- Rollback:
- Open questions:
```
