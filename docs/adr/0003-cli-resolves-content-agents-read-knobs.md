# ADR 0003: The CLI Resolves Content; Agents Read Knobs

## Status
Accepted (2026-08-26)

## Context

Feature 021 gave four consumers — `sdd-designer`, `sdd-research-spike`, `new-feature/SKILL.md`
and `plan-feature/SKILL.md` — an explicit instruction to read `.claude/rules/conventions.md`
§ Domain rules before naming a spec or plan's modules. Its discovery phase (F1) chose that
shape deliberately, over the alternative of having the orchestrator resolve the file and inject
the result. Two facts drove it:

1. `CLAUDE.md` claims Claude Code loads `.claude/rules/*.md` automatically. Verified against the
   code, that does not hold for spawned sub-agents — every existing consumer fetches the file
   itself. `sdd-designer.md` mentioned rules nowhere in its 52 lines; `sdd-phase-common.md`
   mentioned them nowhere in 237.
2. There was a proven precedent to copy: the `auto-commit` knob in `git.md` and the `tdd` knob in
   `testing.md`, both grepped by the agent from inside its own prompt body.

So 021 copied the knob pattern. The cross-model reviewer then found the flaw, and it was not in
the instruction — it was in what could be verified about it:

> The acceptance test never exercises a consuming agent or filled artifact. The T008 tests only
> call `bin/sdd`'s `extract_section` against `conventions.md` and a synthetic empty file.
> **Production consumers do not call `extract_section`.**

The test proved the *file* was parseable by an awk matcher nothing in production uses. The
mechanism the consumers actually run — a grep inside an LLM's prompt — has no executable
surface at all, so AC2 and AC6 could fail completely with the whole suite green.

## Decision

Split the two cases that 021 treated as one.

**A knob is read by the agent.** A knob is a small, closed decision — on/off, strict/off — that
the agent branches on. `auto-commit: on|off`, `tdd: strict|off`. The agent greps the rules file
from its own prompt body. The value space is tiny, the branch is visible in the agent's own
instructions, and a content-assertion test on that instruction is honest about what it covers.

**Content is resolved by the CLI.** When an agent needs the *substance* of a rules file — a list
of domain names, a vocabulary, anything whose value is the text itself — it calls a `bin/sdd`
subcommand that reads the file and prints the content, exiting non-zero when there is none.
Consumers stop grepping.

The reason is verifiability, not tidiness. A CLI subcommand is the same code in the test and in
production, so a jest test against a temp project exercises the shipped path. A grep instruction
inside a prompt can only be tested by asserting the instruction's text exists — which passes
whether or not any agent obeys it.

## Alternatives considered

1. **Align the test to the consumers' grep.** Stop sourcing `extract_section`; assert with the
   same pattern the agents are told to use. Cheap, no new surface, keeps F1 intact. Rejected: it
   still verifies that the *file* is greppable, not that the agent greps it. The gap survives,
   better labelled.

2. **Build an agent-eval harness** — seed distinctive names, invoke the designer for real,
   inspect the produced artifact. This is the only thing that closes the gap completely, and it
   is what the cross-reviewer suggested. Rejected for now: an entire new capability, expensive
   and slow, introduced by a feature whose job was fixing five specific defects. It remains the
   right answer for verifying prompt-driven behaviour generally, and is not foreclosed by this.

3. **Keep everything as knobs read by agents (status quo, F1).** Rejected: it is precisely what
   produced an acceptance criterion that could not fail.

## Consequences

**Positive**:
- The domain-vocabulary path becomes executable, so its test exercises production code rather
  than an adjacent mechanism.
- The rule for future rules-file consumers is now decidable without re-litigating: is the value
  a branch, or is it the content?
- Fewer prompt instructions carrying load-bearing mechanics.

**Negative / Trade-offs**:
- Partially reverses a decision made one feature earlier. Anyone reading 021's archived
  `discovery.md` will find F1 asserting agents read the file directly; this ADR is what tells
  them the rule was refined rather than broken.
- One more CLI subcommand to version, and consumers now depend on `bin/sdd` being deployed for a
  read they previously did themselves.
- The boundary is a judgement call at the margin. "Is this a knob or content?" has clear answers
  at both ends and a grey middle.

**Operational**:
- The knobs that exist today (`auto-commit`, `tdd`) stay exactly as they are. This changes no
  existing behaviour; it sets the rule for the vocabulary read and for whatever comes next.

## References
- Spec: `specs/022-pipeline-integrity-fixes/spec.md`
- Refines: F1 in `specs/archive/2026-08-25-021-project-aware-templates/discovery.md`
- Finding that forced it: the `## CROSS-REVIEW` section in that feature's `decisions.md`
- Related: `docs/adr/0002-sdd-git-write-boundary.md` (same principle applied to git writes)
