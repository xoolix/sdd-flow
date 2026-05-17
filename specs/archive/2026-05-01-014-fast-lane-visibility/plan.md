# Technical Plan — 014-fast-lane-visibility

## Inputs
- Spec: `specs/014-fast-lane-visibility/spec.md` (5 ACs, visibility-only)
- Scope: `.claude/CLAUDE.md` + 3 skill frontmatter descriptions — 4 files total
- Size: SMALL (docs-only, single domain, no code, no migrations)

## Domain analysis

Pure information-architecture change. No runtime behavior modified. CLAUDE.md is **not a symlink** (`readlink` returns empty — confirmed at plan time); edits land directly in the project repo.

## Current state

| Location | Current text | Gap |
|---|---|---|
| CLAUDE.md:198-204 | Skill routing table: `/new-feature` row first, fast-lane rows below | Fast-lane is visually subordinate |
| CLAUDE.md:198 | No "Choosing a lane" decision rule exists anywhere | AC-1 / AC-2 unmet |
| CLAUDE.md:264-266 | Workflow diagram: single-column, full-spec only | Fast-lane not visualized |
| CLAUDE.md:216 | Fast-lane note: manual-only constraint, no lane-choice guidance | Preserved verbatim (AC-4) |
| `sdd-new-feature.md:3` | `description: Create a feature spec from an idea through conversational refinement` | No "use only when fast-lane doesn't fit" (AC-5) |
| `sdd-new-quick-feature.md:3` | `description: Create a quick-spec.md for a single-domain enhancement or refactor (no new deps, ≤2 GWT)` | No explicit "use this first" framing (AC-5) |
| `sdd-new-fix.md:3` | `description: Create a quick-spec.md for a single-domain bugfix (Kiro-style Current/Expected/Unchanged)` | No lane-first framing (AC-5) |

## Proposed design

| File | Change | AC |
|---|---|---|
| `.claude/CLAUDE.md` | Add "Choosing a lane" blockquote **before** `## Skill routing`, containing: rule ("single-domain, no deps, ≤2 GWT → fast-lane") + tie-breaker ("when in doubt, start with `/new-quick-feature`; escalating mid-flow is cheap") | AC-1, AC-2 |
| `.claude/CLAUDE.md` | Reorder skill routing table: `/new-quick-feature` and `/new-fix` rows move above `/new-feature` | AC-1 |
| `.claude/CLAUDE.md` | Extend Workflow diagram to show fast-lane branch from common entry point | AC-1 (visual parity) |
| `.claude/CLAUDE.md` | Audit lines 118, 216 for consistency with new rule; preserve manual-only constraint verbatim | AC-4 |
| `sdd-new-quick-feature.md` | `description:` → prefix with "Fast-lane (small changes): ..." + existing criteria | AC-5 |
| `sdd-new-fix.md` | `description:` → prefix with "Fast-lane (bugfix): ..." + existing criteria | AC-5 |
| `sdd-new-feature.md` | `description:` → append "; use only when fast-lane criteria don't fit" | AC-5 |

**Constraint**: description strings stay under ~200 chars (soft cap). All three fit within limit.

**Workflow diagram** replaces current single-line with a two-branch form showing fast-lane entry (`/new-quick-feature` or `/new-fix`) alongside the full-spec path, converging at `/implement-task`.

## Touched files

| File | Type | Change type |
|---|---|---|
| `.claude/CLAUDE.md` | Docs | Add section, reorder rows, update diagram, audit callouts |
| `.claude/agents/sdd-new-feature.md` | Skill metadata | Edit `description:` frontmatter |
| `.claude/agents/sdd-new-quick-feature.md` | Skill metadata | Edit `description:` frontmatter |
| `.claude/agents/sdd-new-fix.md` | Skill metadata | Edit `description:` frontmatter |

No APIs, DB, jobs, UI surfaces, or migrations touched.

## Migration / rollout

- **Flags**: none needed (docs-only)
- **Rollout**: single PR, merged directly to main
- **Rollback**: `git revert <sha>`. Granular: revert only the three SKILL.md files independently if frontmatter alone regresses.
- **Symlink note**: not symlinked now; if future SDD_HOME sync runs, operator re-applies patch to SDD_HOME.

## Observability

| Signal | How |
|---|---|
| Adoption ratio | `git log --name-only -- 'specs/*/quick-spec.md' 'specs/*/spec.md'` — 4-week pre/post counts; target ≥ 2× and ≥ 2:1 absolute |
| Consistency | `grep -n -i 'fast-lane\|quick-spec' .claude/CLAUDE.md` reads as coherent narrative |

## Test strategy

| AC | Validation method |
|---|---|
| AC-1 | Manual: open CLAUDE.md, confirm "Choosing a lane" blockquote appears before `## Skill routing`; confirm fast-lane rows are first in table |
| AC-2 | Manual: read blockquote, confirm tie-breaker sentence present verbatim or equivalent |
| AC-3 | Bash: `readlink .claude/CLAUDE.md` returns empty; edits applied directly to repo file |
| AC-4 | Bash: `grep -n -i 'fast-lane\|quick-spec' .claude/CLAUDE.md` — reviewer confirms no contradictions |
| AC-5 | Manual: read `description:` field of each of the 3 SKILL.md files; confirm lane framing present |
| Success metric | 4-week post-merge ratio check via git log command above |

No unit or integration tests required.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `description:` exceeds ~200-char soft cap | Low | Minor (display truncation) | Draft each string and count before committing |
| CLAUDE.md becomes symlink in future SDD update | Low | Medium (edits clobbered by `bin/sdd update`) | Document in decisions.md; operator must re-apply to SDD_HOME on update |
| Consistency drift at lines 118 / 216 | Low | Low | Audit both callouts in same PR pass |
| Diagram width exceeds 80-col terminal wrap | Low | Low | Keep fast-lane branch line ≤ 79 chars |

## Open questions

- None blocking implementation. Diagram exact formatting can be adjusted during `/implement-task` to fit 80-col constraint.
