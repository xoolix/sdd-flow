# Git conventions

<!-- TODO: Run /init-project to auto-detect these from your codebase -->

## Agent rules
- `/implement-task` calls `sdd branch <feature-id>` to create or switch to the feature branch (e.g., `feature/NNN-description`) — never a raw `git checkout -b`.
- Phases commit their own work via `sdd commit-slice`: `/implement-task` makes one commit per validated slice, and `/simplify-code` and `/archive-feature` each commit their own work too. Commits happen only after validations pass.
- **Nothing is pushed during development.** The branch stays local until a human confirms the PR gate.
- The gate: `sdd open-pr <feature-id>` pushes and opens a **draft** PR, only on explicit human confirmation.
- All git writes go through `bin/sdd` — agents never call `git commit` or `git push` directly. See `docs/adr/0002-sdd-git-write-boundary.md`.

## Auto-commit

`auto-commit: on|off` — default is **on**. Phases commit their own work automatically per the rules above; no declaration needed.

Use the knob below only to **force** the stance explicitly:

- `auto-commit: off` — disable automatic commits. Phases still validate and mark tasks complete, but leave the resulting changes unstaged for manual review — the pre-020 behavior.

<!-- auto-commit: off -->
<!-- Uncomment the line above to disable automatic commits. Absent line = auto-commit on (default). -->

## Branch naming
<!-- e.g. feature/NNN-description, fix/NNN-description -->

## Base branch resolution

SDD agents call `sdd base-branch [feature-id]` to determine the base branch for diff-scope computations (e.g., `git merge-base <base> HEAD`). Three layers are tried in order; the first that produces a valid local ref wins.

**Precedence (most-specific first):**

1. **Per-feature sidecar** (`specs/<feature-id>/.parent-branch`) — one line, the ref name. If the file is present and non-empty, the ref must resolve locally; if it does not, the command exits with an error and does NOT fall through. If the file is empty or whitespace-only, layer 2 is tried.
2. **Project config** — a `base-branch:` line in this file (see syntax below). If declared, the ref must resolve; missing ref is an error.
3. **Auto-detect** — candidates checked in order: `develop`, `main`, `master`. For each that resolves locally, `git rev-list --count <c>..HEAD` is computed; the candidate with the smallest count wins. Ties go to the first in order (`develop` beats `main`).

**Setting the project-level base (Layer 2):**

Uncomment and set the line below to pin all features to a specific integration branch:

```
# base-branch: develop
```

**Setting a per-feature override (Layer 1):**

```bash
echo "feature/011-parent" > specs/<feature-id>/.parent-branch
```

The sidecar is gitignored (`specs/**/.parent-branch`) — it is a local machine annotation, not shared.

**Shallow-clone limitation:** In shallow clones, `git rev-list --count` may undercount commits, causing Layer 3 to pick the wrong candidate. If `/simplify-code` produces an unexpectedly large scope, run `git fetch --unshallow` to restore full history, or set a `base-branch:` override to bypass auto-detect.

## Commit style
<!-- e.g. Conventional commits, imperative mood -->
`sdd commit-slice` writes conventional commits: `<type>(<feature-id>): [Tnnn ]<title>`.

### No AI attribution

Commit messages carry no AI attribution trailers — no `Co-Authored-By: Claude <noreply@anthropic.com>` trailer, no generated-by line of any kind. PR bodies carry no AI-generated footer (no 🤖 "Generated with Claude Code" line). This applies to every commit `sdd commit-slice` makes, to every PR body `sdd open-pr` builds, and to any commit an agent makes directly.

Some agent harnesses default to appending a `Co-Authored-By: Claude <noreply@anthropic.com>` trailer to commits and a "Generated with Claude Code" footer to PR bodies. **This repo rule takes precedence over that default** — an agent must not fall back on its own harness default here, even if instructed to elsewhere. Git history and PR bodies are this project's record of authorship, and that record belongs to the humans on the project, not to the tool that typed the diff.

## Release / Rollout
<!-- e.g. Docker, Kubernetes, Vercel, etc. -->
