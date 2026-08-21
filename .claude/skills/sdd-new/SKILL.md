---
name: sdd-new
description: Universal SDD entrypoint — decide fix vs quick feature vs full spec, then run the right intake inline
user-invocable: true
disable-model-invocation: true
arguments: idea or request description
---

# Start new SDD work

User's input: `$ARGUMENTS`

This is the **single default entrypoint** for new SDD work. It decides which lane fits:

| Lane | Use when | Intake |
|---|---|---|
| `fix` | Existing behavior is broken and Current/Expected/Unchanged can describe it, with no escalation trigger | `/new-fix` protocol |
| `quick` | Small enhancement/refactor, single-domain, no new deps, ≤2 GWT, and no escalation trigger | `/new-quick-feature` protocol |
| `full` | Multi-domain, new deps, high uncertainty, architecture, >2 GWT, risk trigger, or unclear scope | `/new-feature` protocol |

Direct `/new-fix`, `/new-quick-feature`, and `/new-feature` commands remain available for explicit control. `/sdd-new` is what a developer should reach for by default.

## What to do

**Main Claude executes this inline.** Do NOT launch a sub-agent.

### Step 1 — Classify lane

Classify from `$ARGUMENTS` first:

- If the request says bug, fix, regression, broken, error, failing, Current/Expected, "no funciona", "rompe", "falla", or describes existing behavior that should change → candidate `fix`.
- Else if it is explicitly small, refactor, copy/text tweak, UI polish, one component/module, no deps, or the user says "cambio chico" → candidate `quick`.
- Else candidate `full`.

Then apply the **fast-lane confidence gate**. A `fix` or `quick` candidate may stay fast-lane only if all are true:

| Gate | Required for fast-lane |
|---|---|
| Domain | One bounded module/folder/service; no cross-cutting behavior |
| Dependencies | No new package, vendor, queue, service, or infra dependency |
| Acceptance | 1-2 Given/When/Then criteria can describe done |
| Data | No schema/data migration and no irreversible data mutation |
| Contract | No public API, auth/permission, billing/payment, or integration contract change |
| Risk | No concurrency, time-zone, privacy/security, perf-critical, or rollback-hard behavior |

If any gate is false or unknown, choose `full`.

#### Escalation triggers

Any of these force `full` even when the user calls it "small":

- Multiple domains with meaningful changes (frontend + API + DB, worker + API, auth + data, etc.).
- New dependency, external service, background job, migration, or deployment/runtime config.
- Security, permission, privacy, billing, payments, audit logs, destructive writes, or data integrity.
- Public API/SDK/event contract change, backward compatibility concern, or multi-client impact.
- More than 2 acceptance criteria, unclear rollback, or user-visible behavior with multiple modes.
- Ambiguous scope after one triage question.

#### Tiny-change override

Very small changes can be `quick` even if they touch two files, provided they still satisfy the fast-lane confidence gate. Examples: copy text + snapshot update, CSS tweak + component test, small refactor + adjacent unit test.

If classification is ambiguous, ask **one** triage question with a recommendation:

```
Recomendación: lo trataría como <fix|quick|full> porque <reason>.
¿Confirmás esa lane o preferís otra?
```

Only ask more triage if the user's answer makes the lane impossible:

- `fix` requires a clear Current/Expected/Unchanged bug frame.
- `quick` requires the fast-lane confidence gate above.
- Anything else escalates to `full`.

### Step 2 — Execute chosen intake

Do not launch a sub-agent. Intake phases are conversational and need multi-turn user dialogue — the Skill tool loads the skill body into the current context, so the conversation stays inline in main Claude.

- `fix`: invoke the `new-fix` skill via the Skill tool, passing `$ARGUMENTS` as args.
- `quick`: invoke the `new-quick-feature` skill via the Skill tool, passing `$ARGUMENTS` as args.
- `full`: invoke the `new-feature` skill via the Skill tool, passing `$ARGUMENTS` as args.

Do NOT re-implement or paraphrase the intake from memory — always load it via the Skill tool so the current SKILL.md body governs the flow.

The fast lanes (`fix`, `quick`) no longer re-ask a 4-question entry gate — you already chose the lane here, and they trust that. Each fast lane scans the code first (its Step 0) and carries a **silent escalation guard**: if the scan reveals a concrete hard trigger (migration, auth/permissions, billing, public API/contract, concurrency, rollback-hard), it invokes the `new-feature` skill with the same intent on its own. Do not ask the user to re-run a different command.

**CRITICAL — why this skill must NOT delegate to a sub-agent**: the adversarial interview requires multi-turn dialogue with the user. Sub-agents run one-shot and return; they cannot pause to ask the user mid-flow. If you delegate, the agent will silently auto-fill answers with assumptions and surface them only as "Open Questions" in its final envelope — defeating the entire purpose of the interview.

### Step 3 — Handoff

When the chosen intake produces its result envelope, relay it to the user and append:

```
Para continuar, escribí `/sdd-next <feature-id>` o `/sdd-auto <feature-id>`.
```

## Rules

- `/sdd-new` owns lane choice. The user should not need to know `/new-fix` vs `/new-quick-feature` vs `/new-feature`.
- Prefer fast-lane only when it clearly fits. If the scope is fuzzy, choose `full`.
- Do not create both `spec.md` and `quick-spec.md` for the same feature.
- Do not delegate lane intake to a sub-agent.
