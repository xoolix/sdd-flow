# Decisions

## 2026-04-20 — Discovery checkpoint resolutions

- **DF-1 Phase detection table structure**: Option A — add 4th column `.simplified exists?` to both `CLAUDE.md` and `sdd-continue/SKILL.md`. Table remains the single source of truth for phase routing.
- **DF-2 "Last validation green" pre-flight**: Option B — `/simplify-code` re-runs lint+typecheck+tests as its first act, before any edit. Blocks on red baseline. Makes AC-2 (regression revert) deterministic by distinguishing "simplify broke it" from "it was already broken".
- **DF-3 SPEC-GAP-HIGH vs sentinel**: Interpretation A — only conformance FAIL deletes `.simplified` (literal AC-5). SPEC-GAP-HIGH (blocked) leaves the sentinel intact; human manages manually if code changed during spec-fix.
- **DF-4 Revert pattern**: `git checkout -- <file1> <file2> ...` with explicit file list recorded before edits. No wildcards.
- **DF-5 Exclusion globs**: Design agent to propose explicit globs in `plan.md` (tests, lockfiles, migrations, configs).
- **DF-6 Model**: sonnet (matches `implement-task` as executor).
- **DF-7 Archive cleanup**: No explicit sentinel deletion — `archive-feature`'s folder move handles it implicitly.
- **DF-8 Skill pattern**: Reuse `implement-task`'s frontmatter, pre-flight, validation, envelope, and engram hooks.

## Delta: 2026-04-20 — Task 1 (Foundation)

- **MODIFIED**: `tasks.md` Foundation task listed frontmatter fields as `id, applies-to, model: sonnet`. Actual core SDD skill convention (from `implement-task`) uses `name, description, user-invocable, disable-model-invocation, arguments` with **no** `applies-to` (core skills are skipped by `/build-registry`) and **no** `model` field (routing via CLAUDE.md Model Routing table per DF-6). Task description corrected in `tasks.md`.

## Delta: 2026-04-20 — Validation phase (discovered during AC-5 trace)

- **ADDED**: Patched `sdd-continue/SKILL.md` Step 5 fix loop and `sdd-ff/SKILL.md` Step 2b fix loop to re-launch `/simplify-code` between `implement-task` (fix) and `review-feature` (re-review). Reason: the original fix loops chained implement-task → review-feature directly; with the new phase, review-feature's sentinel deletion on FAIL had no effect on the in-loop re-review because no one re-checked the sentinel within the loop. Without this patch, AC-5 would only hold when the human manually runs `/sdd-continue` after a FAIL (not in `/sdd-ff` or in sdd-continue's automatic fix loop). The patch adds: (1) re-launch `/simplify-code`, (2) validate its result, (3) stop the fix loop on `Status: blocked` (baseline red / regression revert) so humans resolve regressions before cycles resume.
- **ADDED**: Pipeline diagram in `CLAUDE.md` updated to show "delete `.simplified` on FAIL → implement-task → `/simplify-code` → re-review" cycle explicitly.

No MODIFIED or REMOVED deltas against spec — acceptance criteria and rollback plan remain intact.

## SPEC-GAP-HIGH — 005-simplify-code-phase — adversarial review

