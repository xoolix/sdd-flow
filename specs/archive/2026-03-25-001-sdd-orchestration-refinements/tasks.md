# Tasks

## Execution order

### 1. Foundation

- [x] **T1 — CLAUDE.md orchestration rules**: Add "Orchestration discipline" section to `.claude/CLAUDE.md` with two hard rules: (a) `/plan-feature` and `/review-feature` must never write implementation code, (b) `/new-feature` must enforce GWT format in acceptance criteria. These rules govern all downstream skill behavior.

- [x] **T2 — Spec template GWT guidance**: Update `.specify/templates/spec-template.md` to add a guidance comment in the acceptance-criteria section showing GWT format (`Given… When… Then…`) with a brief example. This ensures every new spec starts with the right structure.

### 2. Core implementation

- [x] **T3 — plan-feature: integrated explore + hard-stop**: Edit `.claude/skills/plan-feature/SKILL.md` to (a) add an automatic explore phase as step 1 that launches an Explore agent to analyze the codebase before planning, and (b) add a hard-stop rule stating this skill must never create or modify source/test files — only produce `plan.md` and `tasks.md`.

- [x] **T4 — new-feature: GWT enforcement**: Edit `.claude/skills/new-feature/SKILL.md` to add a hard-stop validation step before output: all acceptance criteria in the generated `spec.md` must use GWT format. If any criterion is not GWT, the skill must rewrite it before finalizing.

- [x] **T5 — review-feature: GWT-aware compliance matrix + hard-stop**: Edit `.claude/skills/review-feature/SKILL.md` to (a) add a hard-stop rule stating this skill must never create or modify source/test files — only produce review output, and (b) replace or augment the compliance checklist with a GWT-aware matrix that maps each GWT criterion from the spec to its implementation status (pass/fail/partial).

### 3. Validation

- [x] **T6 — Manual verification**: Run each modified skill on a throwaway test feature to confirm: (a) `/new-feature` rejects non-GWT acceptance criteria, (b) `/plan-feature` auto-explores and refuses to write code, (c) `/review-feature` produces a GWT compliance matrix and refuses to write code.

- [x] **T7 — Docs update**: Review all changed files for internal consistency. Confirm cross-references between CLAUDE.md rules and individual skill files are aligned. Update `decisions.md` if any task diverged from `plan.md`.

## Notes
- Each task targets exactly one file (except T6–T7 which are verification).
- T1–T2 must complete before T3–T5 since skills reference the top-level rules.
- T3, T4, T5 are independent and can be executed in any order.
- Update `decisions.md` if the plan changes.
