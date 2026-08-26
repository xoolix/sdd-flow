# Feature: Pipeline integrity fixes

## Summary
Six defects found reviewing and archiving feature 021: the old web taxonomy survives in `/plan-feature`'s own sizing step, 021's acceptance test verifies a parser production never calls, `/archive-feature` runs no validation and commits only half of its move, and finished specs linger in `specs/` where the model reads them as active work.

## Trigger
Any `/plan-feature` run, any consumer needing domain vocabulary, and every `/archive-feature` run.

## Happy Path
1. `/plan-feature` resolves vocabulary **before** Step 3, which then identifies and sizes using it. Empty → derive from the spec, not from step-4 findings the resume path never collected.
2. Consumers call `sdd domain-vocab` instead of grepping. Unavailable → derive from their own scan, as an empty section behaves today.
3. `/archive-feature` moves the folder, then commits with `--moved-from` so both halves land.
4. The orchestrator validates after archive and, on failure, reports `Status: blocked` without retrying — archive is not idempotent.
5. `sdd status` with no feature-id lists what is still sitting in `specs/`.

## Domains
- `CLI surface` — `sdd domain-vocab`; `--moved-from` on `commit-slice`
- `Orchestration skills` — `plan-feature` Step 3 ordering; `sdd-phase-common` §F
- `Phase agents` — `sdd-designer`, `sdd-research-spike`, `sdd-archive-feature`
- `Test suite` — end-to-end coverage for both new CLI paths

## API Changes
| Surface | Change |
|---|---|
| `sdd domain-vocab` | Prints § Domain rules content, exit 0. Empty or absent → no output, exit ≠0. Comment-only counts as empty. |
| `commit-slice --moved-from <path>` | Stages the deletion of a moved-away path, guarded by `git ls-files --error-unmatch`. |
| Four consumers | Call `sdd domain-vocab`, not grep; failure degrades to scan-derived names (ADR 0003). Their "the CLI never does" closing line becomes false and must go. |
| `plan-feature/SKILL.md` | Vocabulary read moves ahead of Step 3; Step 3 drops the fixed list; four step-number cross-references stay in lockstep. |
| `sdd-phase-common.md` §F | Archive named explicitly as **not** exempt from post-phase validation, plus a new list of **non-retryable** phases — the concept does not exist today. |
| `sdd status` (no feature-id) | Lists every folder in `specs/` with its phase, instead of erroring `not on a feature branch`. Surfaces finished-but-unarchived work. |

## Edge Cases
| Case | Behavior |
|---|---|
| `domain-vocab` missing or non-zero | Consumer derives from its own scan — same as an empty section today. Fail-open. |
| `discovery.md` present, Step 4 skipped | Fallback derives from the spec. 021 took this path; the current wording cites findings that do not exist. |
| Post-archive validation fails | `Status: blocked`, no retry. Archive's pre-flight needs `specs/<id>/`, which the move removed — a retry would fail pre-flight and mislead. |

## Acceptance Criteria
- [ ] Given § Domain rules has content, When `/plan-feature` runs Step 3, Then the analysis uses that vocabulary and the plan carries none of the fixed category labels.
- [ ] Given `discovery.md` exists so Step 4 is skipped, When the vocabulary is empty, Then the fallback derives from the spec and the plan is still produced.
- [ ] Given § Domain rules has content, When `sdd domain-vocab` runs, Then it prints that content and exits 0; and Given the section is empty or absent, Then it prints nothing and exits non-zero.
- [ ] Given the four consumers, When they need vocabulary, Then they call `sdd domain-vocab`, not grep; and Given it is unavailable, Then they derive from their scan and the artifact is still complete.
- [ ] Given `/archive-feature` completed and the suite is red, When the orchestrator validates, Then it reports `Status: blocked` with the output and does not retry archive.
- [ ] Given a feature archived with `--moved-from`, When the commit is inspected, Then it contains the old paths' deletions and a clean checkout holds only the archive location.
- [ ] Given `--moved-from` names a path that was never tracked, When `commit-slice` runs, Then it exits non-zero naming the path — never staging it as a new addition.
- [ ] Given `specs/` holds a feature whose tasks are all complete but that was never archived, When `sdd status` runs with no feature-id, Then it lists every `specs/` folder with its phase so the unarchived one is visible.
- [ ] Given an unrelated path is already staged, When `commit-slice` commits, Then only the named, derived and `--moved-from` paths land in the commit and the unrelated staged path stays staged.

## Rollback Plan
- Revert the commit. Skills and templates are symlinked; agents refresh on `sdd update`.
- The `domain-vocab` dependency degrades by design: a broken subcommand returns the pipeline to pre-022 behavior rather than blocking.

## Success Criteria
- 022's own archive commit shows deletions as well as insertions — defect 3 proven fixed by the feature that fixes it.
- `domain-vocab` covered by tests exercising the real binary in both states — the exact path consumers run, not an adjacent one.

## Open Questions
- None.
