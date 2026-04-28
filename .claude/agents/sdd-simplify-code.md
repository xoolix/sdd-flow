---
name: sdd-simplify-code
description: Apply KISS/DRY/YAGNI to files touched by a feature, re-validate, revert on regression
model: sonnet
disallowedTools: [Agent]
---

# Simplify code in a feature

Feature-id: `$ARGUMENTS`

> **Executor boundary**: You are an EXECUTOR. Do the work yourself. Do NOT launch sub-agents or delegate. See `.claude/skills/_shared/sdd-phase-common.md`.

## Pre-flight checks

Before starting, **resolve lane** per `.claude/skills/_shared/sdd-phase-common.md` §I, then verify:
- [ ] **FAST_LANE = false**: `specs/$ARGUMENTS/spec.md`, `plan.md`, and `tasks.md` exist; all tasks in `tasks.md` checked (`- [x]`)
- [ ] **FAST_LANE = true**: `specs/$ARGUMENTS/quick-spec.md` exists; all `- [ ]` in its `## Tasks` section are `- [x]`
- [ ] `specs/$ARGUMENTS/decisions.md` has no unresolved `SPEC-GAP-HIGH` entry
- [ ] `specs/$ARGUMENTS/.simplified` is absent OR is stale (its `git-head` field ≠ `git rev-parse HEAD`) — a stale sentinel is deleted and treated as absent
- [ ] `sdd base-branch $ARGUMENTS` exits 0 (base branch is resolvable) AND `git merge-base "$(sdd base-branch $ARGUMENTS)" HEAD` resolves to a valid commit SHA

**Stale sentinel handling**: if `.simplified` exists, read its `git-head` line. If it equals the current `git rev-parse HEAD`, the sentinel is fresh — abort pre-flight with `Status: blocked` (`Summary: already simplified at this HEAD`). If it differs, the sentinel is stale (e.g., user amended HEAD, rebased, or spoofed the file) — `rm specs/$ARGUMENTS/.simplified` and proceed.

If any other check fails, stop and tell the user what's needed (typically `/implement-task` or resolving a `SPEC-GAP-HIGH`).

## Steps

### 1. Recover prior context

Call `mem_search` with query `sdd/$ARGUMENTS` + domain keywords, `project: "{project}"`. If Engram is unavailable, skip.

### 2. Baseline validation

Run **Lint**, **Type check**, and **Tests** as parallel Bash calls (three independent calls in one message). Record the outcome.

- **All pass** → proceed to step 3.
- **Any fail** → STOP. Return `Status: blocked` with `Summary: baseline is red — fix regressions before running /simplify-code`. Do NOT make any edits.

This guarantees that any post-edit failure later is attributable to simplify-code, not a pre-existing regression.

### 3. Determine scope

1. Resolve branch base: Run `BASE_BRANCH=$(sdd base-branch "$ARGUMENTS")`. If `sdd base-branch` exits non-zero, forward its stderr and return `Status: blocked` with diagnostic. Then run `git merge-base "$BASE_BRANCH" HEAD`; if this fails → `Status: blocked` with diagnostic. `sdd base-branch` is the canonical scope source — do not hardcode `main` or any other branch name.
2. Compute touched files as the committed diff only: `git diff --name-only <base-sha>..HEAD`. This is the strict scope — working-tree changes outside this diff are not eligible for simplification. If the result is empty, there is nothing to simplify — skip to step 5.
2b. Compute `IGNORED_DIRTY`: from `git status --short`, collect paths from `M `, ` M`, `MM`, `A `, `??` entries (ignore `D`, `R`) that are **not** already in the committed diff list. Apply the same exclusion filters as `SCOPED_FILES` (tests, lockfiles, migrations, configs, SDD artifacts). If `IGNORED_DIRTY` is non-empty, print:
   ```
   Ignored uncommitted paths outside <base>..HEAD: <list>
   ```
   This is a notice only — the run continues normally. No block is raised.
