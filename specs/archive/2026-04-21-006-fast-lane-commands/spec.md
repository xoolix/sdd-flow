# Feature: Fast-lane commands (`/new-quick-feature`, `/new-fix`)

## Summary

Two new conversational intake skills analogous to `/new-feature`, for small work. Each writes a single `quick-spec.md` combining spec+plan+tasks inline. Existing SDD skills (`/implement-task`, `/simplify-code`, `/review-feature`, `/archive-feature`) accept `quick-spec.md` as alternative to `spec.md`+`plan.md`+`tasks.md` via minimal pre-flight tweaks. No orchestrator changes; no auto-suggest; no escape hatch; review stays 3-agent.

## Trigger

- User runs `/new-quick-feature <intent>` (enhancement/refactor) or `/new-fix <intent>` (bugfix, Kiro-style C/E/U).
- User invokes existing skills (`/implement-task`, `/simplify-code`, `/review-feature`, `/archive-feature`) manually after `quick-spec.md` exists.

## Happy Path

1. User runs `/new-fix "<intent>"`.
2. Skill runs **conversational entry gate** (3 questions): single-domain? no new deps? acceptance in ≤2 GWT? — fail → `Status: blocked` + suggest `/new-feature`.
3. Gate passes → minimal intake (confirm intent, gather C/E/U or AC, 1 rollback question).
4. Writes `specs/NNN-kebab/quick-spec.md` with Intent, (C/E/U) or (AC as GWT), **Plan** (Files + Approach + **Change list as `- [ ]` bullets**), Rollback, Success.
5. Creates empty `decisions.md`. Returns envelope.
6. User runs `/implement-task NNN-kebab` → pre-flight detects `quick-spec.md`, iterates Change list bullets as tasks, flips `- [x]` per completion.
7. `/simplify-code NNN-kebab` → pre-flight accepts `quick-spec.md`; rest unchanged.
8. `/review-feature NNN-kebab` → pre-flight + read accept `quick-spec.md`; 3-agent voting + adversarial unchanged.
9. `/archive-feature NNN-kebab` → pre-flight, read, and delta merge all resolve to `quick-spec.md` via `$SPEC_FILE` variable.

## Edge Cases

- **Entry gate rejects**: `Status: blocked`, no `quick-spec.md` written, suggest `/new-feature <intent>`.
- **Folder has `spec.md`**: skill asks user (overwrite / new folder / cancel). Never auto-overwrites.
- **Both `spec.md` + `quick-spec.md` present**: `$SPEC_FILE` precedence — `quick-spec.md` wins if `plan.md` absent; else full flow.
- **User edits `quick-spec.md` between skill runs**: accepted — each skill re-reads at pre-flight.
- **Review FAIL (manual)**: paste the `### Review-Feedback` block from `/review-feature` into `/implement-task <id>`. Step 2b parses the **Task-bullet** column to flip matching `- [x]` → `- [ ]` (or append new bullets for `(new task needed — not in list)` rows). Then re-run `/simplify-code` (sentinel auto-deleted by review Step 4.5 on FAIL) and `/review-feature`. "Max 2 → ESCALATED" is **advisory** in manual mode — user self-monitors.
- **Simplify-code scope**: union of committed diff + working-tree. SDD markdown excluded. `.simplified` is HEAD-bound; manual `rm` to force re-run.
- **`## Tasks` header is immutable** — parsed by 4 downstream skills. Users MUST NOT rename or nest.
- **Archive merges into `quick-spec.md`** (not `spec.md`) for fast-lane features.

## Acceptance Criteria

- [ ] **Given** a repo with SDD, **When** user runs `/new-fix "<intent>"`, **Then** `specs/NNN-kebab/quick-spec.md` is created with Intent, C/E/U, Plan (Files + Approach + Change list checkboxes), Rollback, Success in ≤900 words.
- [ ] **Given** an intent requiring 2 domains or a new dependency, **When** entry gate evaluates, **Then** skill returns `Status: blocked`, does NOT create `quick-spec.md`, and suggests `/new-feature` with original intent.
- [ ] **Given** `quick-spec.md` with N `- [ ]` Change list bullets, **When** user runs `/implement-task <id>`, **Then** pre-flight accepts `quick-spec.md`, treats each bullet as an atomic task, implements them in a single SMALL batch, flips each to `- [x]`.
- [ ] **Given** `quick-spec.md` exists and no `plan.md`, **When** user runs `/simplify-code <id>` or `/review-feature <id>`, **Then** pre-flight accepts `quick-spec.md` and the rest runs unchanged.
- [ ] **Given** `quick-spec.md` + `decisions.md` with deltas, **When** user runs `/archive-feature <id>`, **Then** deltas merge into `quick-spec.md` before archiving via `$SPEC_FILE` resolution.

## Rollback Plan

- Fully additive: `git revert` restores pre-feature state; full-flow features unaffected.
- Orphaned `quick-spec.md` features: user renames to `spec.md` and re-runs `/plan-feature` to split into `plan.md` + `tasks.md`.
- Partial rollback: any sub-change reverts in isolation.

## Success Criteria

- **Token cost**: fast-lane full loop consumes ≤30% of full-flow cost on ≤30-LOC work (5 samples before/after).
- **Gate calibration**: <20% of invocations escalate to `/new-feature` during first 30 days.
- **Downstream compatibility**: the 4 existing skills run 0-error on 5 consecutive fast-lane features.

## Open Questions

_(All resolved — see `decisions.md`.)_
