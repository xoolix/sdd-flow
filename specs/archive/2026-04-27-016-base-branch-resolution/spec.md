# Feature: Base Branch Resolution

## Summary

SDD agents hardcode `git merge-base main HEAD` to compute diff scope (notably `sdd-simplify-code`). This breaks Git Flow projects (`develop`), multi-stage projects, and feature-on-feature workflows. Replace with a 3-layer resolver — per-feature override (sidecar) → project config → auto-detect — exposed as `sdd base-branch` and consumed by agents. Most-specific layer wins. Unblocks team adoption (013–015) and fixes the SPEC-GAP medium from feature 011's adversarial review.

## Trigger

1. **Agent invocation** — `sdd-simplify-code.md` calls `sdd base-branch <feature-id>` every phase run.
2. **Direct CLI** — devs run `sdd base-branch [feature-id]` to inspect the pick. No arg → skip Layer 1.

Spec-authoring auto-population is deferred (YAGNI).

## Happy Path

**Layer 2 hit (project config, Git Flow):**

1. `sdd-simplify-code` invoked for feature 014.
2. Agent shells out: `sdd base-branch 014-foo`.
3. Layer 1 — read `specs/014-foo/.parent-branch`. Absent → continue.
4. Layer 2 — read `.claude/rules/git.md` for `base-branch:`. Found `develop`, verified via `git rev-parse --verify`.
5. Print `develop`, exit 0. Agent computes scope, simplify proceeds.

**Layer 3 fallthrough (auto-detect):** Same 1–3. Layer 2 absent. For each candidate in order `develop, main, master`: if `git rev-parse --verify` succeeds, compute `git rev-list --count <c>..HEAD`. Smallest count wins; tie → first in order. Print winner, exit 0.

## Domains

- [x] **Infrastructure** — `bin/sdd` ships via `sdd update` (already byte-copy)
- [x] **SDD agents** — `.claude/agents/sdd-simplify-code.md` only
- [x] **SDD CLI** — `bin/sdd` gains `cmd_base_branch`
- [x] **SDD config** — `.claude/rules/git.md` gains "Base branch resolution" section + `base-branch:` field
- [x] **Per-feature override** — sidecar `specs/<id>/.parent-branch` (gitignored, one line)

Out of scope (verified): `sdd-review-feature.md`, `_shared/sdd-phase-common.md`, spec-creation agents, spec templates, `bin/sdd update`.

## Edge Cases

- **No candidate locally** — none of `develop`/`main`/`master` resolve; no override, no config. Exit non-zero, stderr instructs user to set `base-branch:` or create `.parent-branch`.
- **Override → missing branch** — `.parent-branch` references a missing ref. Exit non-zero, stderr cites `.parent-branch` and the ref. **No fallback** (intent was explicit).
- **Config → missing branch** — `base-branch: develop` declared but absent. Same: exit non-zero, no fallback.
- **Empty/whitespace sidecar** — treated as absent; falls through to Layer 2.

Other cases (HEAD on integration branch, detached HEAD, multi-line sidecar, criss-cross merge-base, no-arg CLI, worktrees) need no special handling — folded into planning notes. Shallow clones are out of scope but documented as a known limitation in `git.md`.

## Acceptance Criteria

- [ ] **AC1 — Layer 1 wins**: Given `specs/014-foo/.parent-branch` contains `feature/011-bar` (existing locally), When `sdd base-branch 014-foo` runs, Then stdout is exactly `feature/011-bar`, exit 0, and `.claude/rules/git.md` is not consulted.
- [ ] **AC2 — Layer 2 wins**: Given `.claude/rules/git.md` has `base-branch: develop` (existing) and no sidecar, When the command runs, Then stdout is `develop`, exit 0, auto-detect is not run.
- [ ] **AC3 — Layer 3 smallest count**: Given no override and no config, with `develop` count = 3 vs `main` count = 47, When the command runs, Then stdout is `develop`, exit 0.
- [ ] **AC4 — Tiebreaker**: Given Layer 3 candidates produce equal counts, When evaluated in order `develop, main, master`, Then `develop` wins, exit 0.
- [ ] **AC5 — Override missing branch errors**: Given `.parent-branch` contains `feature/099-gone` not present locally, When the resolver runs, Then exit non-zero, stderr contains `.parent-branch` and `feature/099-gone`, and Layers 2/3 are not attempted.
- [ ] **AC6 — No candidate locally**: Given no override, no config, and none of `develop`/`main`/`master` exist, When the resolver runs, Then exit non-zero, stderr instructs to set `base-branch:` or create `.parent-branch`.
- [ ] **AC7 — Empty sidecar falls through**: Given `.parent-branch` is whitespace-only and config has `base-branch: main` (existing), When the resolver runs, Then stdout is `main`, exit 0.
- [ ] **AC8 — Agent uses resolver**: Given `sdd-simplify-code` is invoked for feature 014 and the resolver returns `develop`, When the agent computes diff scope, Then `SCOPED_FILES` and `IGNORED_DIRTY` are derived from `git diff --name-only $(git merge-base develop HEAD)..HEAD` — observably matching the resolver's pick, not the legacy `main`.
- [ ] **AC9 — Standalone CLI skips Layer 1**: Given no arguments and config has `base-branch: develop` (existing), When `sdd base-branch` runs, Then stdout is `develop`, exit 0, no filesystem access under `specs/`.

## Rollback Plan

1. **Primary** — revert feature commits; `sdd update` pulls reverted versions. Behavior returns to hardcoded `merge-base main HEAD`.
2. **Hot-patch** — single-line in-place edit of `sdd-simplify-code.md` restoring legacy line.
3. **Per-user opt-out** — set `base-branch: main` in `.claude/rules/git.md` to force legacy project-wide. Documented.
4. **Data safety** — no migrations, no persisted state. `.parent-branch` files are gitignored and disposable.

## Success Criteria

- **SC1** — Re-running `/simplify-code` on feature 012 (original repro) produces a 1-file scope (`bin/sdd`), not the 39-file regression. Verifiable before archive.
- **SC2** — All 9 ACs pass in manual/CI verification before merge to `main`.
- **SC3** — Feature 013 runs `/simplify-code` end-to-end with no manual scope override; resolver picks the correct integration branch (in this repo: `main`). Verifiable from feature 013's simplify log.

## Open Questions

- None blocking. Auto-populating the override during spec authoring is deferred (YAGNI); revisit if feature-on-feature becomes frequent.
