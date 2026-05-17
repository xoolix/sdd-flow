# Tasks — 006-fast-lane-commands

## Execution order

### 1. Foundation

- [x] **T01** Create `.specify/templates/quick-spec-template.md` — combined spec+plan+tasks template for enhancements/refactors (≤900 words, includes Change list with `- [ ]` bullets, §Spec, §Plan, §Tasks sections).
- [x] **T02** Create `.specify/templates/fix-spec-template.md` — bugfix variant with Kiro-style Current/Expected/Unchanged (C/E/U) sections plus Change list with `- [ ]` bullets.
- [x] **T03** Add §I Fast-Lane Resolution snippet to `.claude/skills/_shared/sdd-phase-common.md` — 4-line canonical pattern: detect `quick-spec.md`, set `$SPEC_FILE`, skip absent `tasks.md` check, proceed.

> **Checkpoint A**: Verify both templates render valid markdown and `_shared` snippet is present before proceeding to Core.

### 2. Core implementation

- [x] **T04** Create `.claude/skills/new-quick-feature/SKILL.md` — 3-question conversational intake for enhancements/refactors; writes `specs/<id>/quick-spec.md` from `quick-spec-template.md`; returns envelope.
- [x] **T05** Create `.claude/skills/new-fix/SKILL.md` — 3-question conversational intake for bugfixes; writes `specs/<id>/quick-spec.md` from `fix-spec-template.md`; returns envelope.
- [x] **T06** Edit `implement-task/SKILL.md` pre-flight — add Fast-Lane Resolution snippet call; set `$SPEC_FILE` to `quick-spec.md` when present, else `spec.md`.
- [x] **T07** Edit `implement-task/SKILL.md` Step 2 — read `$SPEC_FILE` instead of hardcoded `spec.md`.
- [x] **T08** Edit `implement-task/SKILL.md` Step 3 — read task list from `$SPEC_FILE` §Tasks when `quick-spec.md`; skip absent `tasks.md`.
- [x] **T09** Edit `implement-task/SKILL.md` Step 4c — writeback: flip completed Change list bullets to `- [x]` inside `quick-spec.md` (not `tasks.md`) for fast-lane features. This is the B2 critical path.
- [x] **T10** Edit `simplify-code/SKILL.md` pre-flight — add Fast-Lane Resolution snippet; use `$SPEC_FILE` for spec reads; no other logic change.
- [x] **T11** Edit `review-feature/SKILL.md` pre-flight — add Fast-Lane Resolution snippet; set `$SPEC_FILE`.
- [x] **T12** Edit `review-feature/SKILL.md` Step 1 — read spec from `$SPEC_FILE`.
- [x] **T13** Edit `review-feature/SKILL.md` Step 2 prompt construction — pass `$SPEC_FILE` content to Agent-A/B/C instead of hardcoded `spec.md`.
- [x] **T14** Edit `review-feature/SKILL.md` Step 5.5 adversarial prompt — reference `$SPEC_FILE` for gap analysis.
- [x] **T15** Edit `archive-feature/SKILL.md` pre-flight — add Fast-Lane Resolution snippet; set `$SPEC_FILE`.
- [x] **T16** Edit `archive-feature/SKILL.md` Step 1 — read from `$SPEC_FILE`.
- [x] **T17** Edit `archive-feature/SKILL.md` Step 2 merge target — use `$SPEC_FILE` variable for delta merge destination.
- [x] **T18** Edit `CLAUDE.md` Skill routing — add rows for `/new-quick-feature` + `/new-fix`; 1-line manual-only note.

> **Checkpoint B**: Dry-run `/new-fix "sample bug"` on a throwaway feature id; confirm `quick-spec.md` is written; confirm implement-task pre-flight resolves `$SPEC_FILE` without error.

### 3. Validation

- [x] **T19** **B2 explicit verification**: Run `implement-task` on a sample fast-lane feature. Assert all Change list bullets in `quick-spec.md` are `- [x]` after the run. Confirm no write occurred to `tasks.md`.
- [x] **T20** End-to-end manual test: `/new-fix "<sample>"` → `quick-spec.md` written → `/implement-task` → all `- [x]` confirmed (T19) → `/simplify-code` completes → `/review-feature` passes 3-agent vote → `/archive-feature` archives successfully.
- [x] **T21** Docs check: confirm `CLAUDE.md` routing table updated; confirm `_shared/sdd-phase-common.md` snippet is referenced consistently across all 4 edited skills.

## Notes

- Update `decisions.md` on plan deviations.
- B2 (T09+T19) highest risk — verify before continuing.
- All edited skills stay backward-compatible when `quick-spec.md` absent.
