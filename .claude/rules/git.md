# Git conventions

<!-- TODO: Run /init-project to auto-detect these from your codebase -->

## Agent rules
- **Create a branch** when starting `/implement-task` (e.g., `feature/NNN-description`).
- **Never commit or push.** Leave all changes unstaged for manual review.
- The human handles commits, merges, and PRs.

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

## Release / Rollout
<!-- e.g. Docker, Kubernetes, Vercel, etc. -->
