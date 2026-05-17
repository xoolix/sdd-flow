# Decisions

## Delta: 2026-04-27 — Tasks 1–8

- **MODIFIED**: AC1 states "eight defined enum values" but seven are shipped — `ready-to-archive` is deferred to v2. The plan's Approach section already documented this deferral ("YAGNI — decisions.md parsing is fragile in bash"). The AC1 wording is a known nit; the phase table in the Plan section already lists seven rows. Shipped phases: `missing`, `spec`, `planned`, `implementing`, `ready-to-simplify`, `ready-to-review`, `archived`.

- **MODIFIED**: JSON emission uses `printf` calls rather than a single bash heredoc. A heredoc with variable interpolation requires unquoting (`EOF` vs `'EOF'`), which makes escaping embedded double-quotes in values error-prone. `printf` per field is equally readable and avoids the quoting hazard.

- **MODIFIED**: Fast-lane task counting uses a line-by-line `while read` loop instead of a pipe+grep to extract the `## Tasks` section. This avoids spawning a subshell and handles the section boundary (stop at next `##`) cleanly in pure bash without `awk`/`sed`.

## SPEC-GAP — 012-sdd-status-json — adversarial review

## Spec Gaps
| # | Severity | Category | Description | Suggested Action |
|---|----------|----------|-------------|------------------|
| 1 | low | undocumented-assumption | Spec assumes CWD = repo root. Invocation from a subdirectory silently fails with "feature not found". | Add a note to spec/usage: "must be run from repo root", or auto-detect repo root via `git rev-parse --show-toplevel`. |
| 2 | low | incomplete-AC | AC1 says "eight defined enum values" but the plan table shows 7 and `ready-to-archive` is deferred. The inconsistency between AC text and plan table will confuse future readers. | Update AC1 wording to match the plan table (7 values) and note `ready-to-archive` as v2 scope. |
| 3 | low | edge-case | `quick-spec.md` with no `## Tasks` section or Windows CRLF line endings produces `tasks_total=0` → `planned` phase silently. | Spec should note `## Tasks` section is required in fast-lane files; CRLF handling assumed unix. |
| 4 | low | incomplete-AC | `next_command` values for each phase are only defined in the implementation's `case` statement, not in the spec or plan. A future re-implementer has no spec-level contract for these values. | Add a `next_command` mapping table to the Plan section of quick-spec.md. |
| 5 | low | undocumented-assumption | Non-git-repo environments: `git branch --show-current` and `git rev-parse HEAD` fail silently; behavior is undefined by spec. | Note in spec that git must be present and CWD must be a git repo. |

Source: adversarial review agent, review-feature phase
Date: 2026-04-27

## Deltas merged

2026-04-27T22:10:00Z — Archive step merged AC1 wording from "eight defined enum values" to "seven defined enum values" with explicit enum list (`missing`, `spec`, `planned`, `implementing`, `ready-to-simplify`, `ready-to-review`, `archived`). Marked both AC1 and AC2 as `[x]` complete. Also updated Success Criterion to reflect seven phases. Implementation-only deltas (printf vs heredoc, while read vs pipe) not applied to quick-spec (already implementation-level in shipped code).

## Simplify: 2026-04-27 — /simplify-code

- **Files simplified**: none
- **Changes**: committed diff (`main..HEAD`) is empty — 012's implementation lives in the working tree (staged `bin/sdd`), not in a committed diff. Ignored uncommitted path outside scope: `bin/sdd`. No simplification edits were applied.
- **Baseline**: pass | **Post-edit**: SKIP (no files in scope)
