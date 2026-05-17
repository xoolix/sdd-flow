# Decisions

## 2026-04-20 — Discovery checkpoint resolution (plan-feature pass 2)

- **DISCOVERY-ACCEPTED — A5 — Word budget**: Relax `quick-spec.md` budget from ≤400 to **≤900 words**. Combined spec+plan+tasks artifact cannot fit in 400 words while keeping meaningful Plan + Change list. Spec AC#1 updated.
- **DISCOVERY-ACCEPTED — B7 — Manual-only invocation**: Do NOT add CLAUDE.md phase-detection row. Do NOT touch `sdd-continue`/`sdd-ff`. Honors v2 re-scope "no orchestrator changes". Fast-lane skills' `Next` field tells the user to invoke `/implement-task NNN` etc. manually. Optional: 1-line note in CLAUDE.md (plan agent decides priority).
- **DISCOVERY-ACCEPTED — B2 — Writeback target verification**: Plan must include an explicit task with verification step: after `/implement-task` on a fast-lane feature, all Change list bullets in `quick-spec.md` are `- [x]`. Highest-risk single-line edit in the feature.

## 2026-04-21 — Validation phase notes (T19 / T20)

- **T19 (B2 drill)**: Verified by dry-run. Created throwaway `specs/TEST-fast-lane-drill/quick-spec.md` with 3 `- [ ]` Change list bullets in `## Tasks`. Applied the `implement-task` §I lane-resolution + Step 4c writeback logic by hand-edit. Post-state: all 3 bullets `- [x]`; no `tasks.md` present in the drill folder. Folder deleted after verification.
- **T20 (E2E)**: Infrastructure verified by static trace of each phase's fast-lane branch (`grep quick-spec.md` confirms references in `new-quick-feature`, `new-fix`, `implement-task`, `simplify-code`, `review-feature`, `archive-feature`, and `_shared/sdd-phase-common.md` §I). A live-fire E2E (actual `/new-fix` → `/archive-feature` run) remains a user-run gate — the conversational intake in `new-fix`/`new-quick-feature` cannot be driven from within `/implement-task`. Flagged as a manual follow-up in the envelope Risks.
- **T21 (docs)**: `CLAUDE.md` routing rows (lines 194–195) + fast-lane note (line 207) confirmed. §I present in `_shared/sdd-phase-common.md` and referenced by all 4 edited skills.

## Simplify: 2026-04-21 — /simplify-code

- **Files simplified**: none
- **Changes**: No edits applied. SCOPED_FILES (10 working-tree files: 4 edited skills + 2 new skills + 2 templates + `_shared/sdd-phase-common.md` + `CLAUDE.md`) were scanned. The feature ships SKILL.md / template markdown authored through the SDD spec→plan→review cycle; no KISS/DRY/YAGNI candidates surfaced. Structural parallelism between `new-quick-feature` ↔ `new-fix` (entry-gate wording) and `quick-spec-template.md` ↔ `fix-spec-template.md` (section layout) is incidental similarity serving per-skill self-containment — extracting would violate "Never merge concerns across files".
- **Scope note**: `git diff --name-only main..HEAD` captures prior-feature committed files because this repo follows the `.claude/rules/git.md` rule "never commit — leave unstaged". Feature 006's actual work is entirely unstaged + untracked. Scanned both interpretations; neither surfaced simplifications.
- **Baseline**: pass | **Post-edit**: pass (no edits)

## SPEC-GAP-HIGH — 006-fast-lane-commands — adversarial review

