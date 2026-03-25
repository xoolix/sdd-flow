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
4. Copy `.specify/templates/research-template.md` to `research/R-NNN-topic/research.md`.
5. Fill in the research document, using agents for parallel investigation:
   - **Brief**: What we're trying to learn
   - **Why now**: Why this blocks or de-risks future work
   - **Questions**: Specific questions to answer
   - **Options**: Alternatives to evaluate
   - **Evaluation criteria**: How to compare options
   - **Findings**: Launch **parallel agents** to investigate different aspects simultaneously:
     - Use **general-purpose agents** for web research on each option/question (one agent per option works well)
     - Use **Explore agents** to analyze relevant parts of the current codebase
     - Combine findings from all agents into a coherent analysis
   - **Recommendation**: Clear recommendation with tradeoffs and next step
6. Present the completed research to the user.

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
- Separate evidence from opinion.
- Compare options using explicit criteria.
- Always end with a concrete recommendation and next step.
- If linked to a feature, mention the feature-id in metadata.
- Always output the result envelope at the end.
