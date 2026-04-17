---
name: research-spike
description: Investigate an uncertain technical or product topic
user-invocable: true
disable-model-invocation: true
arguments: topic to investigate
context: fork
---

# Research spike

You received a research topic in `$ARGUMENTS`.

## Steps

1. Determine the next research number by scanning `research/` for existing `R-NNN-*` folders. Use the next sequential number, zero-padded to 3 digits.
2. Generate a kebab-case topic name.
3. Create `research/R-NNN-topic/`.
4. **Clarification phase (FATA — First Ask, Then Answer)**

   Before investigating, assess whether the topic has enough context to research effectively.

   **Guard clause**: If the user's request already specifies audience, constraints, and scope clearly — skip to step 5. Do NOT ask questions for the sake of asking.

   Otherwise:
   - Identify the **3 highest-uncertainty dimensions** for this topic (e.g., audience, scale, constraints, format, integrations, timeline, existing infra). Pick the 3 that would most change what you investigate.
   - Ask all 3 in a **single message**. Prefer guided choices over open-ended questions when possible (e.g., "¿Es para médicos o pacientes?" not "¿Quién es el usuario?").
   - **Round 2 (optional)**: If an answer opens a critical branch (e.g., "yes we have images" changes the entire approach), ask **1 follow-up**. Max 2 rounds total, then move on.
   - If ambiguity remains after 2 rounds, **declare your assumptions explicitly** and proceed.

5. Copy `.specify/templates/research-template.md` to `research/R-NNN-topic/research.md`.
6. Fill in the research document, using agents for parallel investigation:
   - **Brief**: What we're trying to learn
   - **Why now**: Why this blocks or de-risks future work
   - **Context gathered**: Key answers from the clarification phase (if it ran). Include any declared assumptions.
   - **Questions**: Specific questions to answer (refined by clarification phase)
   - **Options**: Alternatives to evaluate
   - **Evaluation criteria**: How to compare options
   - **Findings**: Launch **parallel agents** to investigate different aspects simultaneously:
     - Use **general-purpose agents** for web research on each option/question (one agent per option works well)
     - Use **Explore agents** to analyze relevant parts of the current codebase
     - Combine findings from all agents into a coherent analysis
   - **Recommendation**: Clear recommendation with tradeoffs and next step
7. Present the completed research to the user.
8. **Engram memory** (skip if Engram unavailable):
   - **On start**: `mem_search` with topic keywords + `project: "{project}"` — check if this was researched before or if related decisions exist
   - **During clarification**: If user reveals constraints or preferences → `mem_save` type: `preference` or `decision` immediately
   - **After research**:
     - `mem_save` topic_key: `sdd/research/{topic-kebab}`, type: `decision`, `project: "{project}"` — Recommendation, rationale, and key trade-offs (not a summary of the research.md — that's in the file)
     - If non-obvious findings that would help future work → `mem_save` type: `discovery` — the insight, not the raw finding
   - If linked to a feature: also save with topic_key `sdd/{feature-id}/research`

**Size budget**: The generated `research.md` MUST be under 1000 words. Prefer tables and bullet points over prose. Use comparison matrices for options.

## Result envelope

After completing, output:

```
## Result
- **Status**: success | partial | blocked
- **Summary**: [1-3 sentences with the recommendation]
- **Artifacts**: [research document path]
- **Next**: [recommended next step — /plan-feature, /new-feature, or further research]
- **Risks**: [remaining unknowns or "None"]
```

## Rules
- **NEVER use Plan Mode**: Do NOT use `EnterPlanMode`. Write files directly. Plan Mode breaks the SDD pipeline.
- Separate evidence from opinion.
- Compare options using explicit criteria.
- Always end with a concrete recommendation and next step.
- If linked to a feature, mention the feature-id in metadata.
- Always output the result envelope at the end.
