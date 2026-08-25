# Tasks

<!-- Vertical slices, not horizontal layer chores.
     Each checkbox line is parsed by downstream skills; keep IDs stable.
     Metadata lines belong to the task immediately above them. -->

## Execution order

### 1. Foundation — conventions.md mechanism (spine)

- [x] **T001 [AFK] init-project fills Domain rules from scan**: Explore prompt (Step 1) asks for domain names; Step 3 replaces "Leave as TODO" with detected domains, reusing the overwrite guard.
  - blocked_by: none
  - verifies: AC4
  - touches: .claude/skills/init-project/SKILL.md
  - type: feat

- [x] **T002 [AFK] sdd-designer reads Domain rules**: greps `.claude/rules/conventions.md` § Domain rules before filling plan.md's domain sections; empty → derive from exploration findings.
  - blocked_by: none
  - verifies: AC2
  - touches: .claude/agents/sdd-designer.md
  - type: feat

- [ ] **T003 [AFK] new-feature reads Domain rules for spec Domains**: `## Domains` mapping instruction (SKILL.md:172) greps conventions.md § Domain rules first; empty → derive from clarify.md's Step 0 scan.
  - blocked_by: none
  - verifies: AC2
  - touches: .claude/skills/new-feature/SKILL.md
  - type: feat

- [ ] **T004 [AFK] sdd-research-spike reads Domain rules for Evaluation criteria**: greps conventions.md § Domain rules before filling `## Evaluation criteria`; empty → derive from what is evaluated.
  - blocked_by: none
  - verifies: AC2
  - touches: .claude/agents/sdd-research-spike.md
  - type: feat

### 2. Core implementation — template rewrites (downstream of the spine)

- [ ] **T005 [AFK] spec-template Domains becomes derived**: Replace the fixed 8-item checklist with an HTML comment instructing real-module derivation (name unchanged). Add a genuine test in tests/sdd.test.js: build a spec.md from the changed template via makeTempProject, run the real extract_section path, assert Summary/Acceptance Criteria/Rollback Plan return non-empty — behavioral, not a regression guard.
  - blocked_by: T003
  - verifies: AC1, AC5
  - touches: .specify/templates/spec-template.md, tests/sdd.test.js
  - type: feat

- [ ] **T006 [AFK] research-template Evaluation criteria becomes derived**: Replace the fixed vendor-selection list with an HTML comment deriving criteria from what is evaluated. Add a regression guard for the surviving heading.
  - blocked_by: T004
  - verifies: AC2
  - touches: .specify/templates/research-template.md, tests/sdd.test.js
  - type: feat

- [ ] **T007 [AFK] plan-template conditional sections**: `## Touched areas` drops the fixed APIs/DB/Jobs/UI fields for free-form Files/modules. `## Observability` and `## Migration / rollout` become conditional, reusing `N/A — <reason>` when absent. Not copied verbatim: update plan-feature/SKILL.md's "Fills in:" list, add its Domain vocabulary read instruction (F1's 4th consumer), and update sdd-designer.md to match. Add a regression guard for unchanged headings.
  - blocked_by: T002
  - verifies: AC3
  - touches: .specify/templates/plan-template.md, .claude/skills/plan-feature/SKILL.md, .claude/agents/sdd-designer.md, tests/sdd.test.js
  - type: feat

### 3. Validation

- [ ] **T008 [AFK] Verify domain vocabulary reaches filled artifacts**: Seed `.claude/rules/conventions.md` § Domain rules with distinctive test names; run sdd-designer (via plan-feature) and assert those names appear in plan.md's domain section. Empty the section, regenerate, and assert the names are gone and real modules appear instead. Regenerating 021's plan.md stays a sanity check (real paths, no fixed sub-fields), not the pass/fail gate.
  - blocked_by: T002, T007
  - verifies: AC6
  - touches: .claude/rules/conventions.md, specs/021-project-aware-templates/plan.md
  - type: feat

## Notes
- `[AFK]` = executable by `/implement-task`; no `[HITL]` — F1/F2/F5 decided in discovery.md.
- `blocked_by`: `none` or comma-separated task IDs.
- `tasks-template.md` out of scope (sibling branch); update `decisions.md` if the plan changes.
