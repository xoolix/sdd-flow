# Decisions

## Simplify: 2026-04-24 — /simplify-code
- **Files simplified**: bin/hello-world, bin/sdd
- **Changes**: No changes applied. bin/hello-world is a 2-line irreducible script. bin/sdd is already lean with no dead branches, unused params, or speculative abstractions.
- **Baseline**: pass | **Post-edit**: pass (no-op — SCOPED_FILES unchanged)

## SPEC-GAP — 010-hello-world — adversarial review

| # | Severity | Category | Description | Suggested Action |
|---|----------|----------|-------------|------------------|
| 1 | medium | incomplete-AC | **AC1's `\n` is unverifiable by the plan.md test strategy.** The plan test uses `"$(./bin/hello-world)"` (command substitution), which strips all trailing newlines before comparison. A script that emits `printf 'Hello, world!'` (no newline) would pass the same test. AC1 claims "stdout equals *exactly* `Hello, world!\n`" but the trailing newline is never actually validated. | Replace the plan test with a newline-aware form, e.g. `actual=$(./bin/hello-world && echo x); [ "$actual" = "Hello, world!x" ]` — or use `printf | diff -` — so the `\n` requirement in AC1 is actually enforced. |
| 2 | low | undocumented-assumption | **Stderr is never mentioned.** The spec mandates stdout content but places no constraint on stderr. Any future change that adds debug/trace output to stderr would pass AC1 and AC2 without any spec violation, silently altering observable behavior. | Add an AC or note to Success Criteria: "stderr is empty on normal invocation." |
| 3 | low | undocumented-assumption | **Minimum bash version is unspecified.** macOS ships bash 3.2 (GPLv2 frozen); Linux ranges from 4.x to 5.x. For this 2-line script it is immaterial, but the supported environment surface should be explicit. | Add one line to Edge Cases: "Minimum supported bash: 3.2 (macOS default)." |
| 4 | low | undocumented-assumption | **The integration contract with feature 009 is implicit.** The spec says the script's "sole purpose" is a smoke-test target for feature 009 but never declares what feature 009 actually asserts (exit code only? exact stdout? stderr-clean?). | Add a "Consumer contract" note: "Feature 009 asserts: exit code 0 and stdout == `Hello, world!\n`. No other properties are tested." |

Source: adversarial review agent, review-feature phase
Date: 2026-04-24
