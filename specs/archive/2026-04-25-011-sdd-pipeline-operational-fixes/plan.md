# Technical Plan — 011-sdd-pipeline-operational-fixes

## Inputs
- Spec: `specs/011-sdd-pipeline-operational-fixes/spec.md`
- Decisions: `decisions.md` (D1–D12, locked)
- Research: none

## Domain analysis

| Gap | File                                       | Surface                  | Complexity |
|-----|--------------------------------------------|--------------------------|------------|
| 1   | `.claude/agents/sdd-simplify-code.md`      | Step 3 scope             | SMALL      |
| 2   | `.claude/CLAUDE.md`                        | New section              | SMALL      |
| 3   | `.claude/agents/sdd-archive-feature.md`    | Step 3 archive move      | SMALL      |
| 3   | `.claude/CLAUDE.md`                        | Doc note                 | SMALL      |
| 4   | `bin/sdd` (lines 388–400)                  | Replace add-only loop    | MEDIUM     |
| 4   | `.claude/CLAUDE.md`                        | Customization warning    | SMALL      |
| 5   | `bin/sdd` (lines 306–321)                  | Drop outer gate, dedent  | SMALL      |

Strategy = **MEDIUM**, sequential per gap, single domain, 4 files. CLAUDE.md edits batched into one pass for diff coherence.

## Current state

- `sdd-simplify-code.md:42-58` (Step 3) computes scope as union of `git diff --name-only <base>..HEAD` and parsed `git status --short`. In 008 dogfood unrelated dirty files leaked into the simplify diff.
- `sdd-archive-feature.md:39-42` does `mv specs/$ARGUMENTS specs/archive/YYYY-MM-DD-$ARGUMENTS`; `.simplified` rides along undocumented.
- `.claude/CLAUDE.md`: `grep -i archive` returns only the table-row mention; archive folder format is not specified.
- `bin/sdd:388-400` (`cmd_update` agents): copies only when destination absent (`[ ! -e ]`); existing files silently skipped → stale agents.
- `bin/sdd:307` gates the entire `for skill in $CORE_SKILLS` loop behind `[ -d ~/.claude/skills/sdd-next ] || [ -L ... ]`. If `sdd-next` is absent globally, the inner `else` "add" branch is unreachable. `CORE_SKILLS` defined at `bin/sdd:11`.

## Proposed design

| Gap | Change |
|-----|--------|
| 1 | Replace Step 3.2 union with `git diff --name-only <base>..HEAD` only. Compute `IGNORED_DIRTY` = `git status --short` paths NOT in diff (after exclusion filter). Print `Ignored uncommitted paths outside <base>..HEAD: …` (skip when empty). No per-file warning (D4); no block on dirty (D3). |
| 2 | Add new top-level `## Archive folder format` section in CLAUDE.md, between `## Workflow` and `## Result envelope`: path `specs/archive/YYYY-MM-DD-<feature-id>/`, date `%Y-%m-%d` archive-day local, `<feature-id>` = original `NNN-kebab`. |
| 3 | `sdd-archive-feature.md` Step 3: after `mv`, `rm -f specs/archive/YYYY-MM-DD-$ARGUMENTS/.simplified` (covers EC3.1). Bullet in the new CLAUDE.md section: "Archive deletes `.simplified` (sentinel ends at simplify→review handoff)." |
| 4 | Refactor `bin/sdd:388-400`: replace `[ ! -e ]` with 3-branch logic — absent → cp + `Added`; `cmp -s` returns 0 → no-op; byte-diff → cp + `Updated: <agent>`. Counters `added/updated/unchanged`; summary line after loop. **Scope `cmd_update` only — `cmd_init:224+` untouched per D8.** Add prominent CLAUDE.md note in `## Conventions`: customizations belong in `.claude/rules/`, NOT in `.claude/agents/sdd-*.md`. |
| 5 | Drop `if [ -d ... ] || [ -L ... ]; then` at line 307 and matching `fi` at line 321. Dedent `for skill in $CORE_SKILLS` loop one level. Inner if/elif/else (refresh / warn / add) unchanged. |

## Touched areas
- **Files**: `.claude/agents/sdd-simplify-code.md`, `.claude/agents/sdd-archive-feature.md`, `.claude/CLAUDE.md`, `bin/sdd` (`cmd_update` only)
- APIs/contracts/DB/jobs/UI: none

## Data flow

`/simplify-code`: git refs → `SCOPED_FILES` (diff only) + `IGNORED_DIRTY` notice → KISS/DRY/YAGNI → `.simplified`.

`/archive-feature`: merge deltas → `mv` folder → `rm -f .simplified` in archive → engram save.

`bin/sdd update`: enumerate `$SDD_HOME/.claude/agents/sdd-*.md` → cmp → add/update/unchanged + summary. Core-skills loop iterates unconditionally over `$CORE_SKILLS`.

## Migration / rollout
- Backfill: none.
- Compatibility: Gap 4 flips default from "never overwrite" → "always overwrite" (mitigation: doc per AC4/D7). Gap 5 makes a previously-unreachable path reachable; strictly additive.
- Feature flags: none (D7: no `--force`).
- Rollback: `git revert <sha>` — text-only, 4 files.

## Observability
- Logs: `Updated: <agent>` + summary `<N> added, <M> updated, <K> unchanged`; `Ignored uncommitted paths…` notice.
- Metrics/alerts: none.

## Test strategy
- Unit/integration: none (D10 — no shell test framework).
- **Manual** (mapped to AC/SC):
  - **AC1/SC1**: dirty an unrelated file, run `/simplify-code`; assert dirty file not in post-edit diff and notice listed it.
  - **AC2/SC2**: `grep -c 'archive' .claude/CLAUDE.md` delta ≥ 2.
  - **AC3/EC3.1**: fake `.simplified` → archive → assert absent in destination; rerun without sentinel → no error.
  - **AC4/SC3**: byte-modify a local agent → `bin/sdd update` → expect `Updated:` + `M updated ≥ 1`. Rerun → `0 updated`.
  - **AC5/SC4**: `rm -rf ~/.claude/skills/sdd-next` → `bin/sdd update` → expect `Added global: sdd-next`.

## Risks and mitigations
- **R1 — Gap 4 default flip destroys local agent edits**. Mitigation: CLAUDE.md note placed in `## Conventions` (top-level, near `.claude/rules/` mention) with bold; not buried.
- **R2 — `cmp -s` portability**. POSIX-required; `bin/sdd` is bash-only (`set -euo pipefail`); confirmed on macOS + Linux. Per D6.
- **R3 — Notice-only dirty handling silently includes in-scope dirty edits**. Intentional per D4; surfaced in spec EC.
- **R4 — Diff-only scope misses uncommitted feature work**. Per `git.md` agents never commit; `/implement-task` commits at handoff so diff is complete. If user runs simplify manually with uncommitted work, the notice surfaces it.
