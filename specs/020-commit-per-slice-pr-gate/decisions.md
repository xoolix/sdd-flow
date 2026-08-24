# Decisions

[2026-08-21T03:07:47Z] ADR-CREATED: docs/adr/0002-sdd-git-write-boundary.md — bin/sdd becomes the git-write boundary; the never-commit policy in .claude/rules/git.md is reverted to an opt-out knob.
[2026-08-21T03:07:47Z] SPEC-NOTE: spec.md is 665 words against the 650 budget. Remaining content is contract detail (6 GWT criteria + CLI contract table); prose was already cut across three passes.

[2026-08-21T10:22:42Z] DISCOVERY-ACCEPTED: F1 — new `sdd open-pr <feature-id>` subcommand owns pre-flight + push + `gh pr create --draft` + `.pr-opened`. Orchestrator only asks the confirmation question.
[2026-08-21T10:22:42Z] DISCOVERY-ACCEPTED: F2 — `commit-slice` derives the feature dir (specs/<id>, else find in specs/archive) instead of hardcoding `specs/<id>/`. One contract for all three committing phases.
[2026-08-21T10:22:42Z] DISCOVERY-ACCEPTED: F10 — commit field goes into the SHARED envelope in `_shared/sdd-phase-common.md` §D, not just implement-task's.
[2026-08-21T10:22:42Z] DISCOVERY-ACCEPTED: F13 — mechanical: rewrite git.md:7-8, add `auto-commit: on|off` knob using testing.md:26-27 placement convention.

## Delta: 2026-08-21 — Discovery Checkpoint (pre-plan)
- **ADDED**: `sdd open-pr <feature-id>` subcommand — not present in the original spec's API Changes table. Owns the whole PR gate mechanic; the orchestrator only asks for confirmation.
- **MODIFIED**: `sdd commit-slice` contract — "stages listed paths **plus** `specs/<id>/`" → stages listed paths plus the **derived** feature directory (`specs/<id>`, falling back to `find specs/archive -maxdepth 1 -type d -name "*-<id>"`). The original wording broke for `/archive-feature`, which moves the folder before any commit can run.
- **MODIFIED**: result envelope — a commit field is added to the shared envelope in `_shared/sdd-phase-common.md` §D (spec implied only implement-task reporting).

## Delta: 2026-08-21 — Plan/tasks coherence review
- **MODIFIED**: PR body source — plan.md proposed `gh pr create --draft --fill`, which derives title/body from *commits*. That contradicts the recorded interview decision ("título y body armados desde spec.md + decisions.md", clarify.md). `sdd open-pr` MUST build the title and body from the feature's `spec.md` (Summary + Acceptance Criteria + Rollback Plan) and `decisions.md`, read from the derived feature dir — the same resolution F2 already requires. Do NOT use `--fill`.
- **MODIFIED**: `type:` enum widened from `feat|fix|refactor|chore` to `feat|fix|refactor|chore|docs`. `docs` is a standard conventional-commits type and T010 is a genuine documentation slice; forcing it to `chore` would make the very first use of the new field inaccurate.
- **ADDED**: `sdd branch <feature-id>` needs its own foundation task. plan.md designs it as one of three subcommands (ADR 0002 forbids raw `git checkout -b` in agent prose), but the first task graph wired branch creation only into the agent markdown, leaving the subcommand unbuilt.

[2026-08-21T10:29:45Z] COHERENCE-FIX: .gitignore entry for `specs/**/.simplified` moved into the simplify-code wiring slice, per plan.md's own risk mitigation ("added in the same slice that writes the sentinel"). The first task graph deferred it to the docs slice, leaving a window where the sentinel could be committed and self-invalidate.

[2026-08-21T10:40:13Z] EXECUTION-MODE: self-modification hazard — this feature rewrites the agents executing it. Human chose: run T012, T001-T005 and T006 automatically, then PAUSE for diff review before T007-T010, because T006 rewrites `sdd-implement-task.md` and every later slice runs under the modified implementer.
[2026-08-21T10:43:54Z] implemented-by: claude

[2026-08-21T12:37:56Z] SEQUENCING-FIX: T006 made `/implement-task` commit by default, but the `git.md` rewrite was scheduled in T010 — leaving T007-T010 running with contradictory instructions (agent says commit unless `auto-commit: off`; `git.md` says "Never commit or push"). Human chose to pull the rewrite forward as a new slice **T013**, executed before T007. T010 keeps only the `CLAUDE.md` documentation work. Same class of defect as the `.gitignore` ordering caught in the plan/tasks coherence review: the graph enabled a capability before the policy authorizing it.
[2026-08-21T12:37:56Z] EXECUTION-MODE (updated): after T013, run T007-T010 automatically, then PAUSE at T011 (the [HITL] dogfood, which requires the human).

[2026-08-21T13:32:51Z] BRANCH-STATE: T007's commit (d036ff1) swept in feature 019's uncommitted additions to `tests/sdd.test.js` and `.gitignore` — git commits file state, not hunks, and both files were already dirty from 019 before 020 started. A catch-up commit (64a4b3b) then landed 020's CLI foundation (bin/sdd + agents + rules + ADR), verified by the CLI's own post-commit dirty warning to have left all 10 remaining 019 files untouched.
**Known issue to resolve BEFORE the PR gate**: a clean checkout of HEAD fails 6 tests — all of them 019's cross-reviewer tests, which assert on `.claude/agents/sdd-cross-reviewer.md`, still untracked. All 31 of 020's own tests pass on clean checkout, so 020's work is coherent. The branch cannot open a green PR until 019's files are either committed or its tests removed from this branch.

## Delta: 2026-08-21 — Gaps found while shipping PR #16
- **ADDED**: migration gap for EXISTING SDD projects. `cmd_init` copies `.claude/rules/*.md` from SDD_HOME but skips files that already exist, and `cmd_update` never touches `.claude/rules/` at all. So a project already running SDD gets the new agents (symlinked — they commit by default) while keeping a stale `git.md` that still says "Never commit or push". This is the same contradiction T013 fixed inside this repo, reproduced downstream on every installed project. The spec's Rollback Plan assumed `git.md` is the escape hatch but never addressed that existing copies contradict the new default. **Fix needed**: either `sdd update` should detect a pre-020 `git.md` (no `## Auto-commit` section) and warn loudly with the exact remediation, or `sdd doctor` should flag it. Not implemented — recorded for a follow-up feature.
- **ADDED**: `.pr-opened` can never appear in its own PR. It is written by `sdd open-pr` AFTER `gh pr create` succeeds, so at that moment it is an uncommitted tracked file and the PR is already open. `sdd status` reads it from disk so local phase detection is correct, but the "durable, tracked, not gitignored" framing in CLAUDE.md's Archive-folder section implies it travels with the branch, which it does not unless someone commits it in a later push. Verified live on PR #16.

[2026-08-21T15:10:50Z] PR-OPENED: https://github.com/xoolix/sdd-flow/pull/16 (draft, 34 files, +2447/-54). Contains features 019 + 020 together — see the PR body for why they could not be separated. `sdd open-pr`'s happy path ran for the first time here and worked end-to-end: pre-flight, push, draft PR with title/body from spec.md (no `--fill`), sentinel written, no AI attribution.
