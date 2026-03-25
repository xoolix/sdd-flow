---
name: new-feature
description: Create a feature spec from an idea through conversational refinement
user-invocable: true
disable-model-invocation: true
arguments: idea or request description
---

# Create new feature spec (conversational)

You received a feature idea/request in `$ARGUMENTS`.

## Approach

Do NOT generate the full spec at once. Instead, have a short conversation to gather what you need. Ask one thing at a time, in this order:

### 1. Confirm understanding
Restate the idea in one sentence. Ask: "Is this what we're building? Anything to add or correct?"

### 2. Trigger
Ask: "What triggers this? (user action, API call, cron job, event, etc.)"

### 3. Happy path
Ask: "Walk me through the main flow — what happens step by step when everything goes right?"

### 4. Domains
Based on what you've heard so far, propose which domains are involved (e.g., database, API, frontend, infrastructure, auth, notifications). Ask: "Does this touch other areas I'm missing?"

### 5. Edge cases
Ask: "What could go wrong? What are the tricky cases?" Push for at least 2 concrete edge cases. If the user only gives one, ask for another.

### 6. Acceptance criteria
Ask: "How do we know this is done? Give me at least 2 criteria in **Given/When/Then** format:
- Given [precondition], When [action], Then [expected result]"

If the user gives free-form criteria, help them rewrite into Given/When/Then before moving on.

### 7. Rollback & success criteria
Ask: "If something goes wrong after deploy, how do we revert? And what measurable indicators tell us this is working correctly?"
Push for:
- A concrete rollback strategy. (feature flag, revert commit, DB migration down, etc.)
- At least 1 measurable success criterion not vague — (e.g., "error rate < 0.1%" not "it works")

## Quality gate

Before writing the spec, verify you have ALL of these:
- [ ] Clear trigger
- [ ] Happy path with numbered steps
- [ ] At least 2 edge cases
- [ ] At least 2 acceptance criteria in Given/When/Then format
- [ ] Rollback plan
- [ ] At least 1 measurable success criterion

If anything is missing, ask one more targeted question. Do NOT generate the spec until the gate passes.

## Generate the spec

Once the gate passes:

1. Determine the next feature number by scanning `specs/` for existing `NNN-*` folders. Use the next sequential number, zero-padded to 3 digits.
2. Generate a kebab-case feature name from the idea.
3. Create the folder `specs/NNN-feature-name/`.
4. Copy `.specify/templates/spec-template.md` to `specs/NNN-feature-name/spec.md` and fill it in with everything gathered.
5. Create an empty `specs/NNN-feature-name/decisions.md` with a `# Decisions` header.
6. Present the completed spec to the user.
7. If there are open questions or significant technical uncertainty, suggest running `/research-spike`.
8. Tell the user the next step is `/plan-feature NNN-feature-name`.

**Size budget**: The generated `spec.md` MUST be under 650 words. Prefer tables over prose. Be concise.

## Result envelope

After generating the spec, output this summary:

```
## Result
- **Status**: success | partial | blocked
- **Summary**: [1-3 sentences describing what was created]
- **Artifacts**: [files created]
- **Next**: /plan-feature NNN-feature-name (or /research-spike if uncertainty exists)
- **Risks**: [open questions or ambiguities, or "None"]
```

## Rules
- Ask one question at a time. Wait for the answer before moving on.
- Keep the spec implementation-agnostic when possible.
- Flag ambiguity explicitly in open questions.
- Do not create plan.md or tasks.md yet — that's `/plan-feature`.
- Always output the result envelope at the end.
