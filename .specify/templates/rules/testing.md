# Testing

<!-- TODO: Run /init-project to auto-detect these from your codebase -->

## Framework
<!-- e.g. Vitest, Jest, pytest, go test -->

## File placement
<!-- e.g. __tests__/ mirroring src/, or colocated .test.ts files -->

## Naming
<!-- e.g. <name>.test.ts, test_<name>.py -->

## Running tests
<!-- e.g. pnpm run test, pytest, go test ./... -->

## TDD stance

`/implement-task` computes `TDD_MODE` per task (see `.claude/agents/sdd-implement-task.md` → "TDD detection (hard rule)"). It is **ON** automatically whenever the repo has a test framework configured OR any test files exist — no declaration needed. When ON, the RED → GREEN → TRIANGULATE → REFACTOR cycle is mandatory for every task with testable behavior; the only escape is a non-testable task (infra/config/migration/docs) with a `## Test-skip rationale` entry in `decisions.md`.

Use the knob below only to **force** the stance explicitly:

- `tdd: strict` — force `TDD_MODE` ON even in a greenfield repo with no tests yet (the implementer must introduce the framework and start the RED → GREEN → TRIANGULATE → REFACTOR cycle).
- `tdd: off` — opt out of mandatory test-first even when tests exist (test-first stays *preferred*, not gated). Use sparingly; this removes the regression guard.

<!-- tdd: strict -->
<!-- Uncomment a line above to force the stance. Absent line = automatic detection (recommended). -->
