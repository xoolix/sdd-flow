# Fix Spec: sdd update — prune orphan agent files

## Summary

`bin/sdd update` only adds/overwrites upstream `sdd-*.md` agent files; it never deletes
project-side files that no longer exist upstream. After feature 015 removed
`sdd-plan-feature.md` and `sdd-review-feature.md` from SDD_HOME, repos that ran
`sdd update` kept stale copies. These orphans violate the feature-015 orchestrator-vs-executor
invariant (orchestrator skills must NOT have a corresponding agent file), causing `/sdd-next`
to ESCALATE. The fix adds a prune pass to `cmd_update` and an orphan-detection check to
`cmd_doctor`.

## Trigger

User runs `bin/sdd update` in a project installed before feature 015 (or any future SDD
release that deletes agent files). Orphaned `sdd-*.md` files remain in
`.claude/agents/` indefinitely.

## Current Behavior

- `cmd_update` iterates `$SDD_HOME/.claude/agents/sdd-*.md` — only adds/overwrites.
- Files deleted from upstream are never removed from the project.
- `cmd_doctor` does not detect orphaned `sdd-*.md` agent files.
- Log line reads: `"Agents: N added, N updated, N unchanged"` — no pruned count.

## Expected Behavior

- `cmd_update` iterates project `.claude/agents/sdd-*.md` files; any not present in
  `$SDD_HOME/.claude/agents/` are removed and logged (`Pruned: sdd-X.md`).
- Log summary extended: `"Agents: N added, N updated, N unchanged, N pruned"`.
- `cmd_doctor` iterates `.claude/agents/sdd-*.md`; any not present upstream are flagged:
  `"WARN: .claude/agents/sdd-X.md — orphan (not in upstream). Run 'sdd update' to remove."`.

## Unchanged Behavior

- Project-local agent files (`.claude/agents/*.md` NOT matching `sdd-*.md`) are never
  touched by `cmd_update` or flagged by `cmd_doctor`.
- The `cmp -s` add/update logic for files that DO exist upstream is unchanged.
- `--copy` install behavior (templates, CLAUDE.md handling) is unaffected.
- `cmd_update` exit code semantics are unchanged (0 on success, non-zero on error).

## Acceptance Criteria

- [ ] Given a project with `.claude/agents/sdd-plan-feature.md` that is absent from
  `$SDD_HOME/.claude/agents/`, when the user runs `bin/sdd update`, then the file is
  deleted from the project and the run output includes "Pruned: sdd-plan-feature.md".
- [ ] Given the same stale project, when the user runs `bin/sdd doctor`, then the output
  includes a WARN line referencing `.claude/agents/sdd-plan-feature.md` as an orphan with
  the remediation `run 'sdd update' to remove`.

## Rollback Plan

- `git revert <commit>` on the `bin/sdd` change, or `git checkout main -- bin/sdd`.
- No state migration needed — change is purely behavioral (no persisted data altered).

## Success Criterion

After deploying the fix, running `bin/sdd update` on the repo that triggered the original
ESCALATE cleanly removes `.claude/agents/sdd-plan-feature.md` and
`sdd-review-feature.md`; a follow-up `/sdd-next` no longer ESCALATEs on the
orchestrator-invariant check.

---

## Plan

### Root cause

`cmd_update`'s agent-sync loop (`for agent_file in "$SDD_HOME/.claude/agents"/sdd-*.md`)
iterates **upstream** files only. It has no mechanism to discover project-side `sdd-*.md`
files that have no upstream counterpart. When upstream deletes a file, the project copy
becomes a permanent orphan.

### Touched files

- `bin/sdd` — `cmd_update` (add prune pass after existing sync loop) and `cmd_doctor`
  (add orphan-detection block in the agents section).

### Fix description

**`cmd_update` — prune pass** (insert after the existing agent sync loop, before the
`log "Agents: …"` line):

1. Iterate `.claude/agents/sdd-*.md` in the **project** directory.
2. For each file, check if the same basename exists in `$SDD_HOME/.claude/agents/`.
3. If not found upstream → `rm` the file, log `"Pruned: $agent_name"`, increment
   a `pruned` counter.
4. Extend the summary log line with `, $pruned pruned`.

**`cmd_doctor` — orphan check** (add after the existing agents block or as a new sub-section):

1. If `.claude/agents/` exists in the project, iterate `sdd-*.md` files there.
2. For each, check if the same basename exists upstream.
3. If not → `warn "  .claude/agents/$agent_name — orphan (not in upstream). Run 'sdd update' to remove."` and increment `issues`.

### Test strategy

- Unit (must reproduce bug before fix, pass after): In a temp dir, create
  `.claude/agents/sdd-plan-feature.md` (simulating stale install). With `SDD_HOME`
  pointing to a dir that does NOT contain `sdd-plan-feature.md`, run `cmd_update` and
  assert: (a) file is gone, (b) stdout contains "Pruned: sdd-plan-feature.md".
- Manual: Clone a pre-015 project snapshot, run `sdd update`, verify orphan removal and
  absence of ESCALATE on `/sdd-next`.

---

## Tasks

- [x] Add prune pass to `cmd_update` in `bin/sdd`: after the upstream-sync loop, iterate
  project `.claude/agents/sdd-*.md`; delete any not present in `$SDD_HOME/.claude/agents/`;
  log each deletion and add a `pruned` counter to the summary line.
- [x] Add orphan-detection block to `cmd_doctor` in `bin/sdd`: iterate project
  `.claude/agents/sdd-*.md`; warn on any not present upstream with remediation message;
  increment `issues` counter.
- [x] Validate: run the unit test scenario (temp dir with stale agent + mismatched SDD_HOME)
  and confirm both `cmd_update` prune and `cmd_doctor` warn behave as specified.
