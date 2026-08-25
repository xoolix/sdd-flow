# Tasks

<!-- Vertical slices, not horizontal layer chores.
     Each checkbox line is parsed by downstream skills; keep IDs stable.
     Metadata lines belong to the task immediately above them. -->

## Execution order

### 1. Foundation — conventions.md mechanism (spine)

- [x] **T001 [AFK] init-project fills Domain rules from scan**: Explore Step 1 asks for domain names; Step 3 replaces "Leave as TODO" with detected domains, reusing the overwrite guard.
  - blocked_by: none
  - verifies: AC4
  - touches: .claude/skills/init-project/SKILL.md
  - type: feat

- [x] **T002 [AFK] sdd-designer reads Domain rules**: greps `.claude/rules/conventions.md` § Domain rules before filling plan.md's domain sections; empty → derive from exploration findings.
  - blocked_by: none
  - verifies: AC2
  - touches: .claude/agents/sdd-designer.md
  - type: feat

- [x] **T003 [AFK] new-feature reads Domain rules for spec Domains**: `## Domains` (SKILL.md:172) greps conventions.md § Domain rules first; empty → derive from clarify.md's Step 0 scan.
  - blocked_by: none
  - verifies: AC2
  - touches: .claude/skills/new-feature/SKILL.md
  - type: feat

- [x] **T004 [AFK] sdd-research-spike reads Domain rules for Evaluation criteria**: greps conventions.md § Domain rules before filling `## Evaluation criteria`; empty → derive from what's evaluated.
  - blocked_by: none
  - verifies: AC2
  - touches: .claude/agents/sdd-research-spike.md
  - type: feat

### 2. Core implementation — template rewrites (downstream of the spine)

- [x] **T005 [AFK] spec-template Domains becomes derived**: Replace the fixed 8-item checklist with an HTML comment for real-module derivation (name unchanged). Add a genuine tests/sdd.test.js test: build spec.md from the changed template via makeTempProject, run the real extract_section path, assert Summary/AC/Rollback Plan are non-empty — behavioral, not a regression guard.
  - blocked_by: T003
  - verifies: AC1, AC5
  - touches: .specify/templates/spec-template.md, tests/sdd.test.js
  - type: feat

- [x] **T006 [AFK] research-template Evaluation criteria becomes derived**: Replace the fixed vendor-selection list with an HTML comment deriving criteria from what is evaluated. Add a regression guard for the surviving heading.
  - blocked_by: T004
  - verifies: AC2
  - touches: .specify/templates/research-template.md, tests/sdd.test.js
  - type: feat

- [x] **T007 [AFK] plan-template conditional sections**: `## Touched areas` drops the fixed APIs/DB/Jobs/UI fields for a free-form Files/modules table. Observability/Migration become conditional, reusing `N/A — <reason>`. Not copied verbatim: update plan-feature/SKILL.md's "Fills in:" list plus Domain vocabulary read instruction (F1's 4th consumer), and sdd-designer.md. Add a regression guard for unchanged headings.
  - blocked_by: T002
  - verifies: AC3
  - touches: .specify/templates/plan-template.md, .claude/skills/plan-feature/SKILL.md, .claude/agents/sdd-designer.md, tests/sdd.test.js
  - type: feat

### 3. Validation

- [x] **T008 [AFK] Verify domain vocabulary reaches filled artifacts**: Seed conventions.md § Domain rules with distinctive names; run sdd-designer (via plan-feature) and assert they appear in plan.md's domain section. Empty the section, regenerate, and assert real modules appear instead. Regenerating 021's plan.md is a sanity check, not the pass/fail gate.
  - blocked_by: T002, T007
  - verifies: AC6
  - touches: .claude/rules/conventions.md, specs/021-project-aware-templates/plan.md
  - type: feat

- [x] **T009 [AFK] Pristine rules seed**: `cmd_init` copies `.claude/rules/*` from a versioned seed, not SDD_HOME's own, so this repo self-describes without contaminating new projects.
  - blocked_by: T008
  - verifies: Rollback Plan
  - touches: bin/sdd, .specify/templates/rules/, tests/sdd.test.js
  - type: fix

## Notes
- `[AFK]` = executable by `/implement-task`; no `[HITL]` — F1/F2/F5 decided in discovery.md.
- `blocked_by`: `none` or comma-separated task IDs.
- `tasks-template.md` out of scope (sibling branch); update `decisions.md` if the plan changes.
