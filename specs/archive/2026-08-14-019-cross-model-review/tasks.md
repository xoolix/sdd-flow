# Tasks

## Execution order

### 1. Foundation

- [x] **T001 [AFK] Record implemented-by marker on task completion**: add Step 6b to `sdd-implement-task.md` (after Step 6, before Step 7 delta specs) appending `[ISO-8601 UTC] implemented-by: claude` to `decisions.md`, deduped only against the last `implemented-by:` line (skip if same value; alternating claude→codex→claude not collapsed). Add a `tests/sdd.test.js` assertion that the file contains `implemented-by:`.
  - blocked_by: none
  - verifies: AC4
  - touches: .claude/agents/sdd-implement-task.md, tests/sdd.test.js

- [x] **T002 [AFK] Create sdd-cross-reviewer agent**: new `.claude/agents/sdd-cross-reviewer.md`, frontmatter mirroring `sdd-reviewer`/`sdd-judge`. Body: locate companion via glob `~/.claude/plugins/cache/openai-codex/codex/*/scripts/codex-companion.mjs` (highest version); pick scope from `git status --porcelain` (`--scope working-tree` if dirty, else `--base $(sdd base-branch <feature-id>)`); run `node <companion> adversarial-review --wait --json <scope> [focus]`, focus = brief spec summary (ACs + touched files); parse the schema JSON into the judge's findings table (`Category: cross-model`, Evidence from `file:line_start-line_end`, Description/Suggested Action from `body`/`recommendation`); verdict `approve→PASS`, `needs-attention→FAIL` if any critical/high finding else `PASS WITH WARNINGS`; on runtime failure retry once, classify by stderr/stdout text (not exit code) for skip vs retry; unparseable JSON → raw output truncated ~100 lines, marked `formato libre`. Update `tests/sdd.test.js`: `toHaveLength(10)`→`toHaveLength(11)`, add a positive `existsSync` assertion for the new file, rename the topology test.
  - blocked_by: none
  - verifies: AC1, AC3
  - touches: .claude/agents/sdd-cross-reviewer.md, tests/sdd.test.js

### 2. Core implementation

- [x] **T003 [AFK] Wire cross-review into review-feature pipeline**: in `review-feature/SKILL.md` add Step 2.5 (plugin detection sets `CROSS_REVIEW_AVAILABLE`; unavailable → `Cross-Review: skipped — <reason>` audited in `decisions.md`); extend Step 1.5 to parse `implemented-by` and resolve the opposite model (no marker → assume current runtime, annotate); extend Step 3 to launch `sdd-cross-reviewer` as a third parallel agent, gated on judgment-day AND `CROSS_REVIEW_AVAILABLE` (excluded under `--minimal`); add Step 6.6 writing `## CROSS-REVIEW — <feature-id>` to `decisions.md` mirroring Step 6.5's format (`Source: sdd-cross-reviewer (codex)`); add envelope line `**Cross-Review**: <verdict> (advisory, model: codex) | skipped — <razón>`. Step 4 consolidation unchanged — reviewer+judge stay authoritative; cross `FAIL` degrades to warning `cross-review reported FAIL (advisory)`, never altering the final verdict.
  - blocked_by: T001, T002
  - verifies: AC1, AC2, AC3, AC4
  - touches: .claude/skills/review-feature/SKILL.md

- [x] **T004 [AFK] Update agent docs and model routing**: update `.claude/skills/_shared/agent-frontmatter.md` counts (10→11 total, 6→7 internal) and append `sdd-cross-reviewer`; add a Model Routing row for it in `.claude/CLAUDE.md` per `plan.md`'s model decision. Confirm `bin/sdd` needs zero changes (SDD_HOME glob sync covers it).
  - blocked_by: T002
  - verifies: AC1
  - touches: .claude/skills/_shared/agent-frontmatter.md, .claude/CLAUDE.md

### 3. Validation

- [x] **T005 [AFK] Dogfood cross-review end-to-end**: run `/review-feature` (or a scripted equivalent of Steps 2.5/1.5/3/6.6) against a feature with an `implemented-by` marker, plugin active — confirm envelope shows `Cross-Review: <verdict> (advisory, model: codex)` and `decisions.md` gains `## CROSS-REVIEW` (AC1). Repeat with plugin unavailable (mask companion path) — confirm `Cross-Review: skipped — <reason>` and identical final verdict (AC2). Run `npm test` green, including T002's updated agent-count assertions.
  - blocked_by: T003, T004
  - verifies: AC1, AC2, AC3, AC4
  - touches: tests/sdd.test.js, specs/019-cross-model-review/decisions.md

