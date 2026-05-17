# Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | Bundle 5 gaps into one spec (vs. fast-laning gaps 2 & 3 as docs-only) | Single coherent theme = "post-008 operational hygiene"; simpler tracking and review. |
| D2 | Gap 1 — strict scope `git diff --name-only <base>..HEAD` (drop `git status --short` union) | Eliminates the 008-observed working-tree leak. |
| D3 | Gap 1 — dirty working tree → **warning + continue** (NOT `Status: blocked`) | Ergonomic; the strict scope already prevents leak so blocking is overkill. |
| D4 | Gap 1 — silently ignore dirty edits to in-scope feature files (no per-file warning) | Keeps the warning surface minimal; user can re-stage if desired. |
| D5 | Gap 3 — explicit delete of `.simplified` at archive (option b, not preserve) | Sentinel's only purpose is the simplify→review handoff guard; no value post-archive. |
| D6 | Gap 4 — `cmp -s` byte-level diff for change detection | Simplest, zero false positives, POSIX-available. |
| D7 | Gap 4 — **always overwrite** local modifications (option a, no `--force` flag, no warn+skip) | Consistent with the "customize via `.claude/rules/` overrides" model already used for `model-overrides.md`. |
| D8 | Gap 4 scope limited to `cmd_update`; `cmd_init`'s agent-copy block stays untouched | Fresh-install behavior is correct; bug only matters on re-sync. |
| D9 | Gap 5 — refactor: drop the outer `if [ -d ... ]` gate at `bin/sdd:307`, dedent the loop | Inner branches already handle all 3 states; outer gate makes the "add missing" path unreachable. |
| D10 | Out of scope: shell tests (`bats`/`shunit`), CHANGELOG, release process | Project has none today; manual verification is the norm for `bin/sdd`. |
| D11 | CLAUDE.md edits go to `.claude/CLAUDE.md` directly (this repo IS `$SDD_HOME`, file is regular not symlink) | Downstream symlinks pick up changes automatically on `git pull`. |
| D12 | EC4.2 (upstream-removed agents NOT deleted) and EC1.3 (unresolvable base SHA → blocked) stay as implementation safety nets, not first-class ACs | Keeps AC list lean (5 ACs, one per gap); safety nets belong in plan/tasks. |

## Baseline (T1)

`grep -c 'archive' .claude/CLAUDE.md` = **8** (captured on 2026-04-24, before any T3/T4 edits).

SC2 requires this count to increase by ≥ 2 after T3/T4 land (post-edit target: ≥ 10).

## Delta: 2026-04-24 — Tasks T2, T4, T6 (T13 review)

- **MODIFIED**: T2 — Plan spec referenced sub-step numbering `3.2` and `3.2b` (within the outer Step 3 of sdd-simplify-code.md). Implementation used `2` and `2b` (the two are adjacent items in a numbered list under Step 3, so the flat `2` / `2b` label is semantically equivalent). No behavioral change.
- **MODIFIED**: T4 — Plan said place the customization warning "near the `.claude/rules/` line" inside `## Conventions`. Implementation placed it as a `> **Customization**: ...` blockquote immediately before `## Workflow`, one section above `## Conventions`. Rationale: the `## Conventions` body was empty (only a header); placing a blockquote there would have been orphaned. The chosen position is prominent and within the same scroll zone.
- **MODIFIED**: T6 — Plan described `((added++))` / `((updated++))` / `((unchanged++))` increment idiom. Implementation uses `: $((added++))` (with leading colon). Rationale: in `set -e` shells, `((0++))` evaluates to 0 (falsy) and triggers `ERR` — the `: $((var++))` idiom discards the exit code, making it safe under `set -euo pipefail`. No behavioral difference.

## Deferred manual verifications (T8, T10, T11, T12)

The following validation tasks were deferred from agent execution to manual user verification post-merge. Running them from an agent context is unsafe (live feature state corruption or global `~/.claude/` mutation).

