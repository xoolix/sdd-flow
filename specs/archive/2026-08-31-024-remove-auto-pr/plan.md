# Technical Plan — 024 remove-auto-pr

## Inputs
`spec.md` (6 AC) · `clarify.md` · `discovery.md` (11 decisiones) · `decisions.md`. Sin research. Vocabulario resuelto por la CLI (ADR 0003); su entrada `CLI surface` lista `open-pr`, corregida **en tránsito**.

## Domain analysis

| Domain | Tamaño |
|---|---|
| CLI surface | MEDIUM |
| Orchestration skills | MEDIUM |
| Test suite | MEDIUM |
| Rules layer | SMALL |
| Artifact templates | SMALL |

Cinco dominios darían LARGE. **Es MEDIUM secuencial a propósito**: un slice parcial puede dejar referencias colgando, el único riesgo del spec. Son cinco commits, uno por slice; lo que protege es que **cada slice deje el suite verde**.

## Current state
- Span contiguo en `bin/sdd`: `cmd_open_pr`, `build_pr_body_file`, `build_pr_title`, `append_decisions_capped`, `write_pr_opened_sentinel`, `extract_section`, `PR_BODY_MAX_CHARS`. Grafo cerrado: ningún helper huérfano, un solo `mktemp` adentro, sin `trap`.
- `.pr-opened` se lee en **un solo lugar** (rama `is_archived` de `detect_feature_phase`); `ready-to-pr` en uno más (arm de `next_command`). `is_archived` sale de la ubicación de la carpeta.
- Todo `node`/`src/` de `bin/sdd` vive dentro de `extract_section`.
- `cmd_domain_vocab` extrae `## Domain rules` de `conventions.md` y limpia comentarios con un loop awk de `index()`/`substr()`.

## Proposed design

| Movimiento | Cómo |
|---|---|
| Span y fase | borrar las siete definiciones más `.pr-opened` y `ready-to-pr`; `open-pr` fuera de `usage()` y del dispatch → "unknown command". Archivado es `archived`, con sidecar o sin él |
| Domain rules | `cmd_domain_vocab` lee `.claude/rules/domains.md` **entero**; awk, filtro y exit codes **verbatim** (contenido ⇒ 0, ausente/vacío ⇒ 3). Sin `extract_section`, `bin/sdd` vuelve a shell puro |
| Gate | archive imprime `git push -u origin HEAD` y `gh pr create --draft --base <base>` con `sdd base-branch <id>`; si falla, imprime sin resolver |

## Touched areas

| Module / path | Change |
|---|---|
| `bin/sdd` | span, fase, dispatch; reescribir el doc comment de `cmd_domain_vocab` y la descripción en `usage()` (F8, invisible al barrido) |
| `src/extract-section.js` · `tests/extract-section.test.js` | borrados enteros |
| `.claude/agents/sdd-archive-feature.md` | impresión **después** del fence del Step 3.5, sin fence propio (F6) |
| `.claude/skills/sdd-next/SKILL.md` · `sdd-auto/SKILL.md` | fuera Step 3a y su espejo; el pipeline termina en archive |
| `.claude/skills/init-project/SKILL.md` | lado de **escritura**: llena `domains.md` |
| `.claude/rules/domains.md` · `.specify/templates/rules/domains.md` | nuevos; las 8 líneas, `CLI surface` corregido |
| `.claude/rules/conventions.md` · `git.md` · `.specify/templates/rules/git.md` | fuera la sección y el gate |
| `.specify/templates/spec-template.md` | no apunta más a `conventions.md § Domain rules` |
| `CLAUDE.md` · `tests/sdd.test.js` | pipeline sin PR gate; ver Test strategy |

## Data flow
**Lectura**: consumidor → `sdd domain-vocab` → `domains.md` completo → awk → stdout + exit; los cuatro consumidores **no cambian**, el ADR 0003 absorbe el cambio. **Escritura**: `init-project` → `domains.md`.

## Migration / rollout
`N/A — sin migración (clarify B4)`: nadie usa la versión con `open-pr`, así que `cmd_update`/`cmd_init` no la llevan; sin ruta dual ni sección inerte. Repos con la sección real (`medical-chat`) pierden vocabulario hasta moverla a mano: `domain-vocab` sale 3 y caen a su scan, el fail-open de diseño. Rollback: `git revert`.

## Observability
`N/A — CLI local sin telemetría.` La señal es el barrido.

## Test strategy
- **Barrido (AC5), el que más pesa.** Camina `bin/`, `src/`, `.claude/**`, `.specify/templates/**`, `tests/**`; excluye `docs/`, `specs/`, `node_modules`, `.git`. Busca diez literales —los siete del span más `open-pr`, `.pr-opened`, `ready-to-pr`— y exige **cero** hits. Protege contra una **instrucción o llamada colgada**, no contra una **mención histórica**: los ADRs y specs archivados nombran lo eliminado porque es su trabajo (ADR 0004). No ensancharlo después.
- **Integration** contra el binario real: unknown-command (AC1); `domain-vocab` ⇒ 0 con contenido, ⇒ 3 ausente o solo-comentarios (AC2); archivado ⇒ `archived` (AC6). Manual: las dos líneas resueltas (AC4).
- **AC3**: `pathWithoutNode()` sube a top level (hoy vive dentro del bloque que muere) y su afirmación se **invierte**: de "falla ruidoso" a "la suite pasa".
- **Rotación**: fuera los 39 de `extract-section` y ~70 de `sdd.test.js`, incluido `describe("sdd domain-vocab")` entero (36): su eje de fences/CRLF/comentarios existía para extraer una sección. Reescribir los tres que los nombran en título o assertion (atribución de IA, sentinel de simplify-code, `git.md`): el `not.toContain(".pr-opened")` contra `.gitignore` queda **vacuo, no incidental**. Reparar `buildPrBodyViaRealPath` y el `extractSectionViaRealPath` local de 021 (F5).
- 191 tests / 2 suites → 1 suite, verde al cerrar.

## Risks and mitigations

| Riesgo | Mitigación |
|---|---|
| Borrar de menos, referencia colgando | el barrido |
| `usage()` describe el archivo viejo, invisible al barrido | F8 |
| El paso nuevo entra al span del Step 3.5 y `archiveStep35Line()` afirma en silencio sobre otra prosa | después del fence, sin fence propio; correr los dos tests |
| Ensanchar el barrido a `docs/`/`specs/` contradice al ADR 0004 | alcance fijado acá y en `decisions.md` |

## Open questions
Ninguna: los dos altos se cerraron acotando el barrido.
