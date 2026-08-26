# ADR 0002: bin/sdd as the Git-Write Boundary

## Status
Accepted (2026-08-20)

## Context

Since the framework's inception, `.claude/rules/git.md` has declared:

> **Never commit or push.** Leave all changes unstaged for manual review.
> The human handles commits, merges, and PRs.

That rule was a safety measure from a time when agent edits were not trusted. Three
things have changed since:

1. **`/implement-task` now has a hard validation gate.** A vertical slice is only marked
   `[x]` after lint, typecheck, and tests pass (`sdd-implement-task.md`, step 5, with 3
   inline fix attempts before blocking). The moment a slice completes is, by construction,
   a green tree — the natural commit point.

2. **The never-commit rule silently broke `/simplify-code`.** Its canonical scope is
   `git diff --name-only <base-sha>..HEAD` (`sdd-simplify-code.md`, step 2) — the
   *committed* diff. Under never-commit that diff is always empty, so the phase found
   nothing to simplify on every run since it shipped. The policy did not merely constrain
   the pipeline; it disabled a phase.

3. **The policy was never enforceable anyway.** It lived only as prose in a rules file.
   Nothing prevented an agent from committing; nothing verified it hadn't.

The obvious fix — "tell the agents to commit" — reproduces problem 3 in reverse. Git
writes are destructive and hard to reverse, and the riskiest failure is not a bad commit
message but a `git add -A` that sweeps unrelated work: parallel features in flight,
gitignored sidecars, a human's half-finished edit. A markdown instruction that says
"don't use `git add -A`" is a suggestion to a sonnet-tier model across three separate
agent files, with no test that can prove it held.

## Decision

**Git writes move from agent prose into `bin/sdd` subcommands.** The SDD pipeline commits
during development, and every commit goes through the CLI — agents never call `git commit`
directly.

Concretely:

- A new subcommand stages an explicit file list plus `specs/<feature-id>/`, and **refuses
  to run without one**. There is no path through the CLI that reaches `git add -A`.
- The same boundary owns the message format, the branch guard, and the refusal to push.
- `/implement-task` commits one commit per vertical slice, after validations pass.
  `/simplify-code` and the review fix loop commit their own work, which is what makes the
  committed-diff scope meaningful for the first time.
- **Nothing is pushed during development.** The branch stays local until the human
  confirms the PR gate; only then does the pipeline push and open a draft PR.
- The behavior is opt-out via an `auto-commit:` knob in `.claude/rules/git.md`, defaulting
  to on — the same declarative-knob pattern already used by `tdd: strict|off` in
  `.claude/rules/testing.md`.

The rationale for the CLI boundary is testability. `tests/sdd.test.js` already exercises
`bin/sdd` against throwaway git repositories via `execFileSync` (`makeTempProject`), so
"the pipeline never sweeps unrelated files" becomes an assertion that runs in CI rather
than a hope about prompt adherence.

## Alternatives considered

1. **Inline `git` calls in each agent's markdown.** No new CLI surface, no contract to
   maintain. Rejected: the one guarantee that actually matters — explicit staging — would
   be duplicated as prose across `sdd-implement-task.md`, `sdd-simplify-code.md`, and
   `sdd-archive-feature.md`, verifiable only by asserting the text exists, not that the
   behavior holds.

2. **Keep never-commit; special-case `/simplify-code`'s scope to read the working tree.**
   Rejected: patches the symptom. The committed diff is the correct scope for a phase whose
   job is "clean up what this feature changed"; the bug is that nothing was ever committed.

3. **Commit once at the end of the feature.** A single tidy commit, no history churn.
   Rejected: leaves `/simplify-code` broken (the diff is still empty while it runs) and
   discards per-slice rollback points, which is the main practical benefit of committing
   at a known-green moment.

4. **Push each commit as it lands**, for remote backup and early CI. Rejected by the user
   in favor of maximum control: nothing leaves the machine before the gate.

5. **Auto-open the PR when review passes.** Rejected: opening a PR is outward-facing and
   notifies people. It stays behind an explicit human confirmation, and even then opens as
   a draft.

## Consequences

**Positive**:
- `/simplify-code` gets a non-empty scope for the first time — a latent phase becomes real.
- Rollback granularity matches the task graph: one commit per slice, each at a green tree.
- The staging guarantee is enforced by code and covered by tests, not by prompt discipline.
- Review fix cycles become legible in history instead of being smeared into the working tree.

**Negative / Trade-offs**:
- New CLI surface to version and maintain; agents now depend on `bin/sdd` being deployed,
  not just on their own markdown.
- History is noisier than a hand-curated branch. Squash-on-merge is the mitigation, and
  the draft PR is where that choice gets made.
- Commits are only as well-scoped as the file list the agent passes. A forgotten file lands
  in the *next* slice's commit rather than being lost, but the intermediate commit can be
  red even though the working tree was green.
- The `.simplified` sentinel stores `git-head: <SHA>` and is validated against
  `git rev-parse HEAD` (`bin/sdd`, `cmd_status`). Any commit written after the sentinel
  invalidates it, so commit-then-write-sentinel ordering is now load-bearing — see the
  feature spec's edge cases.

**Operational**:
- Repos that pull this via `bin/sdd update` change behavior on their next `/implement-task`.
  The `auto-commit: off` knob in `.claude/rules/git.md` is the escape hatch, and `git.md`
  is a per-project file that `bin/sdd update` does not overwrite.
- `.claude/rules/git.md` stops being the enforcement point and becomes configuration; the
  enforcement moves to `bin/sdd`.

## References
- Spec: `specs/020-commit-per-slice-pr-gate/spec.md`
- Clarify: `specs/020-commit-per-slice-pr-gate/clarify.md`
- Prior policy: `.claude/rules/git.md` (§ Agent rules, pre-020)
- Broken-scope evidence: `.claude/agents/sdd-simplify-code.md` step 2
- Knob precedent: `.claude/rules/testing.md` (`tdd: strict|off`)
- Test infrastructure: `tests/sdd.test.js` (`makeTempProject`)