### 4. Fix (post-dogfood, user-approved)

- [x] **T006 [AFK] Fix cross-reviewer parsing and add call deadline**: in `.claude/agents/sdd-cross-reviewer.md`, (1) correct the parsing instructions — companion stdout is an envelope `{review, target, threadId, context, codex, result, rawOutput, parseError}`; the schema-shaped review (`verdict`/`findings`/`summary`/`next_steps`) lives under `.result`, validate THAT against `review-output.schema.json` (handle `parseError`/missing `.result` → unparseable path); (2) add an execution deadline to the companion Bash call (timeout ~10 min → on expiry treat as runtime failure: 1 retry then `skipped — runtime error: timeout`). Update the CROSS-REVIEW dogfood findings status in `decisions.md` and add a tests/sdd.test.js assertion that the agent file mentions `.result` unwrapping.
  - blocked_by: T005
  - verifies: AC1
  - touches: .claude/agents/sdd-cross-reviewer.md, tests/sdd.test.js, specs/019-cross-model-review/decisions.md

### 5. Review fix (JUDGMENT-DAY-HIGH, user-approved)

- [x] **T007 [AFK] Harden cross-review invocation, detection, and fail-open**: (1) **Shell injection** — `sdd-cross-reviewer.md`: the focus text must NEVER be interpolated literally into the Bash command string; write it to a scratch file and pass it as `"$(cat <focusfile>)"` (command-substitution output is not re-parsed by the shell), documenting why; (2) **Kill-switch** — detection in both `review-feature/SKILL.md` Step 2.5 and the agent's companion-location step must verify the plugin is ACTIVE via `~/.claude/plugins/installed_plugins.json` (enabled entry for `codex@openai-codex`, use its install path) instead of trusting the cache glob alone; disabled/unregistered → audited skip; (3) **Orchestration fail-open** — `review-feature/SKILL.md` Steps 3/6.6: if the cross-agent fails to launch, crashes, times out, or returns no `### Cross-Verdict:` line → `Cross-Review: skipped — cross-agent failure: <detail>` audited in decisions.md, continue with the two-agent verdict, never consume phase retries; (4) **Schema drift** — agent must Read the real `review-output.schema.json` from the SAME resolved version dir and validate `.result` against it (replace hardcoded prose shape). Add tests/sdd.test.js assertions for each (focus-file pattern, installed_plugins.json, cross-agent failure skip, schema Read).
  - blocked_by: T006
  - verifies: AC1, AC2
  - touches: .claude/agents/sdd-cross-reviewer.md, .claude/skills/review-feature/SKILL.md, tests/sdd.test.js

### 6. Pre-archive fix (re-review ciclo 1, user-approved)

- [x] **T008 [AFK] Fix schema path + hygiene findings from re-review**: (1) `sdd-cross-reviewer.md` Step 5: schema candidates → `schemas/review-output.schema.json` inside the SAME resolved version dir as the companion (real v1.0.6 layout, verified live); explicit fallback if no schema file found: use the prose field summary and note the fallback in the annex; (2) add `specs/**/.cross-focus.txt` to `.gitignore` (precedent: `.parent-branch`); (3) `sdd-cross-reviewer.md` detection: unreadable `~/.claude/settings.json` ≡ `enabledPlugins` missing (audited skip); (4) both `sdd-cross-reviewer.md` and `review-feature/SKILL.md` Step 2.5: registry entry present but `installPath` missing/invalid → audited skip (`skipped — codex plugin registry entry has no valid installPath`), never fall back to an unregistered cache version. Update tests/sdd.test.js assertions (schemas/ path, .gitignore entry). Cross high #2 (orchestrator-side deadline) is NOT in scope — recorded as KNOWN-LIMITATION in decisions.md.
  - blocked_by: T007
  - verifies: AC1, AC2
  - touches: .claude/agents/sdd-cross-reviewer.md, .claude/skills/review-feature/SKILL.md, .gitignore, tests/sdd.test.js

## Notes
- `[AFK]` tasks can be implemented by `/implement-task`.
- No `[HITL]` checkpoints: model choice is resolved via `plan.md`/CLAUDE.md convention, not a runtime human decision.
- `blocked_by` is `none` or comma-separated task IDs.
- Update `decisions.md` if the plan changes.
