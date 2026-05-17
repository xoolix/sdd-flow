# Quick Spec: bin/sdd status [feature-id]

<!-- Fast-lane: enhancement / refactor / small change.
     Constraints: single-domain, no new dependencies, ≤2 GWT acceptance criteria.
     Combined spec + plan + tasks artifact. Word budget: ≤900 words. -->

## Summary

Add a `status` subcommand to `bin/sdd` that emits a JSON object describing the current SDD state of a feature: phase, task counts, sentinel freshness, and blockers. Devs on a 10-person team can run one command instead of reading `spec.md`, `plan.md`, `tasks.md`, and `decisions.md` by hand. Supports both explicit feature-id arg and auto-resolution from the current branch name.

## Trigger

Manual invocation (`sdd status [feature-id]`) by a developer in their terminal, or by a script/CI pipeline reading stdout. Designed for machine-readable use from day one.

## Happy Path

1. Dev runs `sdd status 012-sdd-status-json` (or `sdd status` on branch `feature/012-sdd-status-json`).
2. Command resolves feature-id: arg takes priority; if absent, parse current branch with `git branch --show-current` against pattern `feature/NNN-...`.
3. Locate feature folder: check `specs/<id>/` then `specs/archive/<date>-<id>/`.
4. Determine phase using the detection table (see Approach).
5. Parse `tasks.md` (or `quick-spec.md ## Tasks` section) for `[x]` / `[ ]` counts.
6. Check `.simplified` sentinel: exists AND `git-head:` line equals `git rev-parse HEAD`.
7. Collect blockers array (empty when none).
8. Emit JSON to stdout, exit 0.

## Acceptance Criteria

- [x] Given a feature folder exists under `specs/<feature-id>/`, When the user runs `sdd status <feature-id>`, Then the command exits 0 and emits valid JSON to stdout containing `feature_id`, `phase` (one of the seven defined enum values: `missing`, `spec`, `planned`, `implementing`, `ready-to-simplify`, `ready-to-review`, `archived`), `tasks_total`, `tasks_remaining`, `sentinel_fresh`, `blockers` (array, never null), and `next_command`.
- [x] Given the user is on a branch matching `feature/NNN-...` with no feature-id arg, When the user runs `sdd status`, Then the command resolves the feature-id from the branch name and emits the same JSON shape with exit 0; if the branch does not match the pattern, the command emits `error: not on a feature branch` to stderr and exits 1.

## Rollback Plan

- `git revert <commit>` — the command is purely additive (new subcommand only); reverting the commit restores `bin/sdd` to its prior state with no side effects, migrations, or cleanup needed.

## Success Criterion

- `sdd status <id>` against a feature folder in each of the seven phase states exits 0 and returns parseable JSON with the correct `phase` value; `sdd status` on a `feature/NNN-...` branch resolves the ID and emits the same shape; invocation with no arg on a non-matching branch, or with a non-existent feature-id, emits a one-line stderr message and exits 1.

---

## Plan

### Touched files

- `bin/sdd` — add `status` subcommand (bash, no new deps)

### Approach

- Add `status` to the `case "$1"` dispatch block in `bin/sdd`, following the same shell style as the existing `update` subcommand.
- **Feature-id resolution**:
  - If arg provided → use it directly.
  - Else → `git branch --show-current`, match `^feature/([0-9]{3}-.+)$`, extract capture group; exit 1 with stderr if no match.
- **Folder lookup**: check `specs/<id>/` first; if absent, scan `specs/archive/` for `*-<id>` (glob). If neither found → stderr + exit 1.
- **Phase detection** (pure bash, evaluated top-to-bottom):

| Condition | `phase` value |
|---|---|
| folder under `specs/archive/` | `"archived"` |
| no `spec.md` and no `quick-spec.md` | `"missing"` |
| no `plan.md` or no `tasks.md` (and not fast-lane) | `"spec"` |
| has tasks file, 0 tasks checked | `"planned"` |
| has tasks file, some checked, not all | `"implementing"` |
| all checked, sentinel not fresh | `"ready-to-simplify"` |
| all checked, sentinel fresh | `"ready-to-review"` |

  - Fast-lane: `quick-spec.md` serves as both spec and tasks file; `plan.md`/`tasks.md` absence is not a blocker.
  - `"ready-to-archive"` heuristic: deferred to v2 (YAGNI — decisions.md parsing is fragile).
- **Task counting**: grep `tasks.md` for `- [x]` (done) and `- [ ]` (remaining); for fast-lane features, grep the `## Tasks` section of `quick-spec.md` instead.
- **Sentinel freshness**: `[ -f specs/<id>/.simplified ] && grep -q "^git-head: $(git rev-parse HEAD)" specs/<id>/.simplified`.
- **JSON emission**: bash heredoc with variable interpolation — no `jq`, no external tools.
- **Exit codes**: 0 = success, 1 = feature not found / branch mismatch, 2 = usage error.
- **Stderr**: one-line messages prefixed `error:` for all error cases.

### Test strategy

- Unit: none (bash script, no test harness in project)
- Manual: run `sdd status` against fixture folders representing each phase state; verify JSON shape, exit codes, stderr messages, and branch-resolution behavior

---

## Tasks

- [x] Add `status` to the help/usage text in `bin/sdd`
- [x] Implement feature-id resolution (arg → branch parse → exit 1)
- [x] Implement folder lookup (`specs/<id>/` then `specs/archive/*-<id>`)
- [x] Implement phase detection logic (8 states, top-to-bottom evaluation)
- [x] Implement task counting (grep `tasks.md`; fallback to `quick-spec.md ## Tasks` for fast-lane)
- [x] Implement sentinel freshness check
- [x] Implement JSON emission via heredoc (all 7 fields)
- [x] Manual smoke test against each phase state; verify exit codes and stderr
