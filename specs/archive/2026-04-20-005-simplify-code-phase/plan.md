# Technical Plan — 005-simplify-code-phase

## Inputs
- Spec: `specs/005-simplify-code-phase/spec.md`
- Discovery decisions: `specs/005-simplify-code-phase/discovery.md` (DF-1 through DF-10)
- Pattern reference: `.claude/skills/implement-task/SKILL.md` (DF-8: reuse as template)

---

## Current state

| File | Role today |
|------|-----------|
| `.claude/CLAUDE.md` lines 100-107 | 3-col phase detection table: `spec? | plan+tasks? | all [x]?` |
| `.claude/CLAUDE.md` lines 60-95 | Phase pipeline diagram (no simplify-code step) |
| `.claude/CLAUDE.md` lines 176-188 | Skill routing table (no simplify-code row) |
| `.claude/CLAUDE.md` lines 200-212 | Model routing table (no simplify-code row) |
| `.claude/skills/sdd-continue/SKILL.md` lines 42-47 | 3-col phase detection table (mirrors CLAUDE.md) |
| `.claude/skills/sdd-continue/SKILL.md` lines 79-83 | Phase-specific settings table (no simplify-code) |
| `.claude/skills/review-feature/SKILL.md` ~lines 134, 248 | No sentinel deletion step |
| `.claude/skills/simplify-code/` | Does not exist |

---

## Proposed design

