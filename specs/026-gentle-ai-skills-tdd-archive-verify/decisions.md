# Decisions

[2026-09-02T01:26:32Z] ADR-ACCEPTED: el usuario aprobó formalizar como `docs/adr/0005` el principio "phase handoffs se verifican con chequeos deterministas de la CLI, no con prosa del agente" (bypasses 021 y 294ccfc como evidencia; doctrina de gentle-ai como precedente). El ADR se crea como slice propio de la feature — no en la intake — para que entre al repo vía `sdd commit-slice` con sus `--files` declarados.

[2026-09-02T01:26:32Z] SCOPE: los tres pendientes van en una sola feature (definido por el usuario en la memoria Engram `sdd/026/backlog`: "Los tres pendientes de la próxima feature"). Lane full por multi-dominio + riesgo de integridad del pipeline.

[2026-09-02T01:26:32Z] DESIGN-INPUT: "lo mismo que hace gentle-ai" (respuesta del usuario sobre dónde vive la verificación post-archive) = ceremonia en CLI determinista + orquestador que confía solo en el exit code + test que scriptea al agente deshonesto. Verificado contra el repo de gentle-ai (docs/testing-agents-deterministically.md, internal/assets/skills/sdd-apply/strict-tdd.md, sdd-verify/strict-tdd-verify.md), clonado en scratchpad el 2026-09-01.

[2026-09-02T02:02:54Z] implemented-by: claude

## Delta: 2026-09-02 — Task T001
- **MODIFIED**: `branch-pr/SKILL.md` line 15 no se copió carácter-por-carácter del draft. El draft enlaza `[ADR 0004](../../../docs/adr/0004-cli-does-not-open-prs.md)`; ese filename real contiene el substring `open-pr`, uno de los diez símbolos retirados de la feature 024 que `tests/sweep-retired-symbols.test.js` barre sobre TODO `.claude/**` sin mecanismo de excepción (el propio archivo dice "Don't add a third exclusion ... fix the offending file instead"). Cambié esa línea para referenciar "ADR 0004 (`docs/adr/`, \"the CLI does not open PRs\")" en prosa, sin el filename literal — mismo significado, mismo documento, sin el substring prohibido. El resto de los 4 drafts (incluido el resto de branch-pr) se copió verbatim; confirmado con `diff` contra `~/.claude/sdd-skill-drafts/` antes del cambio.