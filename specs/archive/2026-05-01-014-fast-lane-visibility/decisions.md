# Decisions

## Delta: 2026-04-30 — Tasks T07, T08, T09
- **ADDED**: Same `description:` rewrites applied to the three corresponding SKILL.md router files (`.claude/skills/new-feature/SKILL.md`, `.claude/skills/new-quick-feature/SKILL.md`, `.claude/skills/new-fix/SKILL.md`) in addition to the agent files. The spec only mentioned agent files; the SKILL.md files also surface descriptions when users type `/<skill>` in Claude Code, so parity is required for AC-5 ("skill descriptions encode the rule"). Both files now carry identical wording.

## D-001 — Symlink state of CLAUDE.md

`readlink .claude/CLAUDE.md` returned exit code 1 with no output, confirming
`.claude/CLAUDE.md` is a regular file (not a symlink). All T03-T06 edits were
applied directly to `/Users/santi/Proyectos/rossi/repos/test-sdd/.claude/CLAUDE.md`.

## D-002 — Scope expansion: SKILL.md frontmatter parity (T07-T09)

Original task scope (T07-T09) named only `.claude/agents/sdd-new-*.md`. Expanded
to also update `.claude/skills/new-*/SKILL.md` frontmatter `description:` fields
because Claude Code surfaces SKILL descriptions when users type `/<skill>`. Parity
required for AC-5. Both agent and SKILL files now carry identical descriptions.

## D-003 — AC sign-off (T11)

All 5 acceptance criteria verified PASS:

| AC | Evidence |
|---|---|
| AC-1 (blockquote + reorder) | `.claude/CLAUDE.md` L198-206 "Choosing a lane" blockquote before `## Skill routing`; L212-213 fast-lane rows above `/new-feature` |
| AC-2 (tie-breaker) | L205: "when in doubt, start with `/new-quick-feature`; escalating mid-flow is cheap" |
| AC-3 (symlink check) | D-001 — confirmed regular file, edits applied to canonical path |
| AC-4 (consistency grep) | 9 fast-lane mentions in CLAUDE.md, all coherent in doc order, manual-only constraint preserved verbatim at L118 and L226 |
| AC-5 (descriptions encode rule) | 6 files (3 agents + 3 SKILLs), char counts 111-119, all open with "Fast-lane (...)" or close with "use only when fast-lane criteria don't fit" |

11/11 tasks complete. Ready for `/simplify-code`.

## Simplify: 2026-04-30 — /simplify-code
- **Files simplified**: none (empty committed diff — all changes are uncommitted working-tree files)
- **Changes**: No simplification applied. Committed diff between main and HEAD is empty; feature changes live only in the working tree as markdown/prose artifacts, all of which fall under the SDD exclusion list.
- **Baseline**: pass | **Post-edit**: skip (no files in scope)

## D-004 — SPEC-GAP-HIGH resolved (2026-05-01)

Adversarial review surfaced 1 high-severity finding (option A chosen — fix in source):

**SPEC-GAP-HIGH-RESOLVED — "escalating mid-flow is cheap" had no documented procedure**:
The original tie-breaker (L205-206) said *"escalating mid-flow is cheap"*, but there is no automated `/promote-to-full-spec` command, no documented conversion of `quick-spec.md` → `spec.md`+`plan.md`+`tasks.md`, and no guidance for the orphaned quick-spec. Users would find the claim literally false.

**Fix applied**: rewrote the tie-breaker (L205-208) to be explicit about the manual escalation path and acknowledge the lack of automation:

> **Tie-breaker**: when in doubt, start with `/new-quick-feature` (or `/new-fix` for bugs). If scope grows mid-flow, escalate by re-running `/new-feature` with the same intent and archiving the orphaned `quick-spec.md` manually — there is no automated promotion.

This also addresses adversarial finding L6 (`/new-fix` mentioned in tie-breaker for bugfix routing).

