# Technical Plan

## Inputs
`spec.md`, `clarify.md`, `discovery.md`, `decisions.md` (DISCOVERY-ACCEPTED F1, F2). Written with the **old** template; AC6 regenerates it.

## Current state
- Fixed taxonomy is **already ignored** — 1/17 specs, 0/6 research used it (~94% workaround, F4). The damage is 16 vocabularies for one question, not blocked agents: the value is shared vocabulary, not permission.
- That vocabulary has **no delivery mechanism** — no sub-agent gets `.claude/rules/*.md` ambiently; `sdd-designer.md` never mentions it (F1). Proven pattern: explicit per-agent read (`auto-commit`, `sdd-implement-task.md:75`).
- `plan-template.md` has zero HTML comments and is **not** copied (`sdd-designer.md:23` "as base", F2).
- Safe to restructure (unparsed): `## Domains`, `## Touched areas`, `## Evaluation criteria`. Frozen (parsed): `## Tasks`, `Summary`, `Acceptance Criteria`, `Rollback Plan` — `extract_section` (`bin/sdd:905`) degrades **silently** on rename.

## Proposed design
The `conventions.md` half is the spine: templates stop prescribing; agents are told where vocabulary comes from.

**1 — Literal replacements.** `spec-template.md:15-24` →
```
## Domains
<!-- Name the real modules touched. No checklist. Names come from
     `.claude/rules/conventions.md` § Domain rules if it has content,
     else from your Step 0 scan. One line per module. -->
- `<path/or/module>` — <what changes>
```

`plan-template.md` `## Touched areas` → drops its 4 sub-fields for a `| Module / path | Change |` table. `## Migration / rollout` and `## Observability` drop their sub-field lists to one line: real content or `N/A — <reason>`.

`research-template.md:26-33` →
```
## Evaluation criteria
<!-- Derive from what is evaluated. The vendor list (cost, lock-in,
     team fit) applies only when the options ARE vendors. -->
-
```

**2 — Placement differs per template (F2).** `spec-` and `research-template.md` are copied literally (`new-feature/SKILL.md:165`, `sdd-research-spike.md:31`), so their comment reaches the agent. `plan-template.md` is not — only its *shape* travels, so its prose goes in `plan-feature/SKILL.md:94-104` + `sdd-designer.md:25-34`, dropping "APIs, DB/schema, jobs, UI" and making the two conditional.

**3 — Explicit read instruction (F1)**, added to `sdd-designer.md`, `sdd-research-spike.md`, `new-feature/SKILL.md`, `plan-feature/SKILL.md`:

> **Domain vocabulary.** Before filling any domain/module section, grep `.claude/rules/conventions.md` for `## Domain rules`. Content past the comment ⇒ use that vocabulary; empty ⇒ derive from your Step 0 scan. Mirrors the `auto-commit` knob in `git.md`: the agent reads the rules file directly, the CLI never does.

**4 — N/A convention (F5)**: **`N/A — <reason>` as a section value** (`new-feature/SKILL.md:180`) — the discard is section-level and so is that form. Field-level `N/A (reason)` stays for fields. No new syntax.

**5 — `/init-project`**: add an 11th ask to its Explore prompt — *"Name the functional domains (business areas, not directories)"*; `:64` "Leave as TODO" → write them under § Domain rules; reuse its overwrite guard verbatim (`:66`, `:115`). Dropped per F7: the `sdd-reviewer` edge case — `:43` audits code, not headings.

## Data flow
`/init-project` Explore → § Domain rules → grep by consumer → domain section. Absent → agent scan.

## Touched areas
| Module / path | Change |
|---|---|
| `.specify/templates/{spec,plan,research}-template.md` | rewrites above |
| `.claude/agents/sdd-designer.md`, `sdd-research-spike.md` | read instruction, fill list |
| `.claude/skills/{plan-feature,new-feature,init-project}/SKILL.md` | read instruction; init fill + Explore ask |
| `.claude/rules/conventions.md` | § Domain rules for *this* repo |
| `tests/sdd.test.js` | see Test strategy |

## Migration / rollout
Templates are symlinked to SDD_HOME — every project updates instantly, no `sdd update`. Additive: a project that never ran `/init-project` degrades to scan-derived names. Rollback = revert.

## Observability
N/A — no runtime surface; this feature is prose read by agents.

## Test strategy
No CLI surface here, so `readFileSync` + `toContain` goes red-then-green **without verifying behavior** — 3 of the suite's 18 prose assertions already produced false greens. Labeled honestly:

- **Genuine** — build a `spec.md` from the *changed* `spec-template.md` via `makeTempProject`, run the real `extract_section` path (`bin/sdd:946/948/950`), assert `Summary`/`Acceptance Criteria`/`Rollback Plan` return non-empty. Catches silent degradation.
- **Genuine, one-shot (AC6)** — rerun `sdd-designer` on 021 with the new templates, diff against this file: (a) zero `APIs/contracts:`, `DB/schema:`, `Jobs/workers:`, `UI surfaces:`; (b) `## Touched areas` names ≥3 real repo paths; (c) ≥1 `^N/A — ` line; (d) <800 words.
- **Regression guard, not coverage** — templates lack the 8 old labels / 7 vendor criteria; the 4 consumers hold the read instruction. Prevents deletion, verifies nothing. Do not count these as coverage.

## Risks and mitigations
| Risk | Mitigation |
|---|---|
| `conventions.md` is also the **seed** `bin/sdd:232-241` copies into every new project (F10) | Fill § Domain rules with *this repo's* domains only; `cmd_init` skips existing files, so live projects stay untouched. Flag in the PR body. |
| HTML-comment guidance never reaches human readers (0/11 survive, F3) | Accepted — it targets the agent at fill time; humans read `conventions.md`. |
| Empty `conventions.md` ⇒ drift continues | Expected floor, equals today. `/init-project` is the fix. |
| Feature 020 merge conflict | `tasks-template.md` untouched. |

## Open questions
- None.
