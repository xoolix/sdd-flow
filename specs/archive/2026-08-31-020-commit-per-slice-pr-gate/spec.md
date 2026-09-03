# Feature: Commit per slice + human PR gate

## Summary
The pipeline commits during development instead of leaving work unstaged: one commit per validated slice, plus commits from `/simplify-code`, the review fix loop, and `/archive-feature`. Nothing is pushed until a human confirms a gate that opens a draft PR. All git writes go through `bin/sdd` (ADR 0002).

## Trigger
Any SDD phase completing work on a feature branch, unless `git.md` declares `auto-commit: off`.

## Happy Path
1. `/implement-task` creates `feature/NNN-*` if not on it.
2. Slice runs; validations pass (existing step-5 gate); task marked `[x]`.
3. Agent calls `sdd commit-slice`; CLI stages the named paths plus `specs/NNN-*/` and commits. No push.
4. Repeat per slice. `/simplify-code` commits, **then** writes `.simplified` with the new HEAD.
5. `/review-feature` passes; `/archive-feature` merges deltas, moves the folder, commits.
6. `sdd status` reports `ready-to-pr`; `sdd-next` asks the human to confirm.
7. On confirm: pre-flight `gh auth status` + remote, then push and `gh pr create --draft`; URL written to `.pr-opened`.

## Domains
- [x] Infrastructure / deploy — new `bin/sdd` subcommands
- [x] Other: 4 agents (implement-task, simplify-code, archive-feature, task-planner), 2 orchestrator skills, `git.md`, `CLAUDE.md`, `tasks-template.md`, tests, `.gitignore`

## API Changes
| Surface | Contract |
|---|---|
| `sdd commit-slice <id> --task Tnnn --files <p>…` | Stages listed paths **plus** the derived feature directory (`specs/<id>` if it exists; else `find specs/archive -maxdepth 1 -type d -name "*-<id>"`); commits as `<type>(<id>): Tnnn <title>`. Exits ≠0 without `--files`. Never pushes, never `git add -A`. |
| `sdd open-pr <id>` | Pre-flight: `gh auth status` and remote existence. If OK: push, `gh pr create --draft` with title/body built from `spec.md` (Summary + Acceptance Criteria + Rollback Plan) and `decisions.md` in the derived feature dir; write `.pr-opened` with URL. If pre-flight fails: print manual command, exit non-zero, do not write `.pr-opened`. |
| `sdd status <id>` | New phase `ready-to-pr` when archived and `.pr-opened` absent; `archived` now requires the sentinel. Additive. |
| `git.md` | New `auto-commit: on\|off`, default **on** when absent. Mirrors `tdd:` in `testing.md`. |
| `tasks.md` slice metadata | New `type:` field (`feat`/`fix`/`refactor`/`chore`/`docs`) beside `blocked_by`/`verifies`/`touches`, written by `sdd-task-planner`. |

## Edge Cases
| Case | Behavior |
|---|---|
| Commit fails after green validations (hook, gpgsign, unset `user.email`) | Revert `[x]` → `[ ]`, return `Status: blocked` with stderr. Preserves *task complete ⟹ commit exists*, which `/simplify-code`'s scope needs. |
| Unrelated dirty files in tree | Never staged — only `--files` plus the derived feature directory. |
| Sentinel self-invalidation | `.simplified` stores `git-head:` checked against `HEAD`. Commit first, sentinel after; add `.simplified` to `.gitignore`. Reverse order loops `/simplify-code`. |
| `gh` missing / unauthenticated / no remote | Nothing pushed, manual command printed, `.pr-opened` not written — gate stays resumable. |
| PR already open for the branch | Report its URL, write the sentinel. |
| `.pr-opened` and feature archival | `.pr-opened` is written AFTER `gh pr create` succeeds, so it cannot be committed into the PR it records. It remains an uncommitted tracked file unless a later push commits it. Archive does not include it in the initial open-PR commit; the file is present but untracked from the PR's perspective. |
| `sdd-auto` reaches the gate | Must stop; its "never ask for confirmation" rule needs a carve-out in both orchestrators. |

## Acceptance Criteria
- [ ] Given `auto-commit` on and a slice `T00N` whose validations pass, When `/implement-task` completes it, Then exactly one new commit exists with message `<type>(NNN): T00N <title>` and no upstream ref advanced.
- [ ] Given unrelated dirty files, When `sdd commit-slice --files a.js` runs, Then the commit contains `a.js` and `specs/NNN-*/` and none of the unrelated files.
- [ ] Given `sdd commit-slice` invoked without `--files`, When it runs, Then it exits non-zero and creates no commit.
- [ ] Given a slice that validated green but whose commit fails, When `/implement-task` returns, Then the task is `- [ ]` and the envelope is `Status: blocked` including the stderr.
- [ ] Given an archived feature without `.pr-opened`, When `sdd status <id>` runs, Then `phase` is `ready-to-pr` and `next_command` offers the gate.
- [ ] Given the gate confirmed with `gh` unauthenticated or no remote, When it runs, Then nothing is pushed, the manual command is printed, and `.pr-opened` does not exist.

## Rollback Plan
- `auto-commit: off` in `git.md` disables commits and gate without touching agents; `git.md` is per-project and `bin/sdd update` does not overwrite it.
- Existing commits are ordinary commits, not undone automatically.

## Success Criteria
- `/simplify-code` reports a non-empty `Files-Simplified` on at least one real run — currently **always** `none` because the committed diff is empty.
- Zero unrelated files in generated commits, measured during the `[HITL]` dogfood run.

## Migration Notes

### Existing SDD Projects
When updating an existing SDD project from pre-020 to 020+, the new agents commit by default but `git.md` from the pre-020 copy still states "Never commit or push". This is a contradiction:
- `cmd_init` copies `.claude/rules/*.md` from SDD_HOME but skips files that already exist.
- `cmd_update` never touches `.claude/rules/`.
- Result: existing projects ship new agents (symlinked, auto-commit) with stale policies that forbid it.

**Remediation**: Manual update of `git.md` in the project to add the `## Auto-commit` section with `auto-commit: off` (to preserve old behavior) or leave it default-on (to adopt the new behavior). A future feature should add automated detection via `sdd doctor`.

## Open Questions
- None.
