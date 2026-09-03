---
name: chained-pr
description: Split an oversized change into stacked PRs a reviewer can hold. Trigger: a diff past ~400 lines, stacked branches, or a feature that must integrate before reaching the trunk.
---

# Chained PRs

> Adapted from [gentle-ai](https://github.com/Gentleman-Programming/gentle-ai)'s `chained-pr` skill
> (Apache-2.0, © gentleman-programming). Their label-based exception mechanism is theirs; the base
> resolution below is this repo's.

## When to use

- A prospective PR is past **~400 changed lines** (additions + deletions).
- Branches are already stacked and you need to decide what each PR targets.
- A feature must land as a whole but should be reviewed in pieces.

## Budget

**~400 changed lines, or about 60 minutes of review, whichever comes first.** Past that, reviewers stop
reading and start approving. Generated files, vendored code and migrations are honest exceptions —
say so in the body instead of pretending the diff is small.

## Choosing a shape

| Situation | Shape |
|---|---|
| Under budget and focused | One PR. Don't manufacture a chain. |
| Over budget, each slice lands independently | **Stacked PRs**, each targeting the trunk in order |
| Over budget, the feature must integrate before the trunk | **Tracker chain**: a draft tracker branch, first child targets the tracker, each later child targets its immediate parent |
| Diff genuinely cannot be split | Keep it whole and justify the size in the body |

Pick one shape and stay in it. Mixing them produces diffs nobody can read.

## Base resolution — the part that goes wrong

Each PR's base comes from `sdd base-branch <feature-id>`, which reads the `.parent-branch` sidecar
written by `sdd branch`. **Verify it before opening each PR.** When a feature branch is created from
another feature branch, `sdd branch` records that parent and warns you on stderr — that warning is the
signal you are building a chain, whether or not you meant to.

A wrong base is the classic failure here: the PR shows a diff containing the parent's work, and the
reviewer either reviews it twice or approves it blind.

## Every PR in a chain must disclose

- **Where it starts and ends** — the scope boundary in one sentence.
- **What it depends on** — the PRs that must merge first.
- **What comes after** — the follow-ups, so the reviewer knows what they are *not* seeing.
- **What is deliberately excluded**, and why.
- **A position marker** in the chain, with the current PR marked 📍:

```
integration/foo  ←  feature/024-…  ←  feature/025-…  📍
```

## Rules

- One deliverable per PR — same unit as `work-unit-commits`, one level up.
- Tests and docs travel with their code, in the same PR.
- A tracker PR stays **draft / do-not-merge** until every child is approved.
- If a diff is polluted with a parent's work, fix the base — rebase or retarget. Do not explain it away
  in the body.
- The human opens the PRs. Nothing here pushes.

## Commands

```bash
sdd base-branch <feature-id>                      # the base this PR must target
git log --oneline <base>..HEAD                    # what this PR actually contains
git diff --shortstat <base>..HEAD                 # the review budget
git branch --no-merged <base>                     # other branches in flight
```
