# Technical Plan

## Inputs
- Spec: `specs/016-base-branch-resolution/spec.md`
- Clarifications: intake locked 3-file domain; out-of-scope items grep-verified.
- Research: feature 011 SPEC-GAP medium (hardcoded `main`); feature 012 simplify regression (39-file scope).

## Domain analysis (overall: SMALL)

| Domain | Scope | Complexity |
|---|---|---|
| SDD CLI | `bin/sdd` — new `cmd_base_branch` + dispatch + usage | SMALL |
| SDD agent | `.claude/agents/sdd-simplify-code.md` — pre-flight + step 3.1 | SMALL |
| SDD config | `.claude/rules/git.md` — new "Base branch resolution" section | SMALL |

Strategy: sequential tasks, no checkpointing.

## Current state
- `bin/sdd` dispatches `init|update|doctor|status|help`. No resolver.
- `sdd-simplify-code.md` step 3.1 calls `git merge-base main HEAD` (fallback `origin/main`); wrong scope on Git Flow / non-`main` parents.
- `.claude/rules/git.md` is the project's git-conventions surface; currently a TODO stub.

## Proposed design

**Resolver (`sdd base-branch [feature-id]`)** — pure shell function in `bin/sdd`:

```
cmd_base_branch(feature_id?):
  # L1 — sidecar (only if feature_id provided)
  if feature_id and -s specs/<id>/.parent-branch:
    ref = trim(read first line)
    if ref non-empty:
      git rev-parse --verify "$ref" → print + exit 0
      else → stderr ".parent-branch references missing '<ref>'"; exit 2
  # L2 — project config
  ref = grep -m1 '^base-branch:[[:space:]]*' .claude/rules/git.md | cut … | trim
  if ref non-empty:
    git rev-parse --verify "$ref" → print + exit 0
    else → stderr "git.md base-branch '<ref>' missing"; exit 2
  # L3 — auto-detect (strict-min preserves first-in-order on ties)
  for c in develop main master:
    git rev-parse --verify "$c" || continue
    n = git rev-list --count "$c..HEAD"; if n < best: best=c
  if best: print best + exit 0
  stderr "no base resolvable — set base-branch: or create .parent-branch"; exit 3
```

**Agent integration** — `sdd-simplify-code.md` pre-flight (line 21) and step 3.1 replaced with `BASE_BRANCH=$(sdd base-branch "$ARGUMENTS")`; on non-zero, `Status: blocked` with stderr forwarded; otherwise `git merge-base "$BASE_BRANCH" HEAD`.

**Config docs** — `.claude/rules/git.md` gains a "Base branch resolution" section: precedence, `base-branch:` syntax/example, sidecar location, shallow-clone limitation.

## Touched areas
- Files: `bin/sdd`; `.claude/agents/sdd-simplify-code.md`; `.claude/rules/git.md`; `.gitignore` (add `specs/**/.parent-branch`).
- API: new `sdd base-branch [feature-id]`; exit codes 0=ok, 2=explicit-ref-missing, 3=no-candidate.
- DB/jobs/UI: none. stdout = ref; stderr = diagnostics.

## Data flow
Agent → `sdd base-branch <id>` → L1 → L2 → L3 → stdout. Caller composes `git merge-base <out> HEAD`.

## Migration / rollout
- Backfill: none — `.parent-branch` opt-in, gitignored.
- Compatibility: with no overrides on `main`-only repos, L3 picks `main` → legacy behavior preserved.
- **Rollback**: per spec — revert commits / hot-patch one line / `base-branch: main` opt-out.
- **Distribution**: symlink installs auto-pick up `bin/sdd`; `--copy` installs need byte-diff for `bin/sdd` itself (out of scope — separate feature if needed).

## Observability
- Stderr diagnostics on layer failures cite which layer + what was missing. No stdout noise on success.

## Test strategy
No shell test framework (per 011 D10). Manual smoke per AC, captured in `smoke.md`.

| AC | Setup | Expected |
|---|---|---|
| AC1 | sidecar w/ existing ref | stdout matches, no `git.md` read |
| AC2 | sidecar absent, `base-branch: develop` | stdout `develop` |
| AC3 | both absent, develop count<main | stdout `develop` |
| AC4 | tie counts | `develop` (first-in-order) |
| AC5 | sidecar w/ missing ref | exit 2, cites file+ref |
| AC6 | nothing resolves | exit 3, instructive stderr |
| AC7 | whitespace sidecar + `base-branch: main` | stdout `main` |
| AC8 | `/simplify-code` w/ `base-branch: develop` | scope from `develop..HEAD` |
| AC9 | no-arg + `base-branch: develop` | stdout `develop`, no `specs/` access |

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| **Working-tree pollution from feature 012** (`bin/sdd` already dirty) | T1 stashes 012's `bin/sdd` mods before branching. Documented in `decisions.md`. |
| `grep base-branch:` matches code-fence examples in `git.md` | Anchor `^base-branch:[[:space:]]*` + `-m1`. |
| Resolver run from worktree where parents only exist as remote refs | `git rev-parse --verify` accepts `origin/*`; document `base-branch: origin/main` workaround in T4. |
| Whitespace-only sidecar treated as ref | Trim then test for empty AFTER trim → fall through (AC7). |
| `bin/sdd update` doesn't propagate `bin/sdd` itself | Out of scope per intake; flag for follow-up. |
| `cmd_base_branch` invoked outside git repo | All `git rev-parse --verify` fail → exit 3 with standard diagnostic. Acceptable. |