| Task | Manual command / steps |
|------|------------------------|
| T8 (AC1/SC1) | Dirty an out-of-scope file; run `/simplify-code` on any feature with `[x]` tasks; assert dirty file NOT in post-edit diff; assert `Ignored uncommitted paths outside <base>..HEAD:` notice printed. |
| T10 (AC3/EC3.1) | `touch specs/<any-feature>/.simplified && /archive-feature <feature-id>` → assert `.simplified` absent in `specs/archive/…/`; rerun without sentinel → no error. |
| T11 (AC4/SC3) | In a downstream symlinked project: append one byte to `.claude/agents/sdd-next.md`; run `bin/sdd update`; expect `Updated: sdd-next.md` + summary `1 updated`. Rerun → `0 updated`. |
| T12 (AC5/SC4) | `cp -r ~/.claude/skills/sdd-next /tmp/sdd-next-bak && rm -rf ~/.claude/skills/sdd-next && bin/sdd update` → expect `Added global: sdd-next`; restore: `mv /tmp/sdd-next-bak ~/.claude/skills/sdd-next`. |

## SPEC-GAP — 011-sdd-pipeline-operational-fixes — adversarial review

| # | Severity | Category | Description | Suggested Action |
|---|----------|----------|-------------|------------------|
| 1 | medium | undocumented-assumption | `git merge-base main HEAD` is used as the simplify scope base, but feature branches can branch off non-main branches (e.g., 011 off 008). In those cases the diff includes commits on both feature branches, not just the target feature's commits. Spec covers "unresolvable base" (EC1.3) but not "wrong base". | Document this limitation in sdd-simplify-code.md, or add an option to pass a custom base SHA. |
| 2 | low | incomplete-AC | AC4 log format "N added, M updated, K unchanged" is an informal template. Implementation adds "Agents:" prefix (`Agents: $added added, …`). Future tooling parsing this output could break if it expects the exact format. | Specify the log format as informational/human-readable only, or define it exactly in the spec. |
| 3 | low | undocumented-assumption | `.simplified` sentinel deletion uses `rm -f` which silently fails if `.simplified` is a directory (non-standard state). EC3.1 covers "absent" but not "is a directory". | Add `[ -f ... ] && rm ... || true` to be explicit, or document that sentinel is always a regular file. |
| 4 | low | uncovered-scenario | Agent files in `.claude/agents/` are NOT excluded from the sdd-simplify-code.md scope filter (unlike `.claude/skills/**/*.md`). A feature that touches agent files will have those agents in SCOPED_FILES for KISS/DRY/YAGNI. Unintended structural changes to agent prose (numbered steps, checkboxes) are possible. Feature 011 ran correctly, but the policy is unstated. | Either add `.claude/agents/**/*.md` to the SDD-artifacts exclusion in sdd-simplify-code.md, or explicitly document that agent files are in-scope for simplify. |

Source: adversarial review agent, review-feature phase
Date: 2026-04-24

## Simplify: 2026-04-25 — /simplify-code

- **Files simplified**: `.claude/agents/sdd-simplify-code.md`
- **Files unchanged** (no KISS/DRY/YAGNI opportunities): `.claude/agents/sdd-archive-feature.md`, `bin/sdd`
- **Excluded by filter**: `.claude/CLAUDE.md` (explicitly listed in SDD-artifacts exclusion in the skill)
- **Changes**: `sdd-simplify-code.md` — fixed dangling cross-reference "skip to step 3.5" → "skip to step 5" (the numbered step within section 3); T2 left this stale reference after dropping the union logic and renumbering.
- **IGNORED_DIRTY**: empty — working tree is clean outside the 3 scoped files.
- **Baseline**: pass | **Post-edit**: pass

## Deltas merged

**Timestamp**: 2026-04-25T18:35:00Z

Delta review complete. All three MODIFIED deltas (T2, T4, T6) are implementation notes (step numbering, blockquote placement, shell idiom for `set -e` safety). No changes to spec requirements or acceptance criteria. Spec.md archived as-is. Deltas preserved in this section for historical reference.
