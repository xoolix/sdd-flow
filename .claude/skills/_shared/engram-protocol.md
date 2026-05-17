# Engram Protocol for SDD Phases

This file defines how SDD phases interact with Engram persistent memory. All phases MUST follow this protocol.

> **Graceful degradation**: If Engram MCP tools are unavailable (not installed or not configured), skip all `mem_*` calls and continue with file-based persistence only. Do NOT block the pipeline because of missing Engram.

---

## Authority Model

Engram is supporting context, not source of truth.

Precedence order:

1. Current user message and explicit decisions in this conversation.
2. State files in the repo (`spec.md`, `quick-spec.md`, `plan.md`, `tasks.md`, `decisions.md`, ADRs).
3. Current codebase.
4. Engram memories.

Memory can suggest a question, warning, or candidate pattern. It can never override a spec, skip an SDD gate, silently fill user answers, or authorize a behavior that is not in current repo files.

---

## Project Name Convention

All `mem_save` and `mem_search` calls MUST use the correct `project` parameter:

1. Detect from git remote: `git remote get-url origin` → extract repo name (e.g., `github.com/user/my-app` → `my-app`)
2. Fallback: use the current directory name
3. **Never** use skill names, phase names, or invented names (e.g., never "sdd-flow")

The orchestrator resolves the project name ONCE at session start and passes it to all sub-agents in their launch prompt.

---

## Topic Key Convention

| Pattern | When to use |
|---------|------------|
| `sdd/{feature-id}/{phase-name}` | Feature-specific (phase = `spec`, `plan`, `implement`, `review`, `archive`) |
| `sdd/research/{topic-kebab}` | Research spikes (may or may not be linked to a feature) |
| `sdd/{feature-id}/research` | Research linked to a specific feature (in addition to the research topic key) |
| `project/{topic}` | Cross-feature knowledge (e.g., `project/quality-patterns`, `project/auth-conventions`) |

---

## Memory Types

| Type | When to use |
|------|------------|
| `decision` | Architectural or design choices, trade-offs the user confirmed |
| `architecture` | Structural observations about the codebase |
| `pattern` | Reusable patterns discovered or applied |
| `discovery` | Unexpected findings, gotchas, edge cases |
| `learning` | Lessons learned, what worked or didn't |
| `preference` | User preferences, constraints, or working style |
| `event` | Sparse lifecycle marker with a verdict/status that helps recovery |

---

## Retrieval Policy

Search memory at phase start, but keep it bounded:

- Feature-specific search: `sdd/{feature-id}`.
- Domain search: 2-4 concrete keywords from the spec/code domain.
- Project search: only when looking for reusable patterns or quality history.

Use retrieved context as hints:

- Good: "A previous feature used middleware X here — should this one follow it?"
- Bad: "Memory says use X, so I implemented X without checking current code/spec."

If memory conflicts with files or current user input, trust files/user and optionally save a new `learning` explaining the superseded memory.

---

## What to Save (and what NOT to)

### Save — things that files don't capture

- **User decisions and trade-offs**: "User chose X over Y because Z"
- **Gotchas discovered during implementation**: "The API returns 200 even on validation errors"
- **Cross-feature patterns**: "In this repo, auth always goes through middleware X"
- **User preferences per project**: "User prefers integration tests over unit tests here"
- **Why something was done a certain way**: The reasoning behind a choice, not the choice itself (the choice is in the code)
- **Context that would help the next feature**: "The payments module is fragile, avoid touching it"
- **Sparse lifecycle events**: phase verdicts, blockers, unresolved human decisions that help recover after compaction

### Don't save — things already captured elsewhere