| # | Severity | Category | Description | Suggested Action |
|---|----------|----------|-------------|------------------|
| 1 | high | security-integrity | Sentinel is trust-on-presence with no integrity check. A buggy or malicious sub-agent could create `specs/<id>/.simplified` with an arbitrary timestamp and empty file list, causing `sdd-continue` to skip simplification entirely and proceed straight to review. | Add a `git-head: <SHA>` field to the sentinel. `sdd-continue` (or `/simplify-code` pre-flight) should confirm the sentinel's SHA matches HEAD; if not, treat it as absent and re-run simplification. |
| 2 | high | uncovered-scenario | Concurrent / re-entrant invocation is unguarded: two agents (or human + `sdd-ff`) could run `/simplify-code` on the same feature-id simultaneously. Both pass the `.simplified`-absent pre-flight check, both edit the same files, validation outcomes are unpredictable. No lock or write-once guarantee. | Document TOCTOU constraint: `/simplify-code` must not be invoked concurrently for the same feature-id. Add to pre-flight: if `.simplified` exists at sentinel-write time (race), abort without error. |
| 3 | high | uncovered-scenario | File deletion during simplification is not prohibited by the NEVER list, and the revert path (`git checkout -- <file>`) behaves inconsistently for deleted-tracked files depending on whether the deletion was staged. A deleted file may silently "revert" without actually being re-created. | Add to NEVER list: never delete files — only edit file contents. Add a pre-revert check that `git status` shows only modified (not deleted) paths in `SCOPED_FILES`. |
| 4 | medium | incomplete-AC | AC-2's "git diff clean vs pre-simplify state" is under-specified — semantic ambiguity between `git diff`, `git diff HEAD`, and `git diff --cached`. | Rewrite AC-2's "Then" as: "`git diff HEAD -- <SCOPED_FILES>` returns empty after revert." |
| 5 | medium | undocumented-assumption | Shallow clones (CI `--depth=1`) and detached HEAD may cause `git merge-base` to fail. Mentioned in plan risks but not in spec. | Add to spec Edge Cases: note about shallow clones + fetch-depth requirement. |
| 6 | medium | edge-case | Rebase or merge mid-run between scope step and post-validation invalidates `SCOPED_FILES`. | Compare `git rev-parse HEAD` at scope time vs sentinel-write time; abort on mismatch. |
| 7 | medium | edge-case | `*.config.*` exclusion glob silently drops intentional business-logic files matching the pattern (e.g., `src/payments/payment.config.ts`). | Log excluded-but-touched count in the envelope; document the silent-exclusion behavior. |
| 8 | medium | uncovered-scenario | Manual invocation on an archived feature or with an archive path as feature-id is not covered. | Document: pre-flight blocks on archived features; archive paths unsupported. |
| 9 | medium | incomplete-AC | AC-4 doesn't verify `model: sonnet` is threaded end-to-end when orchestrator launches simplify-code. | Add sub-criterion: "The orchestrator passes `model: sonnet` when launching `/simplify-code`." |
| 10 | low | undocumented-assumption | Working tree may have unstaged edits in `SCOPED_FILES` that are invisible to `git diff <base>..HEAD`; agent processes HEAD version and overwrites manual tweaks. | Add pre-flight: block if `git status` shows modified files in computed scope. |
| 11 | low | undocumented-assumption | Pre-flight "all tasks `[x]`" doesn't detect tasks added post-simplify without re-running. Mitigated by sentinel gate + AC-5 re-deletion on review FAIL. | Document the assumption explicitly. |
| 12 | low | edge-case | Empty-diff sentinel is indistinguishable from a real-work sentinel; future tooling can't tell them apart. | Add `reason: no-scope` vs `reason: simplified` field. |

**Also flagged as CRITICAL by conformance Agent-C (outside adversarial scope)**: `simplify-code` is missing from `build-registry/SKILL.md`'s core-SDD skip list. The feature's frontmatter correctly omits `applies-to` on the assumption that `/build-registry` skips core skills — but the skip list was not updated. Running `/build-registry` will generate project-skill compact rules for simplify-code and inject them into implement-task/review-feature sub-agent prompts. **This is a required fix before the next `/build-registry` run.** Add `simplify-code` to the skip list at `.claude/skills/build-registry/SKILL.md:17-18`.

Source: adversarial review agent + conformance Agent-C, review-feature phase
Date: 2026-04-20

## Delta: 2026-04-20 — SPEC-GAP-HIGH resolution (gaps 1, 2, 3) + CRITICAL (build-registry)

Human decision: close all 3 high-severity gaps and fix the build-registry skip list. Medium/low findings deferred.

- **ADDED (gap 1 — sentinel integrity)**: Sentinel now carries a `git-head: <HEAD-SHA>` field. Phase detection treats a sentinel as "fresh" only if `git-head` equals `git rev-parse HEAD`; a stale sentinel is treated as absent (AC-6). `simplify-code/SKILL.md` pre-flight deletes stale sentinels and proceeds. This defends against spoofing and against sentinels surviving across unrelated commits (amend, rebase).
  - Spec: `spec.md` Happy Path step 5, Edge Cases "Stale sentinel", AC-1 and AC-3 now require `git-head` matching HEAD, new AC-6.
  - Skill: `simplify-code/SKILL.md` pre-flight + Step 6 item 2 (capture HEAD) + sentinel format.
  - Orchestrator: `CLAUDE.md` + `sdd-continue/SKILL.md` detection semantics renamed `.simplified exists?` → `Fresh .simplified?` with explicit definition above the table.

- **ADDED (gap 2 — concurrent invocation TOCTOU)**: `simplify-code/SKILL.md` Step 6 item 1 re-checks sentinel absence immediately before write; if a concurrent run has written it, the later run aborts with `Status: blocked` (`Summary: sentinel written concurrently`). Spec Edge Cases documents that the orchestrator already serializes phases and manual concurrent invocation is unsupported.

- **ADDED (gap 3 — file deletion)**: NEVER list now explicitly prohibits file deletion and creation — simplify-code is modifications-only. Post-validation pre-revert step (`simplify-code/SKILL.md` Step 5 item 1) runs `git status --porcelain -- <SCOPED_FILES>` and blocks if any path shows `D`/`A`/`R`/`??`, so a skill-internal bug cannot trigger an incomplete `git checkout --` revert. New AC-7 covers this gate.

- **MODIFIED (AC-2 precision)**: "git diff clean vs pre-simplify state" clarified to `git diff HEAD -- <SCOPED_FILES>` returns empty — unambiguous and mechanically verifiable. Also applied in `simplify-code/SKILL.md` Step 5 revert verification.