## Spec Gaps
| # | Severity | Category | Description | Suggested Action |
|---|----------|----------|-------------|------------------|
| 1 | high | uncovered-scenario | The Review FAIL fix loop for fast-lane features is undefined mechanically. The spec says "Review-Feedback flips relevant `- [x]` back to `- [ ]`" but does not specify who performs this flip — it lives in `quick-spec.md`, not `tasks.md`, and no skill or phase is assigned to do it. Since B7 accepted manual-only invocation, the fix path after FAIL is uncharted: the user must manually reopen tasks in `quick-spec.md`, but the spec gives no guidance. A user following the envelope's instructions would have no idea what to do after a FAIL. | Document the FAIL recovery path explicitly: add a "Review FAIL — fast-lane" section to the spec specifying that the user must manually flip `- [x]` back to `- [ ]` for failed tasks in `quick-spec.md`, then re-run `/implement-task`. |
| 2 | high | undocumented-assumption | `simplify-code` scope detection uses `git diff --name-only <base>..HEAD` but all fast-lane files are **never committed** (per `git.md`). The diff will be empty since the files are untracked/unstaged, causing simplify-code to always produce `SCOPED_FILES = []` for fast-lane features and write a trivially-passing sentinel without ever scanning the implementation files. The spec does not address this. | Either (a) document that `simplify-code` is a no-op for fast-lane and make that expectation explicit in the spec, or (b) specify an alternative scope detection for fast-lane (e.g., use `git status --short` or read touched files from `quick-spec.md ## Plan / Touched files`). |
| 3 | medium | edge-case | The `.simplified` sentinel freshness check uses `git rev-parse HEAD`. Since fast-lane files are never committed, HEAD never changes regardless of user edits. A `simplify-code` run will write the sentinel with the current HEAD; any subsequent edits to implementation files leave HEAD unchanged, so the sentinel always appears "fresh" and blocks re-runs. | Document explicitly that the sentinel is inherently "stale-resistant" for fast-lane since HEAD doesn't advance, and clarify that re-running `/simplify-code` after edits requires manual sentinel deletion. |
| 4 | medium | incomplete-AC | AC#2 states the entry gate fires on "an intent requiring 2 domains or a new dependency" but the gate is entirely self-reported by the user answering Q1–Q3. The LLM cannot verify domain count or dependency usage. The spec's success metric ("< 20% escalation rate") is meaningless if the gate is bypassable by intent. | Add a note acknowledging the gate is advisory (user-self-reported), trust-based rather than structurally enforced. |
| 5 | medium | edge-case | NNN folder number uniqueness is not guaranteed. `new-fix` and `new-quick-feature` scan for the "next sequential number" by looking at existing `NNN-*` folders — but collision checks only compare `NNN-<new-kebab>`, not `NNN-*`. Two folders could share a prefix number. | Specify that the NNN scan must find the highest existing NNN and increment — not reuse a number already in any form. Add this rule to both skills. |
| 6 | medium | uncovered-scenario | When `sdd-continue` (always active) is invoked on a fast-lane folder (has `quick-spec.md`, no `spec.md`), the Phase Detection table returns "Blocked: run `/sdd-new` first" — which contradicts expected fast-lane flow and is misleading UX. The fast-lane note at CLAUDE.md line 207 is 86 lines below the phase detection table. | Document explicitly what the orchestrator does for a fast-lane folder. Consider adding a detection branch: "Has `quick-spec.md` but no `spec.md` → fast-lane: invoke phases manually per `Next` field." |
| 7 | low | incomplete-AC | AC#3 says tasks are "implement[ed] sequentially" but `implement-task` classifies fast-lane as SMALL ("implement all remaining unchecked tasks in one batch"). "Sequentially" and "one batch" are not equivalent. | Clarify AC#3 to say "implements all tasks in a single batch" to align with SMALL-feature behavior. |
| 8 | low | undocumented-assumption | The `## Tasks` section header in `quick-spec.md` is the load-bearing parse target for 4 downstream skills. The spec never declares this header immutable. A user who renames `## Tasks` to `## Checklist` or nests it would silently break writeback and gate logic. | Add an explicit constraint: the `## Tasks` header in `quick-spec.md` is immutable. Document as a warning comment in both templates. |

Source: adversarial review agent, review-feature phase
Date: 2026-04-21

## SPEC-GAP-RESOLVED — 2026-04-21 — 006-fast-lane-commands

All 8 adversarial gaps + 10 conformance warnings addressed. HIGH tag lifted; pipeline unblocked. Summary of fixes:

- **HIGH #1 (Review FAIL recovery)** → `spec.md` Edge Cases expanded with explicit manual mechanics; `implement-task/SKILL.md` gained Step **2b** "Review-fix cycle" that flips listed `- [x]` → `- [ ]` from Review-Feedback before re-implementing (works for both lanes).
- **HIGH #2 (simplify-code scope)** → `simplify-code/SKILL.md` Step 3.2 now falls back to working-tree scope (`git status --short`) when `git diff base..HEAD` is empty — fixes the silent no-op for ALL features in this never-commit repo, not just fast-lane. `spec.md` Edge Cases documents the fallback.
- **MED #3 (sentinel freshness)** → `spec.md` Edge Cases notes `.simplified` is HEAD-bound; user must `rm` to force re-run in never-commit repos.
- **MED #4 (gate is self-reported)** → Accepted as a calibration tool. Documented here that the <20% escalation metric is advisory; gate enforcement is trust-based by design. No code change.
- **MED #5 (NNN uniqueness)** → Both `new-quick-feature` and `new-fix` now spec "highest existing NNN + 1, never reuse" including `specs/archive/`.
- **MED #6 (sdd-continue misleading for fast-lane)** → CLAUDE.md Phase Detection table prefaced with an inline fast-lane note pointing to the Skill-routing note.
- **LOW #7 (AC#3 wording)** → AC#3 "sequentially" → "in a single SMALL batch" to match implement-task behavior.
- **LOW #8 (## Tasks immutable)** → Both templates (`quick-spec-template.md`, `fix-spec-template.md`) got a WARNING comment above `## Tasks`; `spec.md` Edge Cases states it explicitly.

