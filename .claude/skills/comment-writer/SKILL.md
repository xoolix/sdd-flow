---
name: comment-writer
description: Draft review comments, PR feedback and issue replies that read like a teammate. Trigger: writing a review comment, replying to feedback, or commenting on a PR or issue.
---

# Comment writer

> Adapted from [gentle-ai](https://github.com/Gentleman-Programming/gentle-ai)'s `comment-writer`
> skill (Apache-2.0, © gentleman-programming). The voice rules are theirs; the language convention
> below is this project's and **overrides** their default.

## When to use

Any text written for another person in a collaboration surface: PR review comments, replies to
feedback, issue comments, or an async update.

## Voice

| Rule | What it means |
|---|---|
| **Useful first** | Open with the actionable point. Do not recap the PR before saying the thing. |
| **Warm and direct** | A thoughtful colleague, not a bot and not a critic. |
| **Short** | One to three short paragraphs, or a tight list. |
| **Say why** | Every requested change carries its technical reason. A request without a reason reads as taste. |
| **No pile-ons** | Comment on the highest-value issue. Listing every small preference buries the one that matters. |
| **Claim only what you checked** | "I ran it and it exits 2" beats "this looks like it might fail". If you inferred it, say you inferred it. |

## Language

**Write in the language of the thread.** For this project's Spanish-language surfaces the register is
**voseo, close and first-person** — the way you would talk to a colleague you respect, not corporate
neutral and never "usted". This deliberately departs from the upstream skill, which defaults Spanish to
neutral/professional; that default is wrong here.

## Shape

**Observation or request → the reason → the concrete next step.**

Three shapes cover most comments:

- **Asking for a change** — name what you'd change, why it matters, and what "done" looks like.
- **Approving with a note** — approve clearly, then the one thing worth carrying into the next round.
  Do not bury an approval under caveats.
- **Asking for a split** — say what the reviewer can't hold, and propose the seam. See `chained-pr`.

## Commands

```bash
gh pr view <N> --json title,body,additions,deletions,changedFiles
gh pr diff <N> --stat
```
