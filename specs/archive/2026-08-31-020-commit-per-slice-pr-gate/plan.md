# Technical Plan — 020-commit-per-slice-pr-gate

## Inputs
`spec.md` · `discovery.md` (F1/F2/F10/F13 ACCEPTED — binding) · `docs/adr/0002-sdd-git-write-boundary.md`

## Current state
| Area | Fact |
|---|---|
| `bin/sdd` | All git calls read-only; no `gh`. Dispatch `:902-915`, `set -euo pipefail` `:2`. Flags are booleans only (`cmd_init:146-152`); two exit idioms coexist — `err;exit 1` vs graded `return N` (`cmd_base_branch:676-737`). |
| `cmd_status` | Dir resolution `:756-778`; `:783-784` unconditionally sets `phase="archived"`. |
| Agents | implement-task gate `:142` → checkbox `:144-147` → delta `:158-165`; simplify sentinel `:94-115`; archive `mv`+`rm` `:39-42` on **haiku**. |
| Rules / tests | `git.md:7-8` states the opposite policy (knob precedent `testing.md:26-27`). No test asserts a non-zero exit or touches git; `makeTempProject:9-20` sets no `user.email`. |

## Proposed design
Three additive subcommands own every git write; agents own only policy.

| Command | Contract |
|---|---|
| `sdd branch <id>` | Idempotent: on `feature/<id>` → no-op; exists → checkout; else `checkout -b`. Prints the branch. Implement-task Step 1 (F8). |
| `sdd commit-slice <id> --type <t> [--task Tnnn] --title "<s>" --files <p>…` | `git add -- <p>…`, then `git add --` the **derived** feature dir (F2: `specs/<id>`, else `find specs/archive -maxdepth 1 -type d -name "*-<id>"`). Refuses without `--files`. Commits `<type>(<id>): [Tnnn ]<title>`, prints the SHA. Never pushes, never `add -A`. |
| `sdd open-pr <id>` | Pre-flight in order: feature branch → `gh` on PATH → `gh auth status` → `git remote get-url origin`. Then `gh pr view --json url` → reuse an open PR; else `git push -u origin HEAD` + `gh pr create --draft --fill`. Writes `.pr-opened` (url/branch/head/date) in the derived dir **only on success**. |

**Exit codes**: graded `printf 'error: …' >&2; return N` (agents must tell usage bugs from environment failures; `err;exit 1` collapses them). `2`=usage, `3`=feature/branch unresolvable, `4`=git/gh failure (stderr passed through), `5`=nothing staged. `open-pr` pre-flight failure = `3` + the manual `git push … && gh pr create --draft`. Commit runs as `if ! git commit …` — never `|| true`, which `set -e` aborts on.

**Red intermediate commit** (agent omits a file from `--files`): accepted per ADR; post-commit `git status --porcelain` warning on stderr lists still-dirty tracked files, which implement-task surfaces in its envelope. The omitted file lands in the next slice's commit.

`cmd_status:783-784` becomes: archived **and** `.pr-opened` → `archived`; archived without it → `ready-to-pr`, `next_command="sdd open-pr <id>"`.

**Knob**: implement-task, simplify-code and archive-feature grep `git.md` for `^auto-commit:\s*off` — absent ⇒ on. Both orchestrators read it to skip the gate. The CLI never reads it: policy in prose, mechanism in code, tests stay deterministic.

**`type:`**: task-planner emits it; template + implement-task `:34-39` document it; the Step 3 parser captures it. Missing on a Step 2b review-fix task ⇒ `fix`, else `chore`. simplify ⇒ `refactor`, archive ⇒ `chore`, both without `--task`.

## Touched areas
`bin/sdd` (usage `:81-96`, dispatch `:907`, 3 new `cmd_*`, `cmd_status:783`+`:868-879`, VERSION→2.1.0) · `sdd-implement-task.md` (Steps 1/3/7.5 + revert-on-fail) · `sdd-simplify-code.md` (commit between Steps 5 and 6) · `sdd-archive-feature.md` (one call after `mv`) · `sdd-task-planner.md` · `_shared/sdd-phase-common.md §D` (+`Commit`, F10) · `sdd-next:53-64,229` · `sdd-auto:46,198` · `CLAUDE.md:46-55,106-122` · `git.md:7-8`+knob · `tasks-template.md` · `tests/sdd.test.js` · `.gitignore` (+`specs/**/.simplified`; **not** `.pr-opened`, F7).

## Data flow
`sdd branch` → edits → validations green → `[x]` + marker + delta → `sdd commit-slice` → SHA into envelope. Commit failure ⇒ revert `[x]`→`[ ]`, `Status: blocked` + stderr (AC4), preserving *task complete ⟹ commit exists*. simplify: post-validation → **commit, then** sentinel with the post-commit HEAD; reversed, the commit invalidates `git-head:` and `cmd_status` returns `ready-to-simplify` forever. archive: `mv` → `commit-slice` (dir now resolves under `specs/archive/`). `sdd status` → `ready-to-pr` → orchestrator asks once → `sdd open-pr`.

## Migration / rollout
Additive; repos change behavior on the next `/implement-task` after `bin/sdd update`. Rollback: `auto-commit: off` (per-project, never overwritten). Table reconciliation (F3): both phase tables key off `sdd status`'s `phase` — file-existence checks cannot see archived features (F4) — and both gain `archived` + `ready-to-pr` rows.

## Observability
SHA/URL on stdout (`$(…)`-safe); graded errors + dirty-tree warning on stderr; state in `.pr-opened`, `.simplified`, `sdd status` JSON and the envelope `Commit:` field. No metrics system exists.

## Test strategy
| Level | Coverage |
|---|---|
| Harness | `makeTempProject` sets local `user.email`/`user.name`/`commit.gpgsign=false` (F5). New helpers: `seedCommit()`, `sddFail()` (try/catch → `{status, stderr}` — the suite's first non-zero-exit assertion, F6), `filesInCommit()` (`git show --name-only --format=`). |
| Integration | AC1 message format; AC2 unrelated dirty file excluded; AC3 no `--files` ⇒ exit≠0 **and** `rev-parse HEAD` unchanged; derived-dir staging from `specs/archive/`; `ready-to-pr` vs `archived` JSON. |
| `open-pr` | Pre-flight only, `PATH` stubbed without `gh` (AC6): exit≠0, no push, no `.pr-opened`, manual command printed. Success path is dogfood-only. |
| Markdown | `toContain` for the knob, `§D` Commit field, `type:` in the template, gate carve-out in both orchestrators. `CORE_SKILLS` must stay one line (`tests:271-285`). |

## Risks and mitigations
| Risk | Mitigation |
|---|---|
| Archive runs on **haiku** (F9) | Exactly one CLI call, zero conditionals; branching lives in `bin/sdd`. Re-run safe — dir resolution finds the archived path. |
| Variadic `--files` swallows later flags | Terminate at the next `--*` token; document `--files` last. |
| `.simplified` committed | `.gitignore` entry added in the same slice that writes the sentinel. |
| `sdd-auto` hits the gate | Loop exits at `ready-to-pr`, `Status: BLOCKED`, reusing `sdd-hitl:47-71`'s pause/resume shape. |

## Open questions
None — F1/F2/F10/F13 resolved in `discovery.md`.
