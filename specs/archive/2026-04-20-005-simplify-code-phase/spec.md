# Feature: simplify-code phase

## Summary
Add a `/simplify-code` phase to the SDD pipeline between `/implement-task` and `/review-feature`. It reads files touched in the feature, applies KISS/DRY/YAGNI rules preserving behavior, and re-runs lint/typecheck/tests. On regression it reverts the diff and blocks. A sentinel `specs/<id>/.simplified` prevents re-runs; `/review-feature` deletes it on FAIL so fixes re-enter simplify.

## Trigger
- **Automatic**: `sdd-continue` / `sdd-ff` detect `all tasks [x]` + no `.simplified` sentinel → launch `/simplify-code` before `/review-feature`.
- **Manual**: user runs `/simplify-code <feature-id>`.

## Happy Path
1. Pre-flight: spec/plan/tasks exist, all tasks `[x]`, last validation green, no `SPEC-GAP-HIGH` pending, no fresh `.simplified` sentinel (a stale sentinel whose `git-head` ≠ current HEAD is treated as absent).
2. Scope: `git diff --name-only <branch-base>..HEAD`, excluding tests, lockfiles, migrations, configs.
3. Simplify: for each file, apply KISS/DRY/YAGNI/clarity checklist, write minimal diff. File **modifications only** — never create or delete files (see NEVER list in `simplify-code/SKILL.md`).
4. Post-validation: lint + typecheck + tests in parallel. Before any revert, verify `git status --porcelain -- <SCOPED_FILES>` shows only `M` (modified) entries; any `D` (deleted) is a skill-internal bug and blocks.
5. Sentinel: re-check `.simplified` absence immediately before writing (TOCTOU guard); then write `specs/<id>/.simplified` containing `git-head: <HEAD-SHA>`, an ISO-8601 timestamp, and the modified file list.
6. Decisions log: append entry in `decisions.md` summarizing simplifications.
7. Envelope: `Status: success`, `Next: /review-feature`.

## Domains
- [x] Pipeline / orchestration (`sdd-continue`, `sdd-ff`, `CLAUDE.md` phase detection + model routing + skill routing)
- [x] New skill (`.claude/skills/simplify-code/SKILL.md`)
- [x] Existing skill updates (`review-feature` deletes sentinel on FAIL; `archive-feature` cleans sentinel)
- [x] Feature artifacts (`specs/<id>/.simplified`, `decisions.md` entries)
- [x] Validation: project lint + typecheck + tests

## Edge Cases
- **Regression post-simplify**: validation fails → `git checkout` diff, no sentinel, `Status: blocked` with diagnostic.
- **Empty diff**: nothing to simplify → create sentinel anyway, `Status: success`, `Summary: no changes needed`.
- **Review-fix cycle**: `/review-feature` FAIL → deletes `.simplified` → next `sdd-continue` after fix re-runs simplify.
- **Out-of-scope files**: diff contains unrelated merges → scope strictly to branch-base diff, exclude tests/lockfiles/migrations/configs.
- **Branch base undetectable**: cannot resolve base → `Status: blocked` with diagnostic.
- **Stale sentinel (integrity)**: `.simplified` exists but its `git-head` ≠ current HEAD → orchestrator treats the sentinel as absent and routes back to `/simplify-code`. This defends against sentinel spoofing and against a sentinel that survives across unrelated commits (e.g., user amends HEAD after simplify).
- **Concurrent invocation (TOCTOU)**: The pipeline orchestrator (`sdd-continue`/`sdd-ff`) serializes phases — concurrent `/simplify-code` on the same feature-id is unsupported. `/simplify-code` re-checks sentinel absence at write time; if a concurrent run has written the sentinel, the later run aborts without overwriting (`Status: blocked`, `Summary: sentinel written concurrently`).
- **File deletion attempt**: `/simplify-code` never deletes files (NEVER list). If post-validation triggers a revert and `git status` shows any deleted path in `SCOPED_FILES`, that is a skill-internal bug — abort with `Status: blocked` diagnostic rather than attempt a possibly-incomplete `git checkout --`.

## Acceptance Criteria
- [ ] **AC-1 Happy path** — Given a feature with all tasks `[x]`, last validation green, no fresh `.simplified`, When `/simplify-code <id>` runs, Then `specs/<id>/.simplified` is created with `git-head` matching current HEAD, lint + typecheck + tests pass, and the envelope reports `Status: success` with `Next: /review-feature`.
- [ ] **AC-2 Regression revert** — Given simplify-code modified files and post-validation fails, When the skill ends, Then for every path in `SCOPED_FILES`, `git diff HEAD -- <path>` returns empty after the revert, the sentinel is NOT created, and the envelope reports `Status: blocked` with the validation error.
- [ ] **AC-3 Empty diff** — Given a feature whose files are already clean, When `/simplify-code` runs, Then the sentinel is created (with `git-head` matching current HEAD), and the envelope reports `Status: success` with `Summary: no changes needed`.
- [ ] **AC-4 Orchestrator auto-advance** — Given all tasks `[x]` and no fresh `.simplified`, When `/sdd-continue` runs, Then the orchestrator detects `simplify-code` as the next phase and launches it automatically before `/review-feature`.
- [ ] **AC-5 Review FAIL invalidates sentinel** — Given a feature with `.simplified` present, When `/review-feature` issues a `FAIL` verdict, Then `.simplified` is deleted and the next `/sdd-continue` after the fix re-launches `/simplify-code`.
- [ ] **AC-6 Stale sentinel treated as absent** — Given `specs/<id>/.simplified` exists but its `git-head` ≠ `git rev-parse HEAD`, When `/sdd-continue` runs, Then the orchestrator treats the sentinel as absent and launches `/simplify-code`.
- [ ] **AC-7 Deletion attempt blocks** — Given simplify-code (due to a skill-internal bug) produced a deleted path in `SCOPED_FILES`, When post-validation runs, Then the skill aborts with `Status: blocked` before attempting revert, the sentinel is NOT created, and the envelope names the deleted paths in the diagnostic.

## Rollback Plan
- Remove the `simplify-code` row from the phase detection table in `CLAUDE.md` — orchestrator goes back to `/implement-task` → `/review-feature` directly.
- Revert the commit introducing `.claude/skills/simplify-code/` and the edits in `sdd-continue`, `sdd-ff`, `CLAUDE.md`, `archive-feature`, `review-feature`.
- `/archive-feature` already cleans `.simplified`, so no stray sentinels remain if disabled.

## Success Criteria
- Post-simplify validation pass rate ≥ 95% across real features (≤ 1 in 20 runs breaks).
- Review feedback items of style/clarity reduced ≥ 50% vs. pre-simplify baseline (measured over next 5 features).
- Total pipeline duration increases no more than 20% with the new phase.

## Open Questions
- None.
