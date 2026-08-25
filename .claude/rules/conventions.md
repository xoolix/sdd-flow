# Conventions

<!-- TODO: Run /init-project to auto-detect these from your codebase -->

## Stack
<!-- e.g. Framework, language, UI library, database, auth, deployment -->

## Naming
<!-- e.g. File naming: kebab-case, Variables: camelCase, Components: PascalCase -->

## Folder structure
<!-- e.g. app/ — Pages, lib/ — Core logic, components/ — UI -->

## Lint / Format
<!-- e.g. ESLint, Prettier, Ruff, etc. -->

## Domain rules
<!-- Project-specific business logic rules -->
- **CLI surface** — `bin/sdd` subcommands (`init`, `branch`, `commit-slice`, `open-pr`, `status`, `update`) that own every git-write and project-scaffolding operation (ADR 0002: the CLI is the sole git-write path).
- **Phase agents** — `.claude/agents/sdd-*.md` leaf executors (designer, task-planner, implementer, reviewer, judge, cross-reviewer, discovery-evaluator, explore-agent) that do the actual spec/plan/code work for one pipeline phase each.
- **Orchestration skills** — `.claude/skills/*/SKILL.md` inline coordinators (`sdd-new`, `sdd-next`, `sdd-auto`, `plan-feature`, `review-feature`, `implement-task`, `simplify-code`, `archive-feature`) that sequence phases, launch agents, and validate their result envelopes.
- **Artifact templates** — `.specify/templates/*.md` the shape every generated `spec.md`/`plan.md`/`tasks.md`/`research.md`/`quick-spec.md` is built from.
- **Rules layer** — `.claude/rules/*.md` per-project knobs (`conventions`, `testing`, `git`, `model-overrides`) that agents grep for explicit opt-in behavior instead of relying on ambient loading (e.g. the `auto-commit` and `tdd` knobs).
- **Test suite** — `tests/sdd.test.js` behavioral coverage of the CLI's shipped functions, plus prose-wiring regression guards for the agent/skill files above.
