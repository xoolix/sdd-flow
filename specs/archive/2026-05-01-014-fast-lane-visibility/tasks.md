# Tasks

## Execution order

### 1. Foundation

- [x] **T01 — Branch**: Create branch `feature/014-fast-lane-visibility` from main.
- [x] **T02 — Symlink check**: Run `readlink .claude/CLAUDE.md`; confirm empty (not symlinked); document result in `specs/014-fast-lane-visibility/decisions.md`.

### 2. Core implementation

- [x] **T03 — Choosing a lane section**: Add "Choosing a lane" blockquote to `.claude/CLAUDE.md` immediately before `## Skill routing`. Must include: rule literal `"single-domain, no deps, ≤2 GWT → fast-lane"` and tie-breaker `"when in doubt, start with /new-quick-feature; escalating mid-flow is cheap"`.
- [x] **T04 — Reorder skill routing table**: In `.claude/CLAUDE.md` Skill routing table, move `/new-quick-feature` and `/new-fix` rows above `/new-feature`.
- [x] **T05 — Update pipeline ASCII diagram**: Extend the Workflow diagram in `.claude/CLAUDE.md` to show fast-lane branch (`/new-quick-feature` or `/new-fix`) alongside the full-spec path from a common entry, converging at `/implement-task`. Keep lines ≤ 79 chars.
- [x] **T06 — Audit consistency callouts**: Review fast-lane mentions at lines ~118 and ~216 of `.claude/CLAUDE.md`; ensure all references are mutually consistent with the new rule and the manual-only design constraint is preserved verbatim (AC-4).
- [x] **T07 — Rewrite new-feature description**: In `.claude/agents/sdd-new-feature.md` frontmatter, append to `description:` the clause `"; use only when fast-lane criteria don't fit"`. Stay under 200 chars.
- [x] **T08 — Rewrite new-quick-feature description**: In `.claude/agents/sdd-new-quick-feature.md` frontmatter, rewrite `description:` to open with `"Fast-lane (small changes): "` framing, keeping existing criteria. Stay under 200 chars.
- [x] **T09 — Rewrite new-fix description**: In `.claude/agents/sdd-new-fix.md` frontmatter, rewrite `description:` to open with `"Fast-lane (bugfix): "` framing, keeping existing criteria. Stay under 200 chars.

### 3. Validation

- [x] **T10 — Consistency grep**: Run `grep -n -i "fast-lane\|quick-spec" .claude/CLAUDE.md`; confirm output reads as a coherent narrative in document order with no contradictions (AC-4). **Result**: PASS — 9 hits in doc order: L91 (phase pipeline tier), L118 (manual-only constraint, verbatim), L200 ("default expected path"), L203 (decision rule literal), L212-213 (fast-lane rows first), L226 (manual-only fast-lane note, verbatim), L275 (ASCII branch), L313 (archive merge). No contradictions.
- [x] **T11 — AC review**: Verify all 5 ACs are satisfied: AC-1 (blockquote before routing table, fast-lane rows first), AC-2 (tie-breaker present), AC-3 (symlink check documented), AC-4 (grep coherent), AC-5 (all three `description:` fields encode lane choice). Document sign-off in `specs/014-fast-lane-visibility/decisions.md`. **Result**: PASS — AC-1 (L198 blockquote, L212-213 reorder); AC-2 (L205 "when in doubt, start with /new-quick-feature"); AC-3 (D-001 — not symlinked); AC-4 (T10 grep coherent); AC-5 (6 files, 111-119ch, lane choice encoded). Sign-off in D-003.

## Notes
- T02 must precede T03–T06 (confirms edit target).
- T03–T09 are independent of each other once T02 is done; list is serial by default.
- T10–T11 depend on T03–T09 all complete.
- Update `decisions.md` if any plan detail changes during implementation.
