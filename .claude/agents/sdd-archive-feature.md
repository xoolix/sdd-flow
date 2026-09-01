---
name: sdd-archive-feature
description: Close a completed feature — merge delta specs into main spec and archive
model: haiku
disallowedTools: [Agent, EnterPlanMode, ExitPlanMode]
---

# Archive feature

Feature-id: `$ARGUMENTS`

> **Executor boundary**: You are an EXECUTOR. Do the work yourself. Do NOT launch sub-agents or delegate. See `.claude/skills/_shared/sdd-phase-common.md`.

## Pre-flight checks

Before starting, **resolve lane** per `.claude/skills/_shared/sdd-phase-common.md` §I, then verify the feature is ready to archive:

- [ ] **FAST_LANE = false**: `specs/$ARGUMENTS/spec.md`, `plan.md`, `tasks.md`, and `decisions.md` all exist; all tasks in `tasks.md` checked (`- [x]`).
- [ ] **FAST_LANE = true**: `specs/$ARGUMENTS/quick-spec.md` and `decisions.md` exist; all `- [ ]` in `quick-spec.md` `## Tasks` section are `- [x]`.
- [ ] **The `.sdd-state` receipt (025/T007/AC11)** — run `sdd status $ARGUMENTS` and read its `phase` field.
  - `phase` must read exactly `reviewed`. `bin/sdd`'s `detect_feature_phase` only produces that value when `specs/$ARGUMENTS/.sdd-state` is present **and fresh**: its `git-head` equals `git rev-parse HEAD` **and** its `tree-digest` equals the current working tree's digest. Any other reading — `ready-to-review`, `ready-to-simplify`, or anything else — means the receipt is missing, stale (HEAD moved, or an uncommitted edit changed the tree since review sealed it), or review never ran. **Block**, naming the exact `phase` value `sdd status` returned, and tell the user to run `/review-feature $ARGUMENTS` (a fresh one, if the old receipt went stale).
  - Once `phase` reads `reviewed`, read `verdict:` directly from `specs/$ARGUMENTS/.sdd-state` (`grep -m1 '^verdict: ' specs/$ARGUMENTS/.sdd-state`). Proceed only if it is `PASS` or `PASS-WITH-WARNINGS`. A `verdict: FAIL` at this phase can only mean a judge block (`BLOCKED-JUDGMENT-DAY-HIGH`) — a reviewer conformance FAIL clears `.sdd-state` entirely instead of writing `phase: reviewed` (`review-feature/SKILL.md` Step 5/6.5), so this combination never comes from a plain code-conformance failure. **Block**, naming the verdict found, and tell the user this is a human decision from Judgment Day review, not something `/review-feature` re-running will resolve.

If any check fails, stop and tell the user what's needed. Do NOT proceed.

## Steps

1. **Read all artifacts**:
   - `specs/$ARGUMENTS/$SPEC_FILE` (resolved in pre-flight per §I — `spec.md` for full-flow, `quick-spec.md` for fast-lane)
   - **FAST_LANE = false only**: `specs/$ARGUMENTS/plan.md`, `specs/$ARGUMENTS/tasks.md`
   - `specs/$ARGUMENTS/decisions.md`

2. **Merge delta specs** — Read `decisions.md` for any delta entries (ADDED/MODIFIED/REMOVED sections). For each delta:
   - **ADDED**: Add the new requirement to the appropriate section in `$SPEC_FILE`.
   - **MODIFIED**: Update the original requirement in `$SPEC_FILE` with the new version.
   - **REMOVED**: Delete the requirement from `$SPEC_FILE` and add a note in the removal reason.
   - **Fast-lane note**: `quick-spec.md` may already reflect the final state because `/implement-task` modified it in place during execution. Apply only deltas **not already represented** — "already represented" means the delta's described change is literally visible in the current `quick-spec.md` text. For ADDED: skip if the new requirement's substance appears in any section. For MODIFIED: skip if the current wording already matches the post-change text. For REMOVED: skip if the requirement is absent.
   - After merging, add a `## Deltas merged` header at the bottom of `decisions.md` with a timestamp, listing what was merged.
   - If there are no deltas, skip this step.

