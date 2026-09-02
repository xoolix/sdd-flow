---
name: branch-pr
description: Write the PR body a reviewer actually needs. Trigger: opening a pull request, or drafting its description after `/archive-feature` prints the gate commands.
---

# Branch & PR

> Adapted from [gentle-ai](https://github.com/Gentleman-Programming/gentle-ai)'s `branch-pr` skill
> (Apache-2.0, © gentleman-programming). Their version encodes their own repo's CI, labels and Go
> tooling; what is portable is the shape of a good PR body and the discipline around it. The branch
> and base-branch mechanics below are this repo's.

## Why this skill exists

Feature 024 removed the CLI's ability to generate a PR body, and ADR 0004 (`docs/adr/`, "the CLI does
not open PRs") recorded why: the generated body was **worse than the hand-written one**, because what a reviewer
needs — what changed, what was descoped, what risk remains — does not exist in any artifact in a form
you can concatenate. The generated body for one feature was 48,757 characters, 74% of GitHub's limit,
mostly internal review history. The hand-written one was 3,474.

That finding is still true. A skill is the right answer to it and code was the wrong one: **this does
not generate anything.** It tells you what to write.

## The gate is human

`/archive-feature` prints two commands and stops:

```
git push -u origin HEAD
gh pr create --draft --base <base>
```

A person runs them. Nothing in this repo pushes or opens a PR on its own.

## Branch and base

- Branches are created by `sdd branch <feature-id>` and are named `feature/<feature-id>`. Do not
  `git checkout -b` by hand — the CLI is the only git-write path ([ADR 0002](../../../docs/adr/0002-sdd-git-write-boundary.md)),
  and `commit-slice` refuses (exit 4) if the current branch is not the feature's.
- **The base comes from `sdd base-branch <feature-id>`**, never from a guess and never from the repo
  default. It resolves the `.parent-branch` sidecar first, then `git.md`, then autodetect. If it
  returns something surprising, stop and find out why before opening the PR — a PR opened against the
  wrong base shows a diff that is not your work.

## PR body — what a reviewer needs, in order

1. **What changed**, in two or three sentences. The outcome, not the file list.
2. **Why**, if it is not obvious from the title.
3. **What was descoped**, and why. This is the part people omit and reviewers most need.
4. **Risk that remains** — known-open findings, accepted trade-offs, anything a reviewer should not
   assume you handled.
5. **How to verify** — the exact command, and the result you got.
6. **Links**: the issue it closes, and the spec or ADR it implements.

Keep it to what a reviewer reads before looking at the diff. If the body is longer than the diff is
interesting, you are pasting history instead of writing a summary.

## Hard rules

- **No AI attribution.** No `Co-Authored-By` trailers, no "generated with" footers, in commits or in PR
  bodies. (Upstream has the same rule.)
- **Never force-push** a shared branch.
- **Do not open the PR yourself** unless the human asked in this conversation. Pushing is outward-facing.
- Everything the body claims about behaviour must have been executed, not inferred.

## Before opening

- [ ] Base confirmed with `sdd base-branch`, and the diff against it is only your work.
- [ ] Full suite run, with the actual number in the body.
- [ ] Descoped work and residual risk named.
- [ ] No AI attribution anywhere.
- [ ] Diff is under ~400 changed lines, or the body says why it isn't — see `chained-pr`.
