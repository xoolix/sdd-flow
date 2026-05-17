# Feature: Fast-lane visibility

## Summary
Make the fast-lane workflow (`/new-quick-feature`, `/new-fix` → `quick-spec.md`) the visually default path for starting a feature in `.claude/CLAUDE.md`. Today it is semi-hidden. Most features on a 10-person team are small, so fast-lane should be the expected first choice. Visibility-only — no skill behavior changes.

## Trigger
Manual — maintainer running the SDD pipeline. Ships when the docs commit lands.

## Happy Path
1. Team member with a small change opens `.claude/CLAUDE.md`.
2. They see a "Choosing a lane" decision rule **before** `/new-feature`, stating verbatim **"single-domain, no deps, ≤2 GWT → fast-lane"**, plus a tie-breaker: when in doubt, start with `/new-quick-feature` (or `/new-fix` for bugs). If scope grows mid-flow, escalate by re-running `/new-feature` with the same intent and archiving the orphaned `quick-spec.md` manually — there is no automated promotion.
3. Skill routing table is reordered: `/new-quick-feature` and `/new-fix` appear above `/new-feature`.
4. The pipeline ASCII diagram shows both lanes as first-class branches from a common entry.
5. Frontmatter `description:` of both agent files and SKILL.md files for `new-feature`, `new-quick-feature`, `new-fix` encodes the rule.
6. Existing "Fast-lane note" callouts are reviewed in the same pass for consistency; manual-only design constraint preserved verbatim.

## Domains
- [x] Other: docs / skill metadata / information architecture

**Scope**: `.claude/CLAUDE.md` + frontmatter and presentation prose of both agent files (`.claude/agents/sdd-new-feature.md`, `.claude/agents/sdd-new-quick-feature.md`, `.claude/agents/sdd-new-fix.md`) AND SKILL.md files (`.claude/skills/new-feature/SKILL.md`, `.claude/skills/new-quick-feature/SKILL.md`, `.claude/skills/new-fix/SKILL.md`). Parity of `description:` fields across both surfaces required for AC-5. **Out of scope**: `README.md` (feature 015), `skill-map.md`, `/init-project`.

## Edge Cases
- **Boundary ambiguity**: change straddles criteria → users guess. Mitigated by AC-2.
- **Symlinked `CLAUDE.md`**: file may symlink to SDD_HOME; `bin/sdd update` byte-diffs SDD-managed files, so project-local edits get clobbered. Mitigated by AC-3.
- **Consistency drift**: scattered fast-lane mentions may contradict the new prominent rule. Mitigated by AC-4.

## Acceptance Criteria

| # | Given | When | Then |
|---|-------|------|------|
| AC-1 | a new team member opens `.claude/CLAUDE.md` looking for how to start a feature | they read top-to-bottom | they hit a "Choosing a lane" rule **before** `/new-feature`, stating literally "single-domain, no deps, ≤2 GWT → fast-lane"; `/new-quick-feature` + `/new-fix` appear above `/new-feature` in the Skill routing table |
| AC-2 | a user whose change straddles fast-lane criteria | they consult the rule | they find an explicit tie-breaker: "when in doubt, start with `/new-quick-feature`; escalating mid-flow is cheap" (or equivalent making fast-lane the default under uncertainty) |
| AC-3 | `.claude/CLAUDE.md` may symlink to SDD_HOME and `bin/sdd update` byte-diffs SDD-managed files | edits are applied | changes land in canonical SDD_HOME (not a project-local override); the plan documents target path and verifies symlink state via `readlink` (or equivalent) |
| AC-4 | existing "Fast-lane note" callouts and other fast-lane mentions | refactor is complete | all fast-lane mentions are mutually consistent, manual-only design constraint preserved verbatim, and `grep -n -i 'fast-lane\|quick-spec' .claude/CLAUDE.md` reads as a coherent narrative in document order |
| AC-5 | a user browsing skills via `description:` listings with no `CLAUDE.md` context | they read frontmatter of both agent files and SKILL.md files for `new-feature`, `new-quick-feature`, `new-fix` | each `description:` in both agent and SKILL files makes the lane choice unambiguous: fast-lane skills call out "use for small changes (single-domain, no deps, ≤2 GWT)"; `/new-feature` states "use only when fast-lane criteria don't fit" |

## Rollback Plan
- **Primary**: `git revert <commit-sha>` in the same repo where edits were applied (SDD_HOME if symlinked). No DB, flags, or migrations — clean revert restores prior state.
- **Granular fallback**: if only skill `description:` rewrites regress, revert the three `SKILL.md` files independently while keeping `CLAUDE.md` edits.

## Success Criteria
- **Primary (measurable)**: in the 4 weeks post-merge, the ratio of newly created `quick-spec.md` : `spec.md` under `specs/` is **≥ 2× the trailing 4-week pre-merge ratio**, computable from `specs/archive/` + `git log`. Floor: post-merge ratio ≥ 2:1 absolute. (Small-N noise acknowledged; metric is directional.)

## Open Questions
- Implementation constraints (not AC-gated): skill `description:` length cap (~200 chars) and ASCII diagram width (80-col wrap). Planner sizes as constraints, not blockers.

## Review Findings & Resolutions

### SPEC-GAP-HIGH-RESOLVED
Adversarial review (2026-05-01) flagged that the tie-breaker "escalating mid-flow is cheap" had no documented procedure. **Option A chosen (fix in source)**: rewrote tie-breaker in Happy Path §2 to explicitly acknowledge the manual escalation path: "If scope grows mid-flow, escalate by re-running `/new-feature` with the same intent and archiving the orphaned `quick-spec.md` manually — there is no automated promotion."

### SPEC-GAPS (Medium/Low, ACCEPTED for follow-up)
6 gaps recorded for future iteration; none block correctness:
- **SPEC-GAP-2 (incomplete-AC)**: "≤2 GWT" acronym unexpanded at decision-rule surface. Suggested: expand to "≤2 Given/When/Then acceptance criteria" in the blockquote.
- **SPEC-GAP-3 (undocumented-assumption)**: SC-1 measurement not actionable — no owner, no validated script, no zero-feature-window outcome defined.
- **SPEC-GAP-4 (undocumented-assumption)**: AC-3 symlink check is point-in-time only. No documented upstream contribution path if `bin/sdd update` ever clobbers.
- **SPEC-GAP-5 (incomplete-AC, RESOLVED by D-002)**: AC-5 didn't specify both agent and SKILL surfaces. D-002 documented both; spec now clarifies.
- **SPEC-GAP-6 (edge-case, RESOLVED by D-004)**: Original tie-breaker omitted `/new-fix` for bugfixes. D-004 fix included `/new-fix` mention.
- **SPEC-GAP-7 (undocumented-assumption)**: Pre-merge baseline for SC-1 may be unmeasurable (commits in bulk, not per-spec-file).
