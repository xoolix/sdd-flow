---
name: init-project
description: Scan the codebase and auto-generate architecture map and conventions
user-invocable: true
disable-model-invocation: true
---

# Initialize project

Scan this project's codebase and generate architecture documentation and conventions.

## Steps

### 1. Detect project structure

Use the **Explore agent** to thoroughly analyze the codebase:

```
Launch an Explore agent (subagent_type: "Explore", thoroughness: "very thorough") with this prompt:
"Analyze this codebase thoroughly. Report:
1. Languages and frameworks used (check package.json, Cargo.toml, go.mod, pyproject.toml, requirements.txt, etc.)
2. Directory structure and what each top-level directory contains
3. Entry points (main files, app routers, CLI entry)
4. Database/data stores (look for migrations, schemas, ORMs, connection configs)
5. External integrations (APIs, SDKs, third-party services)
6. Build/deploy setup (Dockerfiles, CI configs, IaC)
7. Test framework and test locations
8. Lint/format configuration
9. Package manager (npm, pnpm, yarn, pip, cargo, etc.)
10. Any existing documentation or ADRs"
```

### 2. Generate architecture-map

Based on the Explore agent's findings, rewrite `.claude/skills/architecture-map/SKILL.md` with the actual project architecture. Keep the frontmatter:

```yaml
---
name: architecture-map
description: High-level map of how this repository is structured and where changes should land
user-invocable: false
---
```

Then document:
- **One-line description** of what this project is
- **Apps / Packages** — top-level modules with their directories
- **Shared Libraries** — reusable internal modules
- **API Boundaries** — endpoints, routes, handlers
- **Data Stores** — databases, caches, file storage
- **External Integrations** — third-party services, APIs
- **Operational Entrypoints** — dev, build, test, deploy commands

Use the existing architecture-map format as reference but fill with real data from this project.

### 3. Pre-fill conventions

Update `.claude/rules/conventions.md` based on detected conventions:

- **Stack**: Fill in the actual frameworks, languages, libraries detected
- **Naming**: Detect from existing code (kebab-case files? camelCase? snake_case?)
- **Folder structure**: Document the actual folder structure
- **Lint / Format**: Detect from config files (eslint, prettier, ruff, clippy, etc.)
- **Domain rules**: Leave as TODO for the user to fill

If `conventions.md` already has non-template content, ask the user before overwriting.

### 4. Pre-fill testing conventions

Update `.claude/rules/testing.md` based on detected test setup:

- **Framework**: Detect from config (vitest, jest, pytest, go test, etc.)
- **File placement**: Detect from existing test files
- **Naming**: Detect naming patterns
- **Running tests**: Detect from package.json scripts or Makefile

If `testing.md` already has non-template content, ask the user before overwriting.

### 5. Pre-fill git conventions

Update `.claude/rules/git.md` based on detected patterns:

- Check git log for commit message conventions
- Check for existing branch naming patterns
- Check for CI/CD pipelines
- Detect deploy strategy from Dockerfiles, IaC

If `git.md` already has non-template content, ask the user before overwriting.

### 6. Summary

Present what was generated and what still needs manual attention:

```
## Project initialized

Architecture: .claude/skills/architecture-map/SKILL.md ✔
Conventions:  .claude/rules/conventions.md ✔
Testing:      .claude/rules/testing.md ✔
Git:          .claude/rules/git.md ✔

Manual attention needed:
- [ ] Review and adjust conventions.md (domain rules section)
- [ ] Review architecture-map for accuracy
- [ ] Add any domain-specific rules

Ready to use: /new-feature, /research-spike, /plan-feature
```

## Rules
- Use the Explore agent — do not manually scan hundreds of files.
- Be accurate — only document what actually exists in the codebase.
- Do not invent or assume things that aren't in the code.
- If the project is empty (no source code yet), generate minimal placeholders and tell the user to re-run after adding code.
- Preserve any existing non-template content in rules files (ask before overwriting).