### Conformance fixes applied
- **C3** → `review-feature/SKILL.md` Step 5.5 action branches on FAST_LANE for context files.
- **C4** → `CLAUDE.md` Delta specs section: `spec.md` → `$SPEC_FILE` with fast-lane parenthetical.
- **C5** → `_shared/sdd-phase-common.md` §C artifact table adds fast-lane row cross-referencing §I.
- **C9** → `implement-task/SKILL.md` pre-flight FAST_LANE=false checklist now includes `spec.md`.

### Open question closed (from spec.md §Open Questions)
**DECIDED**: `/new-quick-feature` + `/new-fix` **write directly** (like `/new-feature`), then present the completed `quick-spec.md` to the user (step 8 of Generate). Rationale: the intake conversation is the approval gate — once the quality gate passes, the write is a pure serialization step. A separate approval checkpoint would duplicate the gate. Users can still edit `quick-spec.md` before running `/implement-task` (each skill re-reads at pre-flight).

### Scope note
Fix for HIGH #2 modifies `simplify-code/SKILL.md` which is a cross-feature skill. Change is backward-compatible (fallback only activates when committed diff is empty) and benefits every feature in this repo whose agent follows `git.md` "never commit". Logged as out-of-scope-but-necessary.

## Simplify: 2026-04-21 (pass 2) — /simplify-code

- **Files simplified**: none (KISS/DRY/YAGNI). One mid-run edit to `simplify-code/SKILL.md` Step 3.2 refined the scope rule from "committed diff, with empty-fallback to working tree" → "**union** of committed diff + working tree". This is a scope-rule correction, not a simplification — the prior phrasing missed the mixed-diff case (branch has prior-feature commits + this-feature unstaged work). Change is still backward-compatible.
- **SCOPED_FILES (union)**: 15 files — 8 committed (prior-feature, previously simplified in commit 857c70e) + 7 working-tree (feature-006: 4 edited skills, 2 new skills, 2 templates, `_shared/sdd-phase-common.md`, `CLAUDE.md`).
- **Simplification candidates evaluated**: Q1/Q2/Q3 gate wording across `new-quick-feature` ↔ `new-fix` (incidental similarity — per-SKILL self-containment); template section parallelism (same); B2 parenthetical "NOT tasks.md" in `implement-task` Step 4c (load-bearing guard-rail, not redundant); "(once)" anchor in Step 1 (visual skim aid). Nothing surfaced.
- **Baseline**: pass | **Post-edit**: pass

## SPEC-GAP-HIGH — 006-fast-lane-commands — adversarial review (round 2)

Round-2 conformance: 3/3 PASS-family (Agent-A PASS, Agent-B PASS, Agent-C PASS WITH WARNINGS). Consensus PASS (majority). Adversarial round 2 found **2 new HIGH** + 3 medium + 1 low, all emerging from the round-1 fixes themselves.

## Spec Gaps
| # | Severity | Category | Description | Suggested Action |
|---|----------|----------|-------------|------------------|
| 1 | high | undocumented-assumption | `simplify-code` union scope now includes untracked files (`??` from `git status --short`) — fast-lane files and `quick-spec.md` itself fall into this set. Step 5 pre-revert integrity check still treats `??` as a skill-internal-bug indicator and refuses `git checkout --`, but post-revert can't restore untracked files anyway (nothing to check out to). If simplify-code edits an untracked file and post-validation fails, user is left with edited-broken files and no automated recovery. | Either (a) exclude untracked markdown spec/skill files from SCOPED_FILES (add `specs/**/*.md`, `.claude/skills/**/*.md` to exclusion filters) OR (b) update the integrity check to accept `??` as legitimate under the union rule and document a manual-recovery path in the envelope. |
| 2 | high | uncovered-scenario | Review-Feedback ↔ Tasks format mismatch in fast-lane FAIL recovery. `review-feature` Step 5 produces Review-Feedback keyed by **Criterion** (free-form GWT or gap text). `implement-task` Step 2b must flip `- [x]` → `- [ ]` in `quick-spec.md` `## Tasks` — concrete **change-list bullets**, not criteria. No mapping rule exists; agent must guess which bullet corresponds to which failed criterion; mismatch is silent. This effectively re-opens round-1 HIGH #1 at the operational level. | Pick one: (a) require each `## Tasks` bullet to reference its AC number (e.g., `- [ ] AC-1 — validate input`); (b) on FAIL, reopen ALL `- [x]` bullets and re-implement the full change list; or (c) clarify Review-Feedback is Tasks-list-scoped for fast-lane (rows map 1:1 to bullets). |
| 3 | medium | undocumented-assumption | "Max 2 cycles → ESCALATED" rule has no enforcement in fast-lane manual mode. Full-flow orchestrators count cycles; fast-lane has no counter. User self-tracking is undocumented. | Spec clarification: "max 2 cycles" is advisory for manual fast-lane — user self-monitors. Or add a counter convention (line in `decisions.md`). |
| 4 | medium | uncovered-scenario | `simplify-code` exclusion filters don't cover `*.md` spec/skill files. Union scope could feed `quick-spec.md` or `SKILL.md` into SCOPED_FILES. KISS/DRY on a spec is nonsensical and could corrupt the `- [ ]` format that 4 skills depend on. | Add `specs/**/*.md` and `.claude/skills/**/*.md` to the exclusion filter. |
| 5 | medium | undocumented-assumption | Operational handoff of Review-Feedback from `/review-feature` output to `/implement-task` invocation is unspecified for manual users (Agent-C dissent; not resolved in round 1). | Add to spec Edge Case + implement-task Step 2b: "Copy the `### Review-Feedback` block verbatim from `/review-feature`'s result into the `/implement-task <id>` message." |
| 6 | low | edge-case | `archive-feature` Step 2 "idempotent merge" has no algorithmic guidance on "already represented." Left to agent judgment. | Document: "already represented" means the delta's described change is visible in current `quick-spec.md` text. |

