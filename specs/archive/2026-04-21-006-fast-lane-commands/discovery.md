# Discovery Report
status: findings-present

## High-impact findings

### Needs user decision

- **[conflict] A5 — Word budget conflict: AC#1 says ≤400 words, exploration recommends ~900** [impact: high]
  The current spec (AC#1) mandates `quick-spec.md ≤400 words`. But the combined artifact (spec + plan + Change list tasks inline) cannot plausibly fit 400 words while keeping meaningful content. Exploration recommends **~900 words total** (roughly: 250 for Summary/Trigger/AC/Rollback/Success, 350 for Plan section, 300 for Change list of 5–8 bullets with small descriptions).
  **Decision needed**: (A) **relax AC#1 to ≤900 words** (realistic for combined artifact); (B) **tighten design** — strip Plan-section prose, force bullets-only, keep 400-word ceiling (risk: under-specified plan); (C) **split** — keep `quick-spec.md` as spec-only at 400w, introduce a separate `quick-plan.md` at 500w (contradicts the "single artifact" simplification thesis).

- **[conflict] B7 — `/sdd-continue` misroutes fast-lane features** [impact: high]
  CLAUDE.md phase-detection table checks `Has plan.md + tasks.md?`. A fast-lane folder has `quick-spec.md` but no `plan.md`/`tasks.md` → current logic routes to `/plan-feature` instead of `/implement-task`. The spec explicitly excluded `sdd-continue`/`sdd-ff` from scope (v2 re-scope), but without a phase-detection row the orchestrator misroutes. User invoking phases manually (e.g., `/implement-task 006-fast-lane`) works, but anything via `/sdd-continue` or `/sdd-ff` breaks.
  **Decision needed**: (A) **add CLAUDE.md phase-detection row** (doc-only change, still no code in sdd-continue/sdd-ff — the table IS the logic); (B) **document "manual invocation only" as a known limitation**, user never uses `/sdd-continue` for fast-lane features; (C) **defer to a v3 feature** that fully integrates sdd-continue/sdd-ff with fast-lane.

### Needs plan attention (no user decision)

- **[edge-case] B2 — `/implement-task` Step 4c writeback target is hardcoded to `tasks.md`** [impact: high]
  If the fast-lane edit misses the writeback target swap (should be `quick-spec.md` Change list in fast-lane), Change list bullets stay `- [ ]` forever, and every downstream `all-[x]` gate (simplify, review, archive) blocks permanently. Highest-risk edit in the feature.
  **Action for plan**: explicit task with test verification — after `/implement-task` runs on a fast-lane feature, assert all Change list bullets are `- [x]` in `quick-spec.md`.

## Other findings

- [reuse] A1 — `new-feature` 7-step conversational flow + GWT hard-stop + quality gate checklist = replicable pattern. `disable-model-invocation: true` frontmatter required. "One question at a time" advisory only. [impact: low]
- [reuse] A2 — Template inventory: 4 existing templates (spec/plan/tasks/research). Recommended new `quick-spec-template.md` + `fix-spec-template.md` following existing section-marker + `<!-- hint -->` comment convention. [impact: low]
- [reuse] A3 — `new-quick-feature` + `new-fix` SKILL.md shape: entry gate (3 questions) BEFORE intake, then minimal conversational flow, quality gate, direct write. `new-fix` differs only in Step 3 (Current/Expected/Unchanged) + template choice. [impact: low]
- [simplification] A4 — Skip pre-write approval step (write directly, consistent with `/new-feature`). Conversation IS approval. Only exception: folder already has `spec.md` → ask user. [impact: low]
- [edge-case] B1 — `/implement-task` pre-flight does NOT check `spec.md` today — only `plan.md` + `tasks.md`. Fast-lane gate ADDS a `quick-spec.md` check (doesn't replace an existing `spec.md` gate). [impact: medium]
- [edge-case] B3 — `/review-feature` orchestrator reads spec/plan/tasks CONTENT and pastes it inline into 4 sub-agent prompts (3 conformance + 1 adversarial). Sub-agents don't read files. Fast-lane fix = content-swap in 4 locations. [impact: medium]
- [edge-case] B4 — `/archive-feature` hardcodes `spec.md` 3 times. Delta merge target for fast-lane = `quick-spec.md` (which may already reflect final state since implement-task modified it — merge must be idempotent). [impact: medium]
- [simplification] B5 — `/simplify-code` needs ONLY 1 pre-flight edit. Diff-based scoping is fully spec-agnostic. Sentinel is path/SHA based. Lowest risk in feature. [impact: low]
- [reuse] B6 — `$SPEC_FILE` / `FAST_LANE` resolution pattern (4 lines) can be centralized in `_shared/sdd-phase-common.md` §I or copy-pasted into each skill. Recommend centralize + inline reference per existing Engram pattern. [impact: low]
- [edge-case] B8 — Folder rename + move (archive Step 3) is path-based. `quick-spec.md` moves automatically. No change needed. [impact: low]
- [edge-case] B9 — `decisions.md` writes (delta, SPEC-GAP) are path-based, file-agnostic. No changes needed. [impact: low]

## User decisions
- DISCOVERY-ACCEPTED — A5 — Relax AC#1 to ≤900 words. Single-artifact (spec+plan+tasks combined) cannot meaningfully fit in 400 words. Spec.md updated.
- DISCOVERY-ACCEPTED — B7 — Manual-only invocation. Do NOT add CLAUDE.md phase-detection row; do NOT touch sdd-continue/sdd-ff. Honors v2 re-scope ("no orchestrator changes"). Fast-lane skills' `Next` field in the result envelope tells the user to invoke `/implement-task NNN` etc. manually. Optional: 1-line note in CLAUDE.md flagging that `/sdd-continue` does not support fast-lane (low priority — plan agent decides).
- DISCOVERY-ACCEPTED — B2 — Acknowledged as highest-risk implementation point. Plan must include an explicit task with verification: after `/implement-task` runs on a fast-lane feature, assert all Change list bullets in `quick-spec.md` are `- [x]`.
