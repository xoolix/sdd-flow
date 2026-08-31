# Tasks

## Execution order

### 1. Foundation

- [x] **T001 [AFK] Domain rules move to `domains.md`**: `cmd_domain_vocab` drops `extract_section`, reading `.claude/rules/domains.md` whole (filter, 0/3 exit codes unchanged). Move `## Domain rules` from `conventions.md` to `domains.md` (drop `open-pr` from the CLI-surface bullet); strip it from the seed `conventions.md` template, add a `domains.md` seed (cmd_init's copy loop picks it up). Fix `usage()`'s stale wording (F8). `init-project/SKILL.md` Step 3 pre-fills `domains.md`; `spec-template.md`'s Domains pointer targets `domains.md`, not `conventions.md § Domain rules`. Rewrite `describe("sdd domain-vocab")` (36 tests) for whole-file reads; fix the spec-template Domains test and T009's pristine-seed test, which still expects it in `conventions.md`, to check `domains.md`; add AC7's no-leak seed-copy case.
  - blocked_by: none
  - verifies: AC2, AC7
  - touches: bin/sdd, rules, skills, templates, tests
  - type: refactor

### 2. Core

- [x] **T002 [AFK] Remove the open-pr command and phase**: Delete `cmd_open_pr`, `build_pr_title`, `build_pr_body_file`, `append_decisions_capped`, `write_pr_opened_sentinel`, `PR_BODY_MAX_CHARS` from `bin/sdd` (leave `extract_section` for T003); drop the `usage()` entry and dispatch arm; collapse `detect_feature_phase`'s `.pr-opened`/`ready-to-pr` branch and case arm. Delete `describe("sdd open-pr")` (~933 lines), promoting `pathWithoutNode()` for T003. Rewrite the archived-vs-ready-to-pr status test to assert `archived`. Replace the `buildPrBodyViaRealPath`-based spec-template test with a direct read of spec.md's markers. Strip the PR-gate lines from `git.md` and its template seed.
  - blocked_by: T001
  - verifies: AC1, AC6
  - touches: bin/sdd, rules, templates, tests
  - type: refactor

- [ ] **T003 [AFK] Remove `extract_section` and the Node dependency**: Delete the now-callerless `extract_section` wrapper from `bin/sdd`, plus `src/extract-section.js` and `tests/extract-section.test.js` (39 tests). Fix the 021-reconciliation test's locally-shadowed `extractSectionViaRealPath` to assert plan.md's "Touched areas" text directly, not through it. Using T002's promoted `pathWithoutNode()`, add a test proving `bin/sdd` succeeds with Node off PATH (AC3).
  - blocked_by: T002
  - verifies: AC3
  - touches: bin/sdd, src, tests
  - type: refactor

- [ ] **T004 [AFK] Retire the PR gate from orchestration prose**: `sdd-archive-feature.md` gains a step after 3.5's fence (no fence inside that span, per `archiveStep35Line()`) printing `git push -u origin HEAD` and `gh pr create --draft --base <base>` from `sdd base-branch <feature-id>` (print unresolved on failure). Remove the `ready-to-pr` row/branch/exception from `sdd-next` Step 3a and `sdd-auto`'s mirror. Rewrite `.claude/CLAUDE.md`'s Workflow/Phase-Pipeline diagrams, Phase Detection table, PR-gate bullet, and archive-format's `.pr-opened` prose. Edit the three surviving prose-pinning tests (AI-attribution comment, simplify-code `.gitignore` assertion, git.md policy) plus the sdd-next/sdd-auto/CLAUDE.md wiring tests.
  - blocked_by: T003
  - verifies: AC4
  - touches: agents, skills, docs, tests
  - type: docs

### 3. Validation

- [ ] **T005 [AFK] AC5 sweep + full-suite proof**: Add the grep sweep for the ten symbols retired in T002-T004 in a new `tests/sweep-retired-symbols.test.js`, excluding only its path from the walk over `bin/`, `src/`, `.claude/**`, `.specify/templates/**`, `tests/**` (excluding `docs/`, `specs/`) — its source must contain all ten literals and would otherwise self-match and stay red; every other file, `sdd.test.js` included, stays swept. Assert zero hits; run the suite with Node on and off PATH.
  - blocked_by: T004
  - verifies: AC5
  - touches: tests

## Notes
- `[AFK]`: implementable by `/implement-task`.
- Lands as five commits, one per task: T001 lands `domains.md` first, T002-T003 remove `open-pr` then its Node dependency, T004 catches up prose, T005's sweep lands last — suite-green-per-slice, not commit count, guards against dangling references.