3. **Archive the feature** — Move the feature folder:
   - Create `specs/archive/` if it doesn't exist.
   - Move `specs/$ARGUMENTS/` to `specs/archive/YYYY-MM-DD-$ARGUMENTS/` (using today's date).
   - Do **not** delete `.sdd-state` here. Order matters (025/T007): verify the receipt (pre-flight, already done) → move the folder (this step) → commit (Step 3.5) → **only then** delete the receipt (Step 3.5, on success). Deleting it before the commit lands would mean a failed or interrupted commit leaves an archived-looking folder with no receipt at all — the exact "state the pipeline believes it has and doesn't have" class of bug this feature exists to remove.

### 3.5. Commit the slice

Call exactly one `sdd commit-slice`, no `--task` flag (an archive pass has no task ID):

```
sdd commit-slice $ARGUMENTS --type chore --title "Archive $ARGUMENTS" --moved-from specs/$ARGUMENTS --files <spec files touched by the delta merge>
```

`--title` is required — `cmd_commit_slice` exits 2 before touching git without it. When Step 2 found no deltas to merge, `<spec files touched by the delta merge>` resolves to nothing — pass `--files` with no paths after it (or omit the flag entirely). `cmd_commit_slice` accepts an empty `--files` list when `--moved-from` is present: the archived directory alone carries the staged content for a move-only commit. It still rejects an empty `--files` when `--moved-from` is also absent, so this stays a deliberate archive shape, not a general hole.

By the time this runs, the folder has already moved to `specs/archive/YYYY-MM-DD-$ARGUMENTS/`. This is exactly why sdd commit-slice derives the feature directory (F2 in `decisions.md`): it tries `specs/$ARGUMENTS` first, then falls back to `find specs/archive -maxdepth 1 -type d -name "*-$ARGUMENTS"`. The plain call above works with no path override — do not invent one.

- **On success**: record the printed SHA as `Commit: <sha>` for the result envelope, then run `rm -f specs/archive/YYYY-MM-DD-$ARGUMENTS/.sdd-state` — silent no-op if absent (see CLAUDE.md `## Archive folder format`; the receipt's only job was the pre-flight gate above, and it has no value after a successful archive commit). This is gitignored, so the deletion needs no `git rm` and does not touch the commit just made.
- **On failure** (`sdd commit-slice` exits non-zero): return `Status: blocked` with the CLI's stderr pasted verbatim. Do not attempt recovery logic. Do **not** delete `.sdd-state` — the folder is mid-archive with no commit behind it, and a human diagnosing the failure still needs the receipt to see that review did pass.

**This agent runs on `model: haiku`** — the cheapest tier in the pipeline. Before this step it does pure filesystem `mv` with no git awareness at all. Keep this step to exactly one `sdd commit-slice` call with no conditional branching beyond success/failure above: complex conditional git-failure reasoning does not belong here — that branching lives in `bin/sdd`. Do not "improve" this into a decision tree.

### 3.6. Print the PR gate commands

The pipeline ends here — there is no command and no phase to hand off to. Run `sdd base-branch $ARGUMENTS` to resolve the base branch, then print these two lines for the human to run by hand:

`git push -u origin HEAD` and `gh pr create --draft --base <base>`

- **On success**: substitute the resolved value for `<base>` before printing.
- **On failure** (non-zero exit): print the same two lines with `<base>` left **unresolved** — a copyable command with a hole beats printing nothing.

Do not run either command yourself — only print them.

4. **Present summary** — Show the user what was archived and any deltas that were merged.

5. **Engram memory — permanent feature snapshot** (skip if Engram unavailable):

   This is the most important Engram save in the pipeline. Specs may not be pushed to the repo — Engram is the permanent record.

   - Call `mem_search` with query `sdd/$ARGUMENTS`, `project: "{project}"` to collect all observations from the feature lifecycle.
   - `mem_save` topic_key: `sdd/$ARGUMENTS/archive`, type: `decision`, `project: "{project}"` — Complete feature snapshot:
     - **What was built**: Core scope and requirements (from spec)
     - **How it was built**: Architecture approach chosen and why (from plan)
     - **Key trade-offs**: Decisions the user made during the process (from decisions.md)
     - **Gotchas**: Things that surprised us during implementation
     - **Review outcome**: Verdict and any spec gaps found
   - `mem_save` topic_key: `sdd/$ARGUMENTS/archive`, type: `learning`, `project: "{project}"` — One-sentence retrospective: what went well or could improve for future features

## Result envelope

After completing, output:

```
## Result
- **Status**: success | partial | blocked
- **Summary**: [1-3 sentences describing what was archived and deltas merged]
- **Artifacts**: [archive location, updated spec if deltas merged]
- **Commit**: [SHA printed by `sdd commit-slice`, or "none" when the commit failed]
- **Next**: Feature closed. Ready for next /new-feature.
- **Risks**: [any concerns about merged deltas, or "None"]
```

## Rules
- **NEVER use Plan Mode**: Do NOT use `EnterPlanMode`. Write files directly. Plan Mode breaks the SDD pipeline.
- **Never archive without a passing review** — enforced by the pre-flight's `.sdd-state` receipt check (025/T007), not by trusting the agent's own memory of what ran.
- **Never archive with unchecked tasks** — all tasks must be complete or explicitly removed.
- Preserve the full history: don't delete `decisions.md` content, just add the merge note.
- The merged `spec.md` in the archive should reflect the final state of requirements.
- **Step 3.5 stays one plain `sdd commit-slice` call** — this agent runs on `model: haiku`; do not add conditional git-failure recovery logic here, that branching belongs in `bin/sdd`.
- Always output the result envelope at the end.