| Domain | Change |
|--------|--------|
| Phase detection (DF-1) | Add 4th column `.simplified exists?` to both CLAUDE.md and sdd-continue tables. New rows: `Yes|Yes|Yes|No → /simplify-code`; `Yes|Yes|Yes|Yes → /review-feature`. All other rows get `—` in 4th column. |
| New skill | Create `.claude/skills/simplify-code/SKILL.md` patterned on `implement-task` (DF-8). Frontmatter: `name: simplify-code`, model: sonnet (DF-6), `user-invocable: true`, `disable-model-invocation: true`, `arguments: feature-id`. |
| Baseline validation (DF-2) | First act of skill: run lint + typecheck + tests in parallel. If any red → `Status: blocked`, no edits. |
| Scope | `git merge-base main HEAD` → `git diff --name-only <base>..HEAD`, filtered by exclusion globs (see below). |
| Exclusion globs (DF-5) | Tests: `**/*.test.*`, `**/*.spec.*`, `**/__tests__/**`, `**/test/**`, `**/tests/**`. Lockfiles: `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `poetry.lock`, `Cargo.lock`. Migrations: `**/migrations/**`, `**/db/migrate/**`. Configs: `*.config.*`, `.env*`, `docker-compose.*`, `tsconfig.json`, `vite.config.*`. _Rationale: tests must stay authoritative; lockfiles are binary-equivalent; migrations must be immutable; configs are env-specific and not logic._ |
| Edit rules | Apply KISS/DRY/YAGNI, behavior-preserving. Never: change function signatures, remove exports, rename public symbols, edit test files, change dependency versions. |
| Revert pattern (DF-4) | Record file list before edits. On post-validation failure: `git checkout -- <file1> <file2> ...` (explicit list, no wildcards). No sentinel created. |
| Sentinel | Write `specs/<id>/.simplified` (timestamp + file list) only on success or empty-diff. |
| review-feature (DF-3) | Insert step after verdict aggregation (~line 134): if `Verdict: FAIL` (conformance only) → delete `specs/<id>/.simplified`. SPEC-GAP-HIGH leaves sentinel intact. |
| archive-feature (DF-7) | No change — folder move implicitly carries or removes sentinel. |
| sdd-ff | No structural change — inherits updated detection from CLAUDE.md and sdd-continue. |
| Pipeline diagram | Insert `simplify-code` step between `implement-task` and `review-feature` in CLAUDE.md lines 60-95. |
| Skill routing | Add `/simplify-code` row to CLAUDE.md skill routing table. |
| Model routing | Add `simplify-code` row: model = sonnet. |

---

## Touched areas

| File | Nature of change |
|------|-----------------|
| `.claude/CLAUDE.md` | 4th col phase table; pipeline diagram; skill routing row; model routing row |
| `.claude/skills/sdd-continue/SKILL.md` | 4th col phase table; phase-settings row |
| `.claude/skills/review-feature/SKILL.md` | Insert sentinel-deletion step (conformance FAIL only) |
| `.claude/skills/simplify-code/SKILL.md` | **Create new** |
| `specs/<id>/.simplified` | Runtime artifact (not a source file) |

No API contracts, DB schemas, UI surfaces, or background jobs touched.

---

## Data flow

```
sdd-continue detects: spec✓ plan✓ tasks-all-[x]✓ .simplified-absent
    → launch /simplify-code <id>

simplify-code:
  1. Pre-flight: spec/plan/tasks exist, all [x], no SPEC-GAP-HIGH, no .simplified
  2. Baseline: lint + typecheck + tests (parallel) → if red: Status: blocked, stop
  3. Scope: git merge-base main HEAD → git diff --name-only <base>..HEAD, apply exclusion globs
     → if empty: write .simplified, Status: success "no changes needed"
  4. Record file list (for revert)
  5. Edit: KISS/DRY/YAGNI per file, behavior-preserving
  6. Post-validate: lint + typecheck + tests (parallel)
     → if red: git checkout -- <file1> <file2>..., no .simplified, Status: blocked
     → if green: write specs/<id>/.simplified (timestamp + file list)
  7. Append decisions.md entry
  8. Envelope: Status: success, Next: /review-feature

sdd-continue (after fix cycle):
  .simplified present → launch /review-feature

review-feature:
  Steps 1-4 (3-agent voting + verdict aggregation)
  → Verdict: FAIL → delete specs/<id>/.simplified
  → sdd-continue after next implement-task fix: .simplified absent → re-launch /simplify-code

review-feature:
  → SPEC-GAP-HIGH → .simplified untouched → human manages manually
```

---

## Migration / rollout

| Step | Action |
|------|--------|
| 1 | Create `.claude/skills/simplify-code/SKILL.md` |
| 2 | Update `review-feature/SKILL.md` (sentinel deletion) |
| 3 | Update `CLAUDE.md` (4th col + pipeline diagram + routing rows) |
| 4 | Update `sdd-continue/SKILL.md` (4th col + settings row) |

**Rollback**: remove the `simplify-code` row from phase detection tables in step 3 → pipeline skips directly to `/review-feature`. Revert steps 1-2. No stray sentinels remain (archive-feature moves them; existing features without sentinel auto-route to review).

---

## Observability

**Envelope fields** (in addition to standard):

| Field | Content |
|-------|---------|
| `Validations` | `baseline: pass/fail`, `post-edit: pass/fail` |
| `Validations-Output` | stdout/stderr of lint + typecheck + tests (truncated to last 100 lines on failure) |
| `Files-Simplified` | list of files edited (or `none` for empty diff) |
| `Revert-Applied` | `true/false` |

**decisions.md entry format**:
```
## Simplify: 2026-04-20
Files: src/foo.ts, src/bar.ts
Changes: removed duplicate null-check in foo.ts:42; extracted shared formatter in bar.ts:10-15
Baseline: pass | Post-edit: pass
```

---

## Test strategy

| Method | What it covers |
|--------|---------------|
| Dogfood on trivial feature | Run `/simplify-code` on a single-file feature with deliberate dead code. Verify AC-1 (sentinel created, tests pass). |
| Regression revert path | Introduce a simplification that breaks a test. Verify AC-2 (revert applied, no sentinel, Status: blocked). |
| Empty diff | Feature whose files already pass KISS/DRY. Verify AC-3 (sentinel created, "no changes needed"). |
| Orchestrator detection | Run `/sdd-continue` with all tasks `[x]`, no `.simplified`. Verify AC-4 (simplify-code launched before review). |
| Review-FAIL invalidation | Place `.simplified`, run `/review-feature` with a seeded FAIL. Verify AC-5 (sentinel deleted, next sdd-continue re-launches simplify). |
| Regression on existing skills | Run a pre-existing feature through `/sdd-continue` end-to-end; confirm review-feature and archive-feature behavior unchanged. |

---

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Over-simplification: skill removes logic mistaken as dead code | Medium | High | Strict NEVER list (no signature changes, no export removal); post-validation is mandatory gate |
| False positives on KISS/DRY (style-only churn with no real gain) | Medium | Low | Decisions.md entry with file-by-file summary makes churn visible; human can revert pre-commit |
| Review-fix cycle cost doubled (simplify re-runs after each FAIL) | Low | Medium | Baseline validation (DF-2) is fast; edit pass only touches scoped files; AC-5 is the intended design |
| Baseline re-validation latency (+30-60s per run) | High | Low | Accepted trade-off (DF-2 decision); parallelized lint+typecheck+tests reduces wall time |
| Branch-base undetectable (shallow clone, detached HEAD) | Low | Medium | Pre-flight check; `Status: blocked` with explicit diagnostic if `git merge-base` fails |
