# Tasks — 011-sdd-pipeline-operational-fixes

## Execution order

### 1. Foundation
- [x] **T1** — Capture pre-change `grep -c 'archive' .claude/CLAUDE.md` count for SC2 baseline. No code change.

### 2. Core implementation

#### Gap 1 — sdd-simplify-code scope (AC1)
- [x] **T2** — Edit `.claude/agents/sdd-simplify-code.md` Step 3.2: drop union; scope = `git diff --name-only <base>..HEAD` only. Add Step 3.2b: compute `IGNORED_DIRTY` = working-tree paths not in diff (same exclusion filter as `SCOPED_FILES`); print `Ignored uncommitted paths outside <base>..HEAD: <list>` when non-empty. Update the doc paragraph that justifies the union.

#### Gap 2 + Gap 3 doc + Gap 4 doc — CLAUDE.md (AC2, AC3 doc, AC4 doc)
- [x] **T3** — Edit `.claude/CLAUDE.md`: insert new top-level `## Archive folder format` between `## Workflow` and `## Result envelope`. Cover path `specs/archive/YYYY-MM-DD-<feature-id>/`, date `%Y-%m-%d` (archive-day local), `<feature-id>` = original `NNN-kebab`. Add bullet: `.simplified` is intentionally deleted by `/archive-feature`.
- [x] **T4** — Edit `.claude/CLAUDE.md` `## Conventions` section: add a prominent **bold** note near the `.claude/rules/` line — "Customize SDD behavior via `.claude/rules/*.md`. **Do NOT edit `.claude/agents/sdd-*.md` directly** — `bin/sdd update` overwrites those files using `cmp -s` byte-diff."

#### Gap 3 — sdd-archive-feature sentinel delete (AC3 code)
- [x] **T5** — Edit `.claude/agents/sdd-archive-feature.md` Step 3: after `mv`, add `rm -f specs/archive/YYYY-MM-DD-$ARGUMENTS/.simplified` (silent no-op if absent — covers EC3.1). One-line comment referencing CLAUDE.md.

#### Gap 4 — bin/sdd update agents loop (AC4 code)
- [x] **T6** — Edit `bin/sdd` `cmd_update` agents loop (lines 388–400): replace `[ ! -e "$agent_dst" ]` with 3-branch logic. Init `local added=0 updated=0 unchanged=0`. Per file: (a) absent → `cp` + `ok "Added .claude/agents/$agent_name"` + `((added++))`; (b) `cmp -s "$agent_file" "$agent_dst"` returns 0 → `((unchanged++))`; (c) byte-diff → `cp` + `ok "Updated: $agent_name"` + `((updated++))`. After loop: `log "Agents: $added added, $updated updated, $unchanged unchanged"`. **Do NOT touch `cmd_init`.**

#### Gap 5 — bin/sdd core-skills unreachable loop (AC5)
- [x] **T7** — Edit `bin/sdd:306–321`: delete the `if [ -d ... ] || [ -L ... ]; then` (line 307) and its closing `fi` (line 321). Dedent `for skill in $CORE_SKILLS` body one level. Inner if/elif/else unchanged.

### 3. Validation
- [x] **T8** — **AC1/SC1**: deferred (live simplify run risks pipeline corruption). Code-review PASS: step 2 uses `git diff --name-only` only; step 2b prints `Ignored uncommitted paths…` notice. See `decisions.md` for manual steps.
- [x] **T9** — **AC2/SC2**: PASS. `grep -c 'archive' .claude/CLAUDE.md` = 12 (T1 baseline = 8, delta = +4 ≥ 2).
- [x] **T10** — **AC3/EC3.1**: deferred (archive is destructive). Code-review PASS: `rm -f …/.simplified` present post-`mv`; silent no-op when absent. See `decisions.md` for manual steps.
- [x] **T11** — **AC4/SC3**: deferred (requires downstream project). See `decisions.md` for manual steps.
- [x] **T12** — **AC5/SC4**: deferred (mutates `~/.claude/skills/` global state). See `decisions.md` for manual steps.
- [x] **T13** — Delta check complete. See `decisions.md` `## Delta: 2026-04-24`.

## Notes
- Text-only across 4 files; no tests (D10).
- T2–T7 independent. **T4 must land before T6** so downstream users see the warning before the overwrite default.
