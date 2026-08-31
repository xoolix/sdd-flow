# Technical Plan

## Inputs
`spec.md` (6 live AC; AC2/AC3 struck, numbering kept) · `clarify.md` + `decisions.md` (`cmd_open_pr` cut) · `discovery.md` (F1/F2/F7/F8/F9/F11/F12/F13 accepted; F4/F5/F6/F10 fell with the cut).

## Domain analysis
| Domain | Items | AC | Size |
|---|---|---|---|
| `CLI surface` | `cmd_base_branch`, `extract_section`, `cmd_commit_slice` | 1, 4, 5 | MEDIUM |
| `Phase agents` | `sdd-designer.md` | 7 | SMALL |
| `Orchestration skills` | `sdd-simplify-code.md` exclusions | 6 | SMALL |
| `Test suite` | `tests/sdd.test.js` by input axis | 8 + all | MEDIUM |

## Current state → proposed design
| Symbol | Today | Change |
|---|---|---|
| `cmd_base_branch` | Layer 1 hardcodes the active-dir sidecar ⇒ post-archive it no-ops and Layer 3 autodetects. Layers 1–2 `return 2` on an unresolvable ref, no fall-through; Layer 3 `return 3`. Zero tests. | Layer 1 resolves through `resolve_feature_dir`, guarded `if !` (F1) so an unresolvable id falls to Layer 2 instead of aborting under `pipefail`. Layers 2–3, exit codes and bare-ref stdout untouched. |
| `extract_section` | One awk pass: unconditional pre-block (CRLF strip) plus one terminator (`found && /^## /`). Fence-blind ⇒ truncates and exits 0. | Two independent fence toggles (``` and `~~~`, never shared — F9) in that pre-block, so state tracks from line 1 regardless of `found`; the terminator fires only outside every fence. An unclosed fence needs no code — a toggle never flipped back holds to EOF. `cmd_domain_vocab`'s stripper runs after and ignores `## `. |
| `cmd_commit_slice` | `pre_staged` snapshot precedes its three `git add --` calls, used post-commit as an **exclusion** set. `feature_dir` absolute, `pre_staged` repo-relative. | Second warning reusing that snapshot as an **inclusion** set scoped to the feature dir, after stripping `"$(pwd)/"` (F8). Kept separate — opposite polarity. Staging and commit pathspec byte-identical; never `-A`. |
| `sdd-designer.md` | Self-resolves vocabulary, falling back to exploration findings — absent on discovery-resume. Contradicts `plan-feature/SKILL.md` 2.5/5; the phrase is test-pinned. | Take the Step 2.5 hand-off, else `spec.md`; its pinning test is edited in the same slice (F2). `sdd-research-spike.md` and `new-feature/SKILL.md` self-resolve legitimately — untouched. |
| `sdd-simplify-code.md` | Exclusions omit `.claude/agents/**` and `docs/adr/**`; list unpinned, neighbouring prose pinned. | Add both globs to the SDD-artifacts bullet. Bullet only. |

## Touched areas
| Module / path | Change |
|---|---|
| `bin/sdd` — `cmd_base_branch` | Guarded `resolve_feature_dir` in Layer 1 |
| `bin/sdd` — `extract_section` | Fence toggles; gated terminator |
| `bin/sdd` — `cmd_commit_slice` | Pre-staged feature-dir warning + path normalization |
| `.claude/agents/sdd-designer.md` | Vocabulary = orchestrator hand-off |
| `.claude/agents/sdd-simplify-code.md` | Two exclusion entries |
| `tests/sdd.test.js` | Axis-organized suites; designer guard updated |

## Data flow
`sdd base-branch <id>` → `resolve_feature_dir` (active ∪ archive) → `.parent-branch` → bare ref on stdout, inlined in argv by `sdd-simplify-code` and `sdd-cross-reviewer` as their diff base. `extract_section` → fence-aware awk → `build_pr_body_file` and `cmd_domain_vocab`. `cmd_commit_slice` → one snapshot → unchanged staging/commit → two warnings, opposite polarity.

## Migration / rollout
Additive, one change set, no flag. No migration, no format change: `.parent-branch` and `.pr-opened` read as before, exit codes and stdout preserved, the only new output is stderr. Rollback = `git revert`.

## Observability
This feature *is* the observability work — five silent degradations become visible. Diagnostics go to **stderr** (`warning:`/`error:`); stdout stays a bare ref because two agents inline it in argv; exit codes unchanged, so `/simplify-code`'s "non-zero ⇒ blocked" contract holds.

## Test strategy
AC8 is a deliverable. Rule, from 022's four fix cycles on one predicate: **one `describe` per input axis, one case per axis value — including values that never failed**. Enumerate axes once, never a test per bug shape; the reviewer then asks "is the axis covered?", not "does it pass?".

| Axis | Today | Values | Where |
|---|---|---|---|
| Line ending | Partial: CRLF only for `cmd_domain_vocab` | LF, CRLF, for **both** consumers | Parameterize the LF-only PR-body fixture helper |
| Document structure | Zero — no fixture writes a fence | none; `## ` inside ```; inside `~~~`; `~~~` inside an open ``` block; unclosed; fence above the heading | New `describe`, both consumers |
| Resolution | Zero | active; archived; legacy archive prefix; unresolvable (must not abort); empty sidecar → Layer 2; missing branch → 2; nothing → 3 | New `describe("sdd base-branch")` |
| Index state | Partial — both tests stage *outside* the feature dir | clean; outside; **inside**; both | Extend `describe("sdd commit-slice")` |

- **Unit**: axes 2–4 against `bin/sdd` directly.
- **Integration**: axis 1 via both consumers, plus a no-fence/LF case pinning `build_pr_body_file` output byte-identical.
- **Prose wiring** (AC6/AC7): content assertions labelled wiring regressions, not behavioural coverage (ADR 0003's caveat).
- **Manual**: `sdd base-branch 022-pipeline-integrity-fixes` prints `integration/sdd-020-021`, not `main`.

## Risks and mitigations
| Risk | Mitigation |
|---|---|
| Unguarded `resolve_feature_dir` aborts under `pipefail` (F1) | `if !` idiom; axis-3 "unresolvable" case |
| A shared fence boolean inverts the cut-less tie-breaker (F9) | Two toggles; axis-2 `~~~`-inside-``` case |
| Absolute/relative mismatch leaves AC5's warning dead (F8) | Normalize first; axis-4 "inside" case |
| Fence change alters existing PR bodies | Byte-identical no-fence assertion |
| Editing prose pinned by other tests (F11) | Bullet only; full suite run |
| Citation drift (022 left 24 stale line numbers) | Symbols only, no line numbers |

## Open questions
None — the sole high-impact finding dissolved with the `cmd_open_pr` cut.
