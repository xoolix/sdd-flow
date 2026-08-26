# Technical Plan

## Inputs
`spec.md` · `clarify.md` · `discovery.md` · `decisions.md` (F2/F3/F12 accepted, not re-opened) · ADR 0002/0003

## Domain analysis
4 domains, none large ⇒ **MEDIUM**, sequential: `CLI surface` first, then `Orchestration skills`, `Phase agents`, `Test suite`.

## Current state
- Step 3 identifies **and sizes** with the old taxonomy; the vocabulary read is at Step 5 — `plan-feature/SKILL.md:55-61`, `:94`
- `extract_section` returns a comment-only section as content — `bin/sdd:912-921`
- Nothing stages the move's deletion half — `bin/sdd:869-876`; `34b7332` = 408 insertions, 0 deletions
- Retry logic unconditional; no "non-retryable phase" concept — `sdd-phase-common.md:104`
- `status` no-arg off a feature branch exits 1 — `bin/sdd:1062-1070`
- Archive defect 2 already mitigated, **verify only** — `tests/sdd.test.js:60-77`

## Proposed design

**1. `sdd domain-vocab`** (no flags). `extract_section` over § Domain rules, then the **emptiness filter**: drop blank and comment-only lines (`^[[:space:]]*<!--.*-->[[:space:]]*$`). Empty remainder ⇒ no output, **exit 3** (empty and absent collapse); else print it, so exit 0 guarantees non-empty vocabulary and consumers drop their "past the comment" filter.

**2. `commit-slice --moved-from <path>`.** A `case` arm shaped like `--type`, run **after** the existing `git add`s and **before** `git diff --cached --quiet` (`:878`), so a deletion-only commit still counts as staged. **Guard first**: `git ls-files --error-unmatch -- "$path"` — non-zero ⇒ exit 3 naming the path; zero ⇒ `git add -A -- "$path"`, failure ⇒ 4. Mandatory: never-tracked-but-present makes a bare `git add` exit 0 and stage a *new addition*.

**3. §F non-retryable phases.** The step-3 row's "skip if phase produces no code" gains "`archive-feature` is **not** exempt: it moves files, and moving files breaks tests". A new `### Non-retryable phases` list under Retry Logic names `archive-feature` (its pre-flight needs the `specs/<id>/` the move removed): failure ⇒ `blocked`, **zero** retries. Replicated at `sdd-next:177` & `:196-197`, `sdd-auto:120` & `:125`.

**4. Reorder without renumbering.** New **Step 2.5 — Domain vocabulary** calls `domain-vocab`; exit≠0 ⇒ derive from `spec.md` (Step 2, always present), never step-4 findings. Step 3 consumes it and drops the fixed list — safe: sizing is domain-count arithmetic and Step 4 iterates whatever Step 3 emits. Numbering untouched, so `:37`/`:96` stay true; only `:94` (back-pointer to 2.5) and `sdd-designer.md:29` ("step 2" ⇒ "step 3") change.

**5. `status` no-arg.** Phase detection extracted to a helper; single-feature JSON byte-identical. No-arg iterates `specs/*/` minus `archive/` and emits a JSON **array** of `{feature_id, phase, next_command}`, exit 0, `[]` when none.

**6. Closing sentence**, all four consumers:
> Per ADR 0003: the CLI resolves content (`sdd domain-vocab`), the agent reads knobs (`auto-commit` in `git.md`) directly.

Spanish at `new-feature/SKILL.md:172`; each keeps its own empty-branch fallback.

## Touched areas
| Module / path | Change |
|---|---|
| `bin/sdd` | `cmd_domain_vocab`; `--moved-from` (`:825-876`); `cmd_status:1058` no-arg + helper; `usage():77-115`; dispatch `:1216-1232`; T008 (7th defect, found mid-implementation, absent from the design above): `git commit` + its post-commit dirty-check scoped to `commit_paths` (`--files`/feature dir/`--moved-from`), not the whole index — others' pre-staged work stays staged, untouched |
| `plan-feature/SKILL.md` | Step 2.5; `:55-61`; `:94` |
| `sdd-phase-common.md` + `sdd-next`/`sdd-auto` | §F step-3 row + non-retryable list, replicated 2 spots each |
| `sdd-designer.md`, `sdd-research-spike.md`, `new-feature/SKILL.md` | closing sentence; designer also `:29` |
| `sdd-archive-feature.md` | Step 3.5 adds `--moved-from specs/$ARGUMENTS/` (path exists `:41`; one call) |
| `tests/sdd.test.js` | new describes; T008 retargeted to `domain-vocab` |

## Data flow
§ Domain rules → `extract_section` → filter → exit/stdout → Step 2.5 → Step 3 → designer → `plan.md`.
Archive: `mv` → `commit-slice --moved-from` → guard → stage deletion + archive dir → commit → orchestrator validates, blocked without retry.

## Migration / rollout
CLI → consumers → §F/orchestrators → `status`. One revertible commit; agents refresh on `sdd update`. Fail-open: a broken `domain-vocab` restores pre-022 behavior.

## Observability
Exit codes plus stderr are the signal surface; `status` no-arg **is** the stale-spec fix.

## Test strategy
**Behavioral — real binary, temp repo (genuine coverage)**
- `domain-vocab`: content ⇒ stdout + 0; comment-only, blank section, absent heading ⇒ silent + 3.
- `--moved-from`: tracked-and-deleted ⇒ deletion in `filesInCommit`; never-tracked-and-absent ⇒ 3; never-tracked-**but-present** ⇒ 3 **and** absent from `git diff --cached`; missing value ⇒ 2; deletion-only commit still commits.
- `status` no-arg: array shape, per-folder phase, `archive/` excluded, `[]` when empty.

**Prose guards — `toContain` over `.md`: wiring assertions, NOT coverage.** Non-retryable list in all five spots; no `the CLI never does` left; four consumers name `sdd domain-vocab`; Step 2.5 present, Step 3 free of the fixed taxonomy.

**Verify-only**: `featureDir` (T010). **E2E**: 022's archive commit shows deletions — the only proof the prose is obeyed.

## Risks and mitigations
| Risk | Mitigation |
|---|---|
| `git add -A` over-stages a broad path | Archive passes only `specs/$ARGUMENTS/` |
| Prose guards green while the model ignores them | Dogfood: 022's own archive |
| §F carve-out drifts across five files | One guard asserts all five |
| Consumers depend on a subcommand | Fail-open; absent ⇒ pre-022 behavior |
| `cmd_status` refactor breaks T004 | Single-feature JSON byte-identical |

## Open questions
- None.
