# Discovery Report
status: findings-present

## High-impact findings

### DF-1 — Phase detection table: new column vs. reordered check
**Category**: conflict
**Impact**: high

The phase detection tables in `CLAUDE.md` (lines 100-107) and `sdd-continue/SKILL.md` (lines 42-47) today have 3 columns: `spec.md? | plan+tasks? | all [x]?`. The final row `Yes | Yes | Yes → /review-feature` must be split when `simplify-code` enters the pipeline. Two design options:

- **Option A — Add a 4th column `.simplified exists?`**
  - Pros: explicit; all rows have uniform schema; table reads left-to-right through all gates.
  - Cons: every row must grow a column; the column is N/A for rows where tasks aren't yet `[x]`.
- **Option B — Reorder detection logic (check sentinel before task completion)**
  - Pros: table stays 3 columns; sentinel becomes a pre-check in prose outside the table.
  - Cons: phase detection is no longer fully expressible in the table; readers must also read surrounding prose.

**Decision needed**: which option?

### DF-2 — "Last validation green" pre-flight — trust vs re-run
**Category**: edge-case
**Impact**: high

Spec's pre-flight says "last validation green" but no state file records this today. Two options:

- **Option A — Trust implement-task** (no re-run): If `/implement-task` completed without `Status: blocked`, assume green. Fast. Risk: if a later manual edit introduced a regression, simplify-code starts on red.
- **Option B — Re-run validation as the first act of simplify-code**: Lint + typecheck + tests run before any edit. If red → `Status: blocked` immediately with diagnostic. +~30-60s latency per run but guaranteed baseline.

**Decision needed**: which option? (Option B is safer for AC-2 "regression revert" because it distinguishes "simplify broke it" from "it was already broken".)

### DF-3 — SPEC-GAP-HIGH: does it also delete the sentinel?
**Category**: edge-case
**Impact**: high

`/review-feature` has two FAIL paths:
- **Conformance FAIL** (majority FAIL, single FAIL with majority PASS/WARN, or no majority) — emits `Verdict: FAIL`.
- **Adversarial SPEC-GAP-HIGH** — emits `Status: blocked` but the conformance verdict may still be PASS.

Spec AC-5 says: "When `/review-feature` issues a `FAIL` verdict, Then `.simplified` is deleted." SPEC-GAP-HIGH is not a conformance FAIL — it's a spec issue, not code issue.

- **Interpretation A — Only conformance FAIL deletes sentinel** (literal reading of AC-5). SPEC-GAP-HIGH pauses for human spec edit; if the human doesn't touch code, simplify does not re-run. Matches spec wording.
- **Interpretation B — Any blocked state deletes sentinel**. If the human updates the spec AND implementation, simplify re-runs. But if only the spec changes, simplify runs redundantly on unchanged code.

**Decision needed**: confirm Interpretation A (consistent with AC-5) or switch to B.

## Other findings

### DF-4 — `git checkout --` revert pattern (medium)
No existing skill does file-scoped revert. Proposed pattern: record list of modified files before edits, then `git checkout -- <file1> <file2>` on failure. Design agent should specify this explicitly.

### DF-5 — Exclusion filter for `git diff` output (medium)
Spec mentions "excluding tests, lockfiles, migrations, configs" but doesn't list exact globs. Design agent will propose explicit globs based on project conventions.

### DF-6 — Model assignment = sonnet (medium)
Spec silent on model. `implement-task` uses sonnet as executor; simplify-code should match. Design agent will confirm.

### DF-7 — `archive-feature` naturally cleans sentinel (low)
`archive-feature` Step 3 moves the whole `specs/<id>/` folder to `specs/archive/<date>-<id>/`. The sentinel rides along with the move — no explicit cleanup needed. Optional cosmetic pre-move delete.

### DF-8 — `implement-task` pattern reusable (low)
Frontmatter, pre-flight, validation, envelope, engram hooks all reusable as-is for simplify-code.

### DF-9 — `discovery.md` is sentinel precedent (low)
Not a new concept — `discovery.md` already uses file-presence for phase routing.

### DF-10 — Retry budget + Status: blocked inherited (low)
Max-2 retry and `Status: blocked` handling in orchestrator apply to simplify-code naturally.

## User decisions

- DISCOVERY-ACCEPTED:DF-1 Option A — add 4th column `.simplified exists?` to phase detection tables in CLAUDE.md and sdd-continue/SKILL.md. Tabla = única fuente de verdad.
- DISCOVERY-ACCEPTED:DF-2 Option B — re-run lint+typecheck+tests as the first act of /simplify-code before any edit. Baseline verde garantizado; AC-2 se vuelve determinista.
- DISCOVERY-ACCEPTED:DF-3 Interpretation A — only conformance FAIL deletes `.simplified` (literal AC-5). SPEC-GAP-HIGH leaves sentinel intact; human manages manually if code changed during spec-fix.
- DISCOVERY-ACCEPTED:DF-4 Use `git checkout -- <file1> <file2> ...` with explicit file list (recorded before edits). No wildcards.
- DISCOVERY-ACCEPTED:DF-5 Design agent proposes explicit exclusion globs (tests, lockfiles, migrations, configs) in plan.md.
- DISCOVERY-ACCEPTED:DF-6 Model = sonnet (matches implement-task as executor).
- DISCOVERY-ACCEPTED:DF-7 No explicit sentinel cleanup in archive-feature — the folder move handles it naturally.
- DISCOVERY-ACCEPTED:DF-8 Reuse implement-task pattern for frontmatter, pre-flight, validation, envelope, engram hooks.
- DISCOVERY-ACCEPTED:DF-9 .simplified follows discovery.md as sentinel precedent.
- DISCOVERY-ACCEPTED:DF-10 Inherit orchestrator retry budget (max 2) and Status: blocked handling as-is.
