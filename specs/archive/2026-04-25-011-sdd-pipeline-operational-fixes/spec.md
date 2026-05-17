# Feature: SDD Pipeline Operational Fixes

## Summary
Patch 5 SDD-internal gaps from the 008 dogfood: tighten `sdd-simplify-code` scope, document archive naming, define `.simplified` disposition at archive (delete), make `bin/sdd update` upgrade existing agents, and unblock the unreachable core-skills loop in `cmd_update`. Tooling/docs only.

## Trigger
| Gap | Invocation | Detection today |
|---|---|---|
| 1 | `/sdd-next` → `/simplify-code` | Unrelated files leak into simplify diff |
| 2 | `/archive-feature` runs | Grep CLAUDE.md for "archive" → nothing |
| 3 | `/archive-feature` runs | Sentinel disposition undocumented |
| 4 | Manual `bin/sdd update` only | Stale agents stay stale after `update` |
| 5 | Manual `bin/sdd update` only | Partial global install can't self-heal |

## Happy Path
1. CLAUDE.md has explicit sections on archive folder naming and `.simplified` disposition.
2. `/sdd-next` → `/simplify-code`: agent computes scope as `git diff --name-only <base>..HEAD` only (no working-tree union), filters tests/lockfiles/migrations/configs, prints a notice listing ignored dirty paths, runs baseline lint+types+tests, applies KISS/DRY/YAGNI, post-validates, writes `.simplified`.
3. `/sdd-next` → `/review-feature` → `/archive-feature`: archive moves artifacts to `specs/archive/YYYY-MM-DD-<feature-id>/` and explicitly deletes `specs/<id>/.simplified` (silent no-op if absent).
4. Downstream user runs `bin/sdd update`: enumerates upstream `sdd-*.md`, uses `cmp -s` to detect byte-different files, overwrites them, logs `Updated: <agent>`, prints summary `N added, M updated, K unchanged`. Core-skills loop runs unconditionally and adds missing global skills via the inner-else branch.

## Domains
- [x] Other: SDD-internal — `.claude/agents/sdd-simplify-code.md`, `.claude/agents/sdd-archive-feature.md`, `.claude/CLAUDE.md`, `bin/sdd` (`cmd_update` only).

## Edge Cases
- **EC1.2** — Zero in-scope files after filter: `Status: success` with `no-op` summary.
- **EC1.3** — Base SHA unresolvable: `Status: blocked` with diagnostic; no fallback.
- **EC3.1** — `.simplified` absent at archive: silent no-op.
- **EC4.1** — Locally-modified agent: overwritten without prompt; CLAUDE.md directs customizations to `.claude/rules/`.
- **EC4.2** — Upstream agent renamed/removed: `cmd_update` does NOT delete project-local orphans.

## Acceptance Criteria
- [ ] **AC1** — Given all tasks `[x]`, no fresh `.simplified`, and uncommitted changes to files NOT in `git diff --name-only <base>..HEAD`, When `sdd-simplify-code` runs, Then it operates only on files from that diff (after the existing filter), prints a notice listing ignored dirty paths, and unrelated files are not touched.
- [ ] **AC2** — Given a developer reading `.claude/CLAUDE.md`, When they search "archive", Then they find an explicit statement that `/archive-feature` writes to `specs/archive/YYYY-MM-DD-<feature-id>/`, including date format (`%Y-%m-%d`, archive-day local) and `<feature-id>` source (original `NNN-kebab-name`).
- [ ] **AC3** — Given `specs/<id>/.simplified` present, When `sdd-archive-feature` completes, Then `.simplified` does NOT appear in `specs/archive/YYYY-MM-DD-<id>/`, AND CLAUDE.md documents this deletion as intentional. If absent, archive completes without error.
- [ ] **AC4** — Given `.claude/agents/sdd-<name>.md` byte-differs from `$SDD_HOME/.claude/agents/sdd-<name>.md`, When `bin/sdd update` runs, Then the file is overwritten (`cmp -s` returns 0 post-copy), `Updated: sdd-<name>` is logged, the summary reports `N added, M updated, K unchanged`, AND CLAUDE.md documents that customizations belong in `.claude/rules/`.
- [ ] **AC5** — Given `~/.claude/skills/sdd-next` absent, When `bin/sdd update` runs, Then the core-skills loop iterates over every `$CORE_SKILLS` entry (no outer gate skips it), missing skills are added and logged `Added global: <skill>`, existing symlinks refreshed, existing dirs warned-and-skipped.

## Rollback Plan
- `git revert <commit-sha>` — text-only changes to 4 files; no DB, no external state, no flags.
- **Downstream risk** (Gap 4): default flips from "never overwrite" to "always overwrite". Mitigation is documentation-only (per AC4); no code-side guard.

## Success Criteria
- **SC1** — Next `/simplify-code` on a dirty working tree produces a diff with **0 files** outside `git diff --name-only <base>..HEAD`.
- **SC2** — `grep -c 'archive' .claude/CLAUDE.md` increases by ≥ 2; a developer can answer "where do archived features go and what is the folder format?" from CLAUDE.md alone.
- **SC3** — `bin/sdd update` with stale agents reports non-empty `M updated`; immediate second run reports `0 updated`.
- **SC4** — `bin/sdd update` with `~/.claude/skills/sdd-next` absent results in `Added global: sdd-next`.

## Open Questions
- None. All trade-offs resolved during intake (see `decisions.md`).