Source: adversarial review agent, review-feature phase (round 2)
Date: 2026-04-21

## SPEC-GAP-RESOLVED (round 2) — 2026-04-21

All 6 round-2 gaps addressed in 5 targeted edits. HIGH tag lifted. Summary:

- **HIGH #1 + MED #4 (same fix)** → `simplify-code/SKILL.md` Step 3.3 exclusion list gains `specs/**/*.md`, `.claude/skills/**/*.md`, `.claude/CLAUDE.md`, `.specify/templates/*.md`. SDD prose artifacts never enter SCOPED_FILES, so the untracked-revert edge case + corruption-of-checkboxes risk both disappear at the source. spec.md Edge Cases updated.
- **HIGH #2** → `review-feature/SKILL.md` Step 5 Review-Feedback table gains a **Task bullet (verbatim)** column as the first data column; envelope includes a "Manual-mode handoff" paragraph telling users to paste the block into `/implement-task`. `implement-task/SKILL.md` Step 2b expanded to parse the Task-bullet column: exact-string match flips `- [x]` → `- [ ]`; `(new task needed — not in list)` rows append a new bullet. Format mismatch closed.
- **MED #3** → spec.md Review FAIL edge case now states "Max 2 → ESCALATED" is **advisory** in manual mode (user self-monitors).
- **MED #5** → spec.md + implement-task Step 2b + review-feature envelope all explicitly name the paste-verbatim handoff. Fixed with H2.
- **LOW #6** → `archive-feature/SKILL.md` Step 2 Fast-lane note now defines "already represented": ADDED skipped if substance is in any section; MODIFIED skipped if wording matches; REMOVED skipped if absent.

### Scope note
H1's fix modifies a cross-feature exclusion list in `simplify-code/SKILL.md` — backward-compatible (additive filters). H2's fix changes the Review-Feedback schema universally (adds Task-bullet column) — both orchestrator-mode and manual-mode consumers benefit. No full-flow regression.

## SPEC-GAP (round 3) + SPEC-GAP-RESOLVED — 2026-04-21

Round-3 conformance: 3/3 **unanimous PASS WITH WARNINGS**. All 3 agents flagged the same convergent gap (Task-bullet example format inconsistency in `review-feature` Step 5). Adversarial round 3 classified gaps as **POLISH ONLY — no structural gaps, feature is ship-ready**.

## Spec Gaps (round 3)
| # | Severity | Category | Description | Suggested Action | Resolution |
|---|----------|----------|-------------|------------------|------------|
| 1 | medium | incomplete-AC | `review-feature/SKILL.md` Step 5 Review-Feedback table Row 1 (`T03 Add snippet to ...`) lacks the `- [x]` prefix that Row 2 uses; exact-string match in implement-task Step 2b would fail on Row-1-style entries | Unify Row 1 to canonical `- [x]` prefix form | **RESOLVED**: Row 1 changed to `- [x] **T03** Add snippet to ...` |
| 2 | low | incomplete-AC | `spec.md` Review-FAIL edge case referred to `(new task needed)` (short form); implementation expects `(new task needed — not in list)` (long form) | Update spec to full sentinel form | **RESOLVED**: spec.md updated to full form |

Source: adversarial review agent, review-feature phase (round 3). Convergence: POLISH ONLY — no structural gaps remain.
Date: 2026-04-21