- Summaries of what files were created (that's in git)
- "Feature X was archived" (that's in the archive folder)
- Restating what's in the spec or plan (that's in the files)
- Generic observations without actionable insight
- Raw command output unless the exact output explains a reusable gotcha
- Temporary session-management details, prompt instructions, or "the user said skip questions"

### Never save

- Secrets, credentials, tokens, keys, connection strings, private URLs, or customer/user PII.
- Full proprietary documents, large code snippets, or copied specs.
- Sensitive production data or logs.
- Anything that would be unsafe if reused in another repo.

### Quality check before saving

Before calling `mem_save`, ask: **"Would this help someone starting a new feature in this project 3 months from now?"** If no, don't save.

Also ask:

- Is it still true after checking current files?
- Is it specific enough to act on?
- Is it safe to persist?

If any answer is no, don't save.

---

## Save Granularity

Prefer small facts over broad summaries.

| Scope | Topic key | Content |
|---|---|---|
| Feature-local | `sdd/{feature-id}/{phase}` | Decisions, blockers, gotchas for this feature |
| Cross-feature | `project/{topic}` | Reusable repo pattern, recurring quality issue, durable user preference |
| Research | `sdd/research/{topic-kebab}` | Recommendation, rejected alternatives, constraints |

Do not duplicate the same fact into multiple topic keys unless it has both feature-local and cross-feature value. If you do duplicate, make the cross-feature version shorter and more general.

---

## Phase Start Protocol

At the START of every phase, before doing any work:

1. Call `mem_search` with query `sdd/{feature-id}` and `project: "{project}"` to recover prior context for this feature.
2. Call `mem_search` with 2-4 broader keywords from the feature domain (e.g., "auth", "payments", "chat") to find relevant cross-feature knowledge.
3. If results exist, read them to understand decisions and discoveries from prior phases or related work.

---

## Proactive Save Protocol

Do NOT wait until the end of the phase to save. Save **immediately** when any of these happen:

- User makes a non-obvious decision or trade-off
- You discover a gotcha or unexpected behavior in the codebase
- You find a pattern that would help future features
- You learn a user preference or constraint
- An approach fails and you pivot — save why it failed

Use `mem_save` with:
- `project`: the resolved project name (never a skill/phase name)
- `topic_key`: `sdd/{feature-id}/{phase-name}` for feature-specific, or `project/{topic}` for cross-feature knowledge
- `type`: the appropriate type from the table above
- `content`: structured as `**What**: ... **Why**: ... **Where**: ... **Learned**: ...`

Keep entries concise: 2-5 sentences. Actionable over descriptive. Exception: `/archive-feature` saves a longer snapshot as permanent record (see archive section below).

---

## Phase End Protocol

At the END of every phase, before producing the return envelope:

1. Review what happened during the phase.
2. Save anything not yet saved that passes the quality check.
3. **Sub-agents must save before returning** — they have the freshest context. Don't rely on the orchestrator to save for you.

---

## Archive: Permanent Feature Memory

When `/archive-feature` runs, it saves a **complete feature snapshot** to Engram. This is the permanent record because:
- Spec files may not be pushed to the repo
- The archive folder may be gitignored or cleaned up
- Engram persists across repos and machines

The archive save includes:
- Feature scope and key requirements (from spec)
- Architecture approach chosen (from plan)
- Key decisions and trade-offs (from decisions.md)
- Gotchas and learnings from implementation
- Review verdict and any spec gaps found

This is the ONE place where saving a summary of artifacts is appropriate.

---

## Compaction Safety Protocol

Context compaction can happen mid-session, causing loss of working memory.

### On Session Start (orchestrators only: sdd-next, sdd-auto)

1. Resolve project name from git remote
2. Call `mem_session_start` with `project: "{project}"`, description: `SDD pipeline: {feature-id}`
3. Call `mem_context` with `project: "{project}"` to load existing context

### On Session End (orchestrators only: sdd-next, sdd-auto)

1. Call `mem_session_summary` with `project: "{project}"` — phases completed, current state, blockers
2. Call `mem_session_end`

### After Compaction Recovery (orchestrators)

If an orchestrator detects it has lost context:
1. Call `mem_context` with `project: "{project}"` to reload feature context
2. Re-read the state files (spec.md, plan.md, tasks.md) to re-derive the current phase
3. Continue the pipeline from the detected phase

---

## Active session detection

Use this section to decide whether to call `mem_session_start` at the top of any SDD phase.

### (a) Response shape — no active session

`mem_context` returns a markdown string whose first subsection (after `## Memory from Previous Sessions`) is `### Recent Observations`. The `### Recent Sessions` heading is **absent**.

```
## Memory from Previous Sessions

### Recent Observations
- [type] **title**: content ...
```

### (b) Response shape — active session exists

`mem_context` returns the same markdown string but with a `### Recent Sessions` block **prepended before** `### Recent Observations`. The block lists one or more entries with session id, timestamp, and observation count.

```
## Memory from Previous Sessions

### Recent Sessions
- **{project}** (YYYY-MM-DD HH:MM:SS) [N observations]

### Recent Observations
- [type] **title**: content ...
```

### (c) Disambiguator field

Check for the literal heading `### Recent Sessions` in the `mem_context` response string.

- Present → an active session exists → **SKIP** `mem_session_start`.
- Absent → no active session → **CALL** `mem_session_start`.

### (d) Engram-unavailable fallback

If `mem_context` errors, times out, or returns a response that does not contain `## Memory` (malformed / unexpected shape):

- Assume **no active session**.
- Call `mem_session_start` as if starting fresh.
- Do NOT block or error the pipeline due to Engram unavailability.
