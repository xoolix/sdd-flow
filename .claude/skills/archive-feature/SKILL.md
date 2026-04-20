---
name: archive-feature
description: Close a completed feature — merge delta specs into main spec and archive
user-invocable: true
disable-model-invocation: true
arguments: feature-id
---

# Archive feature

Feature-id: `$ARGUMENTS`

> **Executor boundary**: You are an EXECUTOR. Do the work yourself. Do NOT launch sub-agents or delegate. See `.claude/skills/_shared/sdd-phase-common.md`.

## Pre-flight checks

Before starting, verify the feature is ready to archive:
- [ ] `specs/$ARGUMENTS/spec.md`, `plan.md`, `tasks.md`, and `decisions.md` all exist
- [ ] All tasks in `tasks.md` are checked (`- [x]`). If unchecked tasks remain, **block** and tell the user to complete them or explicitly remove them.
- [ ] A `/review-feature` has been run with verdict **PASS** or **PASS WITH WARNINGS**. If the verdict was **FAIL**, **block** and tell the user to fix critical issues first. If no review has been run, **block** and tell the user to run `/review-feature` first.

If any check fails, stop and tell the user what's needed. Do NOT proceed.

## Steps

1. **Read all artifacts**:
   - `specs/$ARGUMENTS/spec.md`
   - `specs/$ARGUMENTS/plan.md`
   - `specs/$ARGUMENTS/tasks.md`
   - `specs/$ARGUMENTS/decisions.md`

2. **Merge delta specs** — Read `decisions.md` for any delta entries (ADDED/MODIFIED/REMOVED sections). For each delta:
   - **ADDED**: Add the new requirement to the appropriate section in `spec.md`.
   - **MODIFIED**: Update the original requirement in `spec.md` with the new version.
   - **REMOVED**: Delete the requirement from `spec.md` and add a note in the removal reason.
   - After merging, add a `## Deltas merged` header at the bottom of `decisions.md` with a timestamp, listing what was merged.
   - If there are no deltas, skip this step.

3. **Archive the feature** — Move the feature folder:
   - Create `specs/archive/` if it doesn't exist.
   - Move `specs/$ARGUMENTS/` to `specs/archive/YYYY-MM-DD-$ARGUMENTS/` (using today's date).

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
- **Next**: Feature closed. Ready for next /new-feature.
- **Risks**: [any concerns about merged deltas, or "None"]
```

## Rules
- **NEVER use Plan Mode**: Do NOT use `EnterPlanMode`. Write files directly. Plan Mode breaks the SDD pipeline.
- **Never archive without a passing review** — require PASS or PASS WITH WARNINGS from `/review-feature`.
- **Never archive with unchecked tasks** — all tasks must be complete or explicitly removed.
- Preserve the full history: don't delete `decisions.md` content, just add the merge note.
- The merged `spec.md` in the archive should reflect the final state of requirements.
- Always output the result envelope at the end.
