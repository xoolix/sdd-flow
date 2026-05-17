---
name: tdd
description: Test-driven development with a vertical red-green-refactor loop through public interfaces. Use when building features or fixing bugs with test-first development.
user-invocable: true
disable-model-invocation: true
arguments: feature-id or task description
---

# TDD

Use this when the work has observable behavior and should be implemented test-first.

## Core rules

- Test behavior through public interfaces, not private helpers or implementation shape.
- Work vertically: one behavior, one failing test, the smallest implementation, then repeat.
- Do not write a batch of tests for imagined future behavior before making the first one pass.
- Never refactor while RED. Reach GREEN first, then clean up with tests passing.
- Prefer integration-style tests that exercise real code paths. Mock only external boundaries that are slow, flaky, paid, or unavailable.
- Test names should read like specs and use the project's domain language.
- If the behavior cannot be tested, record the reason in `decisions.md` before implementing.

## Workflow

1. Identify the next behavior from the spec, quick-spec, task, bug report, or user request.
2. Write exactly one failing test for that behavior.
3. Run the narrowest command that proves the test fails for the expected reason.
4. Implement the smallest code change that makes the test pass.
5. Run the narrow test again, then the relevant broader validation.
6. Repeat for the next behavior.
7. Refactor only after all current tests are green, and rerun tests after each refactor step.

## Output

When reporting back, include the real RED and GREEN command output. Do not say "tests pass" without evidence.
