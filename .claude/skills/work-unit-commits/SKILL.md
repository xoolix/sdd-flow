---
name: work-unit-commits
description: Decide what belongs in one commit. Trigger: splitting an implementation, preparing a slice, or choosing the --files list for `sdd commit-slice`.
---

# Work-unit commits

> Adapted from [gentle-ai](https://github.com/Gentleman-Programming/gentle-ai)'s `work-unit-commits`
> skill (Apache-2.0, © gentleman-programming). The judgment is theirs; the mechanism it plugs into —
> `sdd commit-slice` — is this repo's.

## When to use

Whenever you are about to call `sdd commit-slice` and have to decide what goes in `--files`. Also when
a slice is growing past what one reviewer can hold, or when a feature should become stacked PRs.

## The division of labour, and why it matters here

`sdd commit-slice` **enforces** completeness — it refuses (exit 2) when a new file you created is not
declared, refuses a malformed feature-id, and refuses (exit 4) when you are on the wrong branch. What
it cannot do is tell you whether the files you declared are *a coherent unit*. That judgment is this
skill. The CLI stops you from committing a broken slice; this stops you from committing a confusing one.

## Rules

- **One deliverable per commit** — a behavior, a fix, a migration, a docs unit. Never group by file type.
- **The repo must still work with only this commit applied.** If it doesn't, the unit is cut wrong.
- **Tests travel with the code they test.** Docs travel with the user-facing change they describe.
- **Name the rollback boundary**: reverting this commit alone must remove exactly one thing and leave
  unrelated work standing.
- **The message states the outcome, not the file list.** `git show --stat` already lists the files.
- **~400 changed lines (additions + deletions) is the ceiling** for one reviewable unit. Past that,
  split — see the `chained-pr` skill. Generated files, vendored code and migrations are the honest
  exceptions; say so in the PR body rather than pretending the diff is small.

## Before you commit

- [ ] One purpose, statable in one sentence without "and".
- [ ] Repo functional with this commit alone.
- [ ] Tests and docs for this unit included.
- [ ] Every file you created is in `--files` — `commit-slice` will reject the slice otherwise, which is
      the point: an omitted new file is how a green suite ships a broken branch.
- [ ] Rollback boundary is nameable.
- [ ] Message explains the outcome.

## Splitting badly vs. well

Bad: one commit for models, one for services, one for tests. Each is unreviewable alone and none of
them works alone.

Good: `feat(auth): token validation model and its tests` — the model and the proof it works, together.

## Commands

```bash
git diff --stat                 # what is currently uncommitted
git diff --cached --stat        # what is staged
git log --oneline -5            # the convention this branch is already using
sdd commit-slice <feature-id> --type <t> --title "<s>" --files <paths...>
```