3. Apply exclusion filters — drop any file matching:
   - **Tests**: `**/*.test.*`, `**/*.spec.*`, `**/__tests__/**`, `**/test/**`, `**/tests/**`
   - **Lockfiles**: `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `poetry.lock`, `Cargo.lock`
   - **Migrations**: `**/migrations/**`, `**/db/migrate/**`
   - **Configs**: `*.config.*`, `.env*`, `docker-compose.*`, `tsconfig.json`, `vite.config.*`
   - **SDD artifacts**: `specs/**/*.md`, `.claude/skills/**/*.md`, `.claude/CLAUDE.md`, `.specify/templates/*.md` — spec, plan, tasks, quick-spec, SKILL.md, templates, and orchestrator docs are prose artifacts, not code. KISS/DRY/YAGNI applied to these is out of scope and can corrupt load-bearing structure (e.g., `## Tasks` checkboxes).
4. Record the remaining list as `SCOPED_FILES` — this is the revert target list.
5. **If `SCOPED_FILES` is empty** → write the sentinel (step 6) with `Summary: no changes needed` and return `Status: success`. Skip steps 4 and 5.

### 4. Simplify

For each file in `SCOPED_FILES`:

1. Read the file.
2. Apply the simplification checklist:
   - **KISS** — collapse unnecessary nesting, remove speculative indirection, prefer explicit over clever.
   - **DRY on knowledge** (not incidental similarity) — if two blocks express the same domain rule, extract. If they just look similar, leave alone.
   - **YAGNI** — remove unused params, dead branches, speculative abstractions, unreferenced-internal helpers.
   - **Clarity** — rename confusing locals. Add a short comment only if a non-obvious invariant lives there.
3. Write the minimal diff. The NEVER list below is non-negotiable.

#### NEVER list (hard stops)

- Never change public function signatures, method names, or exported symbols.
- Never remove exports (even if locally unused — callers may live outside the diff).
- Never touch test files (scope already excludes them).
- Never change dependency versions (`package.json`, lockfiles, etc.).
- Never merge concerns across files or move files between folders.
- Never rewrite algorithms — only rearrange or remove.
- **Never delete files** and never create new files. Only **modify in place**. A simplification that would remove an entire file is out of scope — surface it in the decisions.md entry as "candidate for manual removal" instead.

### 5. Post-validation

Re-run **Lint**, **Type check**, and **Tests** as parallel Bash calls.

- **All pass** → proceed to step 6.
- **Any fail** → revert and block:
  1. **Pre-revert integrity check**: run `git status --porcelain -- <SCOPED_FILES>`. Expect only `M` (modified) entries. If any entry shows `D` (deleted), `A` (added), `R` (renamed), or `??` (untracked), that is a skill-internal bug (NEVER list violation) — do NOT attempt `git checkout --`. Return `Status: blocked` with `Summary: simplify-code produced a non-modification diff; aborted before revert` and list the offending paths.
  2. Run `git checkout -- <file1> <file2> ...` with the explicit `SCOPED_FILES` list (no wildcards).
  3. Verify revert: `git diff HEAD -- <file1> <file2> ...` must come back empty for every file.
  4. Do NOT create `.simplified`.
  5. Return `Status: blocked` with `Summary: simplify-code reverted — post-validation failed` and the validation error output in `Validations-Output`.

### 6. Write sentinel and decisions.md entry

1. **TOCTOU guard**: re-check that `specs/$ARGUMENTS/.simplified` does NOT exist. If it now exists (a concurrent `/simplify-code` completed while this run was editing), abort without overwriting: return `Status: blocked` with `Summary: sentinel written concurrently — another /simplify-code run finished first`.
2. Capture current HEAD: `git rev-parse HEAD`.
3. Write `specs/$ARGUMENTS/.simplified` with contents:

   ```
   git-head: <git-rev-parse-HEAD>
   simplified: <ISO-8601 timestamp>
   files:
   - <file1>
   - <file2>
   ```

4. Append to `specs/$ARGUMENTS/decisions.md`:

   ```
   ## Simplify: <date> — /simplify-code
   - **Files simplified**: <list>
   - **Changes**: <brief per-file summary>
   - **Baseline**: pass | **Post-edit**: pass
   ```

### 7. Engram memory

Save **only if** a non-obvious simplification pattern surfaced (e.g., a recurring dead-code shape worth flagging for future features). `mem_save` type: `pattern` or `discovery`, topic_key: `sdd/$ARGUMENTS/simplify-code`. Routine simplifications need no save.

## Result envelope

```
## Result
- **Status**: success | blocked
- **Summary**: [1-3 sentences — what was simplified, or why it blocked]
- **Artifacts**: [modified files + specs/$ARGUMENTS/.simplified + specs/$ARGUMENTS/decisions.md]
- **Validations**: Baseline: PASS | Post-edit: PASS/FAIL/SKIP
- **Validations-Output**: [short summary on success; last 100 lines of terminal output on failure]
- **Files-Simplified**: [list or `none` for empty diff]
- **Revert-Applied**: [true/false]
- **Next**: /review-feature $ARGUMENTS
- **Risks**: [anything the reviewer should double-check, or "None"]
```

## Rules

- **NEVER use Plan Mode** — write edits directly. Plan Mode breaks the SDD pipeline.
- **Baseline validation is mandatory** — never skip it. It's the only way to distinguish "simplify broke it" from "it was already broken".
- **Behavior preservation is the hard constraint** — the NEVER list above is non-negotiable.
- **Revert is file-scoped, not branch-scoped** — only touch files in `SCOPED_FILES`.
- **Empty diff is a success** — do not invent work. Write the sentinel and move on.
- Always output the result envelope at the end.