## SPEC-GAPS — Adversarial review (medium/low, ACCEPTED for follow-up)

3 medium + 3 low gaps recorded for future iteration. None block correctness:

**Medium**:
- **SPEC-GAP-2 (incomplete-AC)**: "≤2 GWT" acronym unexpanded at decision-rule surface. **Suggested**: expand to "≤2 Given/When/Then acceptance criteria" in the blockquote.
- **SPEC-GAP-3 (undocumented-assumption)**: SC-1 measurement not actionable — no owner, no validated script, no zero-feature-window outcome defined. The `git log` query may return no results given commits-in-bulk granularity. **Suggested**: define owner + measurement script + inconclusive outcome; consider archive-folder mtime as fallback.
- **SPEC-GAP-4 (undocumented-assumption)**: AC-3 symlink check is point-in-time only. No documented upstream contribution path if `bin/sdd update` ever clobbers. **Suggested**: define decision point post-`sdd update` re-runs; identify upstream contribution to SDD_HOME as durable fix.

**Low**:
- **SPEC-GAP-5 (incomplete-AC)**: AC-5 doesn't specify which surface (agent vs SKILL files). D-002 documented both, but AC wording allows single-file satisfaction. **Suggested**: amend AC-5 to require both.
- **SPEC-GAP-6 (edge-case)**: Original tie-breaker pointed only to `/new-quick-feature`, omitting `/new-fix` for bugfixes. **Resolved by D-004** (fix included `/new-fix` mention).
- **SPEC-GAP-7 (undocumented-assumption)**: Pre-merge baseline for SC-1 may be unmeasurable in practice (commits in bulk, not per-spec-file). **Suggested**: validate `git log` query against actual repo history before declaring computable.

**Decision**: Ship 014. SPEC-GAP-HIGH resolved in source. Medium/low recorded for future iteration as priorities allow.

## Deltas merged — 2026-05-01 (archive)

All deltas from implementation and review were applied to spec.md before archiving:

1. **D-002 (ADDED)**: SKILL.md parity expansion — scope section updated to explicitly include `.claude/skills/new-*/SKILL.md` files in addition to agent files. Both surfaces now documented as required for AC-5.
2. **D-004 (MODIFIED)**: Happy Path §2 tie-breaker rewritten to acknowledge manual escalation path: "If scope grows mid-flow, escalate by re-running `/new-feature`... there is no automated promotion." Also added mention of `/new-fix` for bugfixes.
3. **AC-5 clarification (MODIFIED)**: Acceptance criterion now explicitly requires both agent AND SKILL.md description fields to encode the lane choice.
4. **Review Findings section (ADDED)**: New section documents SPEC-GAP-HIGH-RESOLVED and lists 6 medium/low gaps (SPEC-GAP-2 through SPEC-GAP-7) for future iteration. Two gaps (5, 6) already resolved by D-002 and D-004.

Spec now reflects final implementation state. No further deltas pending.

---
## POST-ARCHIVE ADDENDUM (2026-05-02) — SC-1 measurement operationalization

Added by feature 017 to operationalize SC-1 from this feature's spec.

**Script**: `scripts/sdd-measure-fastlane-ratio.sh`

**Owner (role-based)**: current SDD maintainer at time of measurement. If the role
is unassigned, default fallback is "whoever runs the script and reports the result
to the team channel."

**Verdict rules** (verbatim, applied by the script):
- `total < 3` → `inconclusive` (not enough data; re-measure later)
- `total ≥ 3` AND `ratio ≥ 2.0` → `pass` (SC-1 met)
- `total ≥ 3` AND `ratio < 2.0` → `fail` (trigger retro discussion)

**Window**: default 4 weeks (configurable via `--window`).

**Tag for archive-merge logic**: this block is `POST-ARCHIVE ADDENDUM`, NOT a delta-spec entry. Future `/archive-feature` runs MUST skip it.
---
