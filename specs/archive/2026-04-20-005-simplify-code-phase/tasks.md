# Tasks — 005-simplify-code-phase

## Execution order

### 1. Foundation

- [x] Create `.claude/skills/simplify-code/` and write `SKILL.md` skeleton with core frontmatter and section headers only.

### 2. Core implementation

- [x] SKILL.md pre-flight: spec/plan/tasks exist, all `[x]`, no SPEC-GAP-HIGH, no `.simplified`, branch-base resolvable.
- [x] SKILL.md baseline validation (DF-2): lint + types + tests in parallel before any edit; block if red.
- [x] SKILL.md scope: `git diff --name-only <base>..HEAD` minus exclusion globs (DF-5); record file list.
- [x] SKILL.md simplification: KISS/DRY/YAGNI/clarity checklist per file, minimal diff, NEVER list.
- [x] SKILL.md post-validation + revert (DF-4): re-run validations; on fail `git checkout -- <files>`, no sentinel, blocked.
- [x] SKILL.md sentinel + decisions.md entry with timestamp and file list.
- [x] SKILL.md result envelope: success → `Next: /review-feature`; empty diff → `no changes needed`.
- [x] `CLAUDE.md` phase detection: 4-column (DF-1), split final row into `/simplify-code` vs `/review-feature`.
- [x] `CLAUDE.md` pipeline diagram: insert simplify-code step + FAIL-path sentinel delete.
- [x] `CLAUDE.md`: add `simplify-code | sonnet` row to model routing table.
- [x] `CLAUDE.md`: add `/simplify-code` row to skill routing table.
- [x] `CLAUDE.md`: update workflow one-liner.
- [x] `sdd-continue/SKILL.md`: 4-column phase decision table update (DF-1).
- [x] `sdd-continue/SKILL.md`: `simplify-code | sonnet` row in phase-settings table.
- [x] `review-feature/SKILL.md`: new Step 4.5 deletes `.simplified` only on conformance FAIL (DF-3).
- [x] **ADDED**: `sdd-continue` Step 5 and `sdd-ff` Step 2b fix loops re-launch `/simplify-code` between re-implement and re-review (needed for AC-5 in automatic mode).

### 3. Validation

- [x] Lint/render check: YAML frontmatter valid in all 6 SKILL.md files; tables consistent in CLAUDE.md + sdd-continue.
- [x] AC-1 + AC-3: static trace against `simplify-code/SKILL.md` — happy path writes sentinel + `Next: /review-feature`; empty-diff branch writes sentinel with `Summary: no changes needed`.
- [x] AC-2: static trace — post-validation FAIL path runs `git checkout -- <SCOPED_FILES>`, skips sentinel, returns `Status: blocked` with `Validations-Output`.
- [x] AC-4: static trace — phase detection tables (CLAUDE.md + sdd-continue) both route `Yes|Yes|Yes|No → /simplify-code`; phase settings table has `simplify-code | auto | sonnet`.
- [x] AC-5: static trace — `review-feature` Step 4.5 deletes `.simplified` only on conformance FAIL; sdd-continue Step 5 + sdd-ff Step 2b fix loops now re-launch `/simplify-code` after implement-task, so the fix code flows through simplify before re-review.
- [x] Regression check: unchanged skills (`implement-task`, `archive-feature`) retain valid frontmatter; `archive-feature` still moves the whole `specs/<id>/` folder (sentinel rides along implicitly per DF-7).
- [x] Update `decisions.md` with ADDED/MODIFIED deltas.

## Notes
- Tasks are in dependency order: skeleton → content sections → integrations → validation.
- Each AC maps to at least one validation task (AC-1→task 17, AC-2→task 18, AC-3→task 17, AC-4→task 19, AC-5→task 20).