- **ADDED (build-registry CRITICAL)**: Added `simplify-code` to `.claude/skills/build-registry/SKILL.md:17-18` core-SDD skip list. Without this fix, `/build-registry` would have treated `simplify-code` as a project skill and injected its rules into implement-task/review-feature sub-agent prompts. The feature's DF-8 premise (core-skill-skipped-by-registry) is now actually enforced.

Medium/low adversarial findings (4–12) remain deferred; they are documented in the SPEC-GAP-HIGH table above for future consideration but are not blocking.

## SPEC-GAP — 005-simplify-code-phase — adversarial review (cycle 2)

Second adversarial pass after HIGH-gap resolution. No new high-severity gaps. 3 medium + 1 low remain for future consideration.

| # | Severity | Category | Description | Suggested Action |
|---|----------|----------|-------------|------------------|
| 1 | medium | incomplete-AC | AC-7 names only `D` (deletion) as the trigger for "abort before revert", but the skill (Step 5 item 1) also gates on `A`, `R`, `??`. A reader of the spec alone cannot verify the full pre-revert integrity contract. | Rewrite AC-7 "Given" as "produced a non-modification diff (any `D`, `A`, `R`, or `??` path in `SCOPED_FILES`)" to match the skill's actual gate. |
| 2 | medium | uncovered-scenario | Multiple `## Simplify:` entries accumulate in `decisions.md` across review-fix-simplify retry cycles (up to 3 entries with 2 FAIL cycles). The spec says "append entry" with no de-duplication. `archive-feature`'s delta-merge step covers `implement-task` deltas but is not defined to squash/annotate repeated simplify entries. Archived features will have ambiguous simplify history. | Specify that repeated simplify entries are additive and intentional, OR add a note to `archive-feature` to consolidate them into a single `## Simplify (final):` entry before archiving. |
| 3 | medium | edge-case | The sentinel's `git-head` is captured at write time (Step 6 item 2), not at scope time. If a rebase/amend happens between Step 3 (scope) and Step 6 (write), the sentinel's SHA reflects post-rebase HEAD while `SCOPED_FILES` reflects the pre-rebase diff. `sdd-continue` will see a fresh sentinel and skip simplify, even though simplified files no longer match the current tree. (Elevated from deferred gap #6 after the gap-1 fix made the interaction more subtle.) | Capture HEAD SHA at scope time (Step 3) and re-check at sentinel write (Step 6 item 1): if differ, abort with `Status: blocked` (`Summary: HEAD changed during simplify run — rebase or amend detected`). Folds into the existing TOCTOU guard. |
| 4 | low | spec-rationale | Edge Case "Stale sentinel (integrity)" states `git-head` "defends against sentinel spoofing." This is accurate only for stale/mismatched SHAs — a writer with same-HEAD access can still forge a valid sentinel. The trust model is implicitly "any writer to `specs/` is trusted", which is fine, but the spec overstates the protection. | Qualify the text: replace "defends against sentinel spoofing" with "defends against stale sentinels (post-amend, post-rebase). Trust model: any process able to write `specs/<id>/` is trusted." |

Source: adversarial review agent, review-feature phase (cycle 2)
Date: 2026-04-20

## Deltas merged — 2026-04-20 (archive-feature)

Merged into `spec.md` (already applied inline during the SPEC-GAP-HIGH resolution cycle):

- **From `Delta: SPEC-GAP-HIGH resolution`**:
  - Happy Path step 3 — "never create or delete files" wording.
  - Happy Path step 4 — pre-revert `git status --porcelain` check wording.
  - Happy Path step 5 — sentinel TOCTOU re-check + `git-head` field.
  - Edge Cases — 3 new rows: "Stale sentinel (integrity)", "Concurrent invocation (TOCTOU)", "File deletion attempt".
  - AC-1 — requires `git-head` matching current HEAD.
  - AC-2 — tightened to `git diff HEAD -- <SCOPED_FILES>` empty after revert.
  - AC-3 — requires `git-head` matching current HEAD on empty-diff sentinel.
  - AC-4 — requires "no fresh `.simplified`" (vs bare existence).
  - AC-6 — NEW — stale sentinel treated as absent → `/simplify-code` launched.
  - AC-7 — NEW — deletion attempt blocks before revert.

Not merged into `spec.md` (retained as implementation-level deltas):

- `Delta: Task 1 (Foundation)` — MODIFIED concerns `tasks.md` frontmatter wording; no spec impact.
- `Delta: Validation phase (AC-5 trace)` — ADDED concerns `sdd-continue` and `sdd-ff` fix-loop wiring; the spec's AC-5 was already correct, the implementation was brought in line.

`SPEC-GAP-HIGH` (cycle 1) and `SPEC-GAP` (cycle 2) entries are findings, not deltas — retained verbatim for history.
