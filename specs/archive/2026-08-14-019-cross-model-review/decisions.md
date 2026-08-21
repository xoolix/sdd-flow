# Decisions

[2026-08-14T01:39:33Z] PROTOTYPE-REQUIRED: ¿Qué tool(s) expone `codex mcp-server`, qué shape tiene su respuesta, y devuelve el formato de findings pedido cuando se le da un prompt de review con diff + spec? — SUPERSEDED por la entrada 01:54Z (integración pivoteada al plugin oficial).

[2026-08-14T01:54:46Z] D-001 Integración vía plugin oficial `codex@openai-codex` en lugar de `codex mcp-server`: `sdd-cross-reviewer` llama por Bash a `codex-companion.mjs review --wait --base <ref>` (salida JSON con `review-output.schema.json`). Detección pre-flight: companion script presente + codex CLI disponible. Sin registro MCP. Decidido por el usuario tras instalar el plugin.

[2026-08-14T01:54:46Z] PROTOTYPE-REQUIRED: mini-run — una corrida en vivo de `codex-companion.mjs review --wait --base main` en este repo para verificar auth del CLI, tiempo de corrida, y que el JSON real matchea `review-output.schema.json`.

[2026-08-14T02:05:00Z] PROTOTYPE-RESULT: mini-run ejecutado (`review --wait --scope working-tree`, codex-cli 0.147.0, plugin 1.0.6). Verificado: (a) el companion corre por path absoluto SIN `CLAUDE_PLUGIN_ROOT`; (b) auth OK; (c) runtime ~2 min. Hallazgos que corrigen el spec: (1) el subcomando `review` nativo devuelve markdown, NO el JSON del schema — `review-output.schema.json` solo aplica a la rama `adversarial-review` → el cross-reviewer debe llamar `adversarial-review` (que además acepta focus text para pasar contexto del spec); (2) con working tree sucio (estado normal post-implement-task, los agentes no commitean) un `--base` explícito fuerza scope branch y saltea la implementación → usar `--scope working-tree` cuando el tree está sucio, `--base <ref>` solo con tree limpio; (3) dedupe del marker `implemented-by` debe ser solo-consecutivo (dedupe por valor rompe el caso alternado claude→codex→claude). Bonus: la review detectó assertions rotas en `tests/sdd.test.js:155-156` por el cambio de wording de sdd-new (fix aplicado, suite 10/10 verde).

[2026-08-14T02:05:00Z] D-002 Correcciones al spec derivadas del PROTOTYPE-RESULT: subcomando `adversarial-review` (no `review`), selección de scope según estado del tree, dedupe consecutivo del marker.

[2026-08-14T02:13:44Z] DISCOVERY-ACCEPTED (high): el comando del cross-reviewer requiere `--json` — sin él, `codex-companion.mjs outputResult()` imprime texto human-rendered y el parseo contra `review-output.schema.json` falla. Comando canónico corregido en spec.md: `node <companion> adversarial-review --wait --json <scope> [focus]`. Hallazgos medium (mapeo Category=cross-model, retry-vs-skip por texto de stderr, modelo del agente) pasan como contexto de diseño sin bloqueo.
[2026-08-14T02:25:49Z] implemented-by: claude

## Test-skip rationale

- **T004 (Update agent docs and model routing)**: docs-only prose edits to `_shared/agent-frontmatter.md` (agent-count references, internal-agents list) and `.claude/CLAUDE.md` (Model Routing table row). No testable runtime behavior — these are reference tables read by humans/agents, not parsed or asserted on by `tests/sdd.test.js` (which asserts against `.claude/agents/*.md` files directly, already covered by T002). Ran full `npm test` to confirm no regression.
- **T005 (Dogfood cross-review end-to-end)**: validation slice — exercises the already-implemented pipeline (Steps 2.5/1.5/3/6.6) end-to-end via real and simulated companion runs, producing the evidence entries below. No new production behavior was added, so no new unit test was written; `npm test` was re-run to confirm no regression.

## CROSS-REVIEW — 019-cross-model-review

### Cross-Findings
| # | Severity | Category | Evidence | Description | Suggested Action |
|---|----------|----------|----------|-------------|------------------|
| 1 | high | cross-model | .claude/agents/sdd-cross-reviewer.md:33-39 | Successful companion output is treated as unparseable: plugin v1.0.6 emits a top-level envelope containing metadata plus `result`, `rawOutput`, and `parseError`; the schema-shaped review is nested under `result`. Step 5 instead directs the agent to validate the whole JSON as `review-output.schema.json`. That object lacks top-level `verdict`/`findings` and has forbidden extra fields, so a valid review can degrade to `completed (unparseable)` instead of producing the Cross-Review verdict and findings required by AC1. | Parse the companion envelope, validate and map `response.result`, and use `response.parseError`/`response.rawOutput` only for the unparseable path. Add a fixture test using the real v1.0.6 envelope shape. |
| 2 | high | cross-model | .claude/agents/sdd-cross-reviewer.md:33-37 | A hung cross-review can block the entire review phase: the foreground companion command has no deadline. Failure classification and retry only occur after the process exits, while the inspected plugin waits on app-server requests and turn completion without a request timeout. A stalled network or Codex service therefore prevents the cross agent from returning, and the orchestrator cannot consolidate or emit its final verdict — contradicting the advisory, non-blocking failure contract. | Enforce a bounded execution deadline, terminate/cancel the companion on expiry, retry once, then synthesize `skipped — runtime timeout`. Also make review-feature treat an agent-level timeout or missing Cross-Verdict as an audited skip. |

Cross-Verdict: FAIL (advisory, model: codex)
Source: sdd-cross-reviewer (codex), review-feature phase
Date: 2026-08-14 (dogfood run T005, `--scope working-tree`, focus = spec ACs + touched files)

[2026-08-14T02:41:15Z] Cross-Review: skipped — codex CLI not on PATH (dogfood validation T005 Run B: PATH neutered to `/usr/bin:/bin` to simulate an unavailable codex CLI per AC2; the real plugin/CLI remain installed and unaffected)

[2026-08-14T02:43:54Z] D-003 Fix-now routing (user-approved): los 2 findings high del dogfood T005 (parser debe validar `.result` del envelope del companion, no el stdout top-level; agregar deadline ~10min a la llamada) se corrigen en un slice nuevo T006 antes de simplify/review, en vez de esperar el fix loop del review. Razon: el reviewer conformance podria no marcar FAIL y se archivaria un parser roto; los findings advisory no fuerzan fix.

Resolution: findings #1 (`.result` unwrap) and #2 (deadline) fixed by T006 on 2026-08-13. Step 5 of `sdd-cross-reviewer.md` now parses the top-level companion envelope and validates `.result` (not the envelope) against `review-output.schema.json`, with `parseError`/missing `.result` routed to the unparseable path. Step 4 adds a 600000ms (10 min) Bash timeout on the companion call; deadline expiry is classified as its own runtime-failure case in "Runtime failure classification" (1 retry, then `skipped — runtime error: timeout`). Remaining findings (Category=cross-model mapping nuance, retry-vs-skip stderr matching, agent model choice) were advisory context, not blocking, and remain tracked for `/review-feature`.

## JUDGMENT-DAY-HIGH — 019-cross-model-review

| # | Severity | Category | Evidence | Description | Suggested Action |
|---|----------|----------|----------|-------------|------------------|
| 1 | high | security-integrity | `.claude/agents/sdd-cross-reviewer.md:34-37`, mirrored in `plan.md:36` y spec Happy Path 4 | El focus text (ACs + touched files desde spec.md/plan.md) se interpola sin escapar dentro de un argumento shell entre comillas dobles; backticks y `$()` se evalúan dentro de comillas dobles → command substitution no intencional con el estilo de doc habitual del repo (specs llenos de backticks). Es el path default de todo judgment-day con plugin presente. | Nunca interpolar focus crudo en shell: temp file/stdin/env var o escape correcto (`printf %q`). Test de regresión con backticks/`$()`/quotes en el focus. |
| 2 | medium | undocumented-assumption | `.claude/agents/sdd-cross-reviewer.md:46` | La "validación de schema" es descripción en prosa hardcodeada, no lectura runtime del `review-output.schema.json` real de la misma versión resuelta del plugin — drift de versión no se detecta. | Leer el schema real del mismo directorio de versión que el companion resuelto, o registrar versión/checksum del schema de referencia. |
| 3 | medium | implementation-risk | `decisions.md` `## CROSS-REVIEW` (dogfood T005) | El dogfood probó el protocolo del cross-reviewer en aislamiento; nunca capturó una corrida genuina de 3 agentes con consolidación Step 4 mostrando `Cross-Review: FAIL` junto a un `Verdict` inafectado. El invariante está probado por inspección + string-assert, no end-to-end. (NOTA del orquestador: la corrida de review actual — 2026-08-14 — ES esa corrida genuina: 3 agentes en paralelo, cross FAIL advisory, Verdict consolidado solo de reviewer+judge.) | Capturar el envelope completo de una corrida real de 3 agentes. |

### Blocking Rationale
Finding #1: path creíble de command-injection/shell-breakage introducido por la invocación Bash nueva de esta feature, gatillado por el estilo normal de specs del repo, sin guía de escaping en spec/plan/agent — requiere decisión humana (fix ahora vs aceptar riesgo) antes de que sea el path default de judgment-day.

Source: sdd-judge, review-feature phase
Date: 2026-08-14

## CROSS-REVIEW — 019-cross-model-review

### Cross-Findings
| # | Severity | Category | Evidence | Description | Suggested Action |
|---|----------|----------|----------|-------------|------------------|
| 1 | high | cross-model | .claude/skills/review-feature/SKILL.md:91-96 | El disable/rollback del plugin es puenteado por la detección cache-path: la disponibilidad se infiere de un archivo cacheado + `codex` en PATH, sin consultar el registro de plugins activos. Plugin deshabilitado o cache huérfano post-uninstall igual pasa la detección y ejecuta el script cacheado — rompe el kill-switch de AC2; "highest version" puede ejecutar una versión inactiva. | Resolver `codex@openai-codex` vía el registro de plugins activos y su `installPath` exacto; disabled/unregistered → skip auditado. Test con cache presente + plugin deshabilitado. |
| 2 | high | cross-model | .claude/agents/sdd-cross-reviewer.md:31-39 | Focus text derivado del spec interpolado en comando shell — command substitution evaluada aun entre comillas dobles; un spec técnico ordinario (o crafteado) puede ejecutar comandos antes de que arranque Node. [CONVERGE con JUDGMENT-DAY-HIGH #1 — hallado independientemente por ambos modelos.] | Wrapper argv-safe o mecanismo `--focus-file`; tests con backticks, `$()`, quotes, newlines, operadores. |
| 3 | high | cross-model | .claude/skills/review-feature/SKILL.md:105-118 | Fallas de lanzamiento del cross-agent pueden bloquear la fase: el fail-open vive solo dentro del agente, alrededor del proceso companion. Agent type no registrado, crash del subagent, o respuesta sin `Cross-Verdict` no tienen path de skip auditado — Step 6.6 asume output usable; puede impedir consolidación o gatillar retries de fase. | Catch separado para fallas de launch/validación del cross-agent: ante error, deadline o `Cross-Verdict` ausente → skip auditado y continuar con el veredicto de los 2 agentes autoritativos. Tests de resultados rechazados/malformados. |

Cross-Verdict: FAIL (advisory, model: codex)
Source: sdd-cross-reviewer (codex), review-feature phase
Date: 2026-08-14 (primera corrida real de 3 agentes; companion limpio: parseError null, .result schema-valid, --scope working-tree; codex summary: "Do not ship: the integration can execute a disabled plugin, exposes a shell-injection path, and still allows advisory-agent failures to block review consolidation.")

[2026-08-14T03:05:49Z] JUDGMENT-DAY-HIGH decision (user: "fixealo"): FIX. Se agrega T007 cubriendo los 3 highs (shell injection del focus text — convergencia judge+codex; kill-switch bypass por detección cache-path; fail-open a nivel orquestación para fallas del cross-agent) + el medium del schema (leer review-output.schema.json real de la versión resuelta en vez de prosa hardcodeada). El medium #3 del judge (evidencia e2e de 3 agentes) queda RESUELTO por la propia corrida de review del 2026-08-14: 3 agentes en paralelo, cross FAIL advisory, Verdict consolidado solo de reviewer+judge — exactamente el escenario que pedía capturar. Ciclo: implement T007 → re-review.

[2026-08-14T03:10:04Z] T007 resolution: fixed all 3 JUDGMENT-DAY-HIGH findings + the medium schema-drift finding.
1. **Shell injection**: `sdd-cross-reviewer.md` steps 3-4 now write the focus text to `specs/<feature-id>/.cross-focus.txt` (Write tool, not a Bash heredoc) and invoke the companion with `"$(cat specs/<feature-id>/.cross-focus.txt)"` — command substitution only ever yields a single literal-argument value from the file's bytes, never re-parsed by the shell, so backticks/`$()`/quotes in spec prose can't execute. The scratch file is deleted unconditionally before the agent returns (Rules section).
2. **Kill-switch**: real-world inspection of `~/.claude/plugins/installed_plugins.json` (this machine) showed it holds registry install records (`scope`, `installPath`, `version`, `installedAt`, `lastUpdated`, `gitCommitSha`) keyed `codex@openai-codex` — **no enabled/disabled field**. The actual enable state lives in `~/.claude/settings.json` under `.enabledPlugins["codex@openai-codex"]` (boolean). This corrects the task's original assumption that `installed_plugins.json` alone carries an "enabled entry." Both `review-feature/SKILL.md` Step 2.5 and `sdd-cross-reviewer.md` step 1 now check both files: non-empty registry array in `installed_plugins.json` AND `enabledPlugins["codex@openai-codex"] === true` in `settings.json`. The registry's `installPath` is preferred for the companion script location; the cache glob is now only a path-resolution fallback, never the availability signal.
3. **Orchestration fail-open**: `review-feature/SKILL.md` Step 3 adds explicit handling for Agent-tool launch failure, crash, timeout, or a response with no `### Cross-Verdict:` line — all recorded as `Cross-Review: skipped — cross-agent failure: <detail>`, audited in Step 6.6, and never consuming the phase's 2-retry validation budget (`sdd-phase-common.md` §F). Consolidation proceeds with reviewer+judge only, unchanged from the `CROSS_REVIEW_AVAILABLE = false` path.
4. **Schema drift**: `sdd-cross-reviewer.md` step 5 now instructs reading the real `review-output.schema.json` from the same resolved version directory as the companion script (registry `installPath` or cache-glob fallback from step 1) and validating `.result` against that file; the prose field list remains only as a quick-reference summary, explicitly subordinate to the file.
Tests: `tests/sdd.test.js` gained one assertion block (RED confirmed before the fix, GREEN after) checking `.cross-focus.txt`, `$(cat `, `installed_plugins.json`, `enabledPlugins` (both files), `cross-agent failure`, and `review-output.schema.json` + `resolved version directory` in `sdd-cross-reviewer.md`. Full suite: 13/13 passing.

## JUDGMENT-DAY — 019-cross-model-review (re-review ciclo 1, post-T007)

Prior highs (shell injection, kill-switch, fail-open) y el medium de schema: **verificados como genuinamente resueltos** por el judge (trazado semántico POSIX del `"$(cat ...)"`, cross-check del §F). Findings nuevos:

| # | Severity | Category | Evidence | Description | Suggested Action |
|---|----------|----------|----------|-------------|------------------|
| 1 | medium | undocumented-assumption | `.claude/agents/sdd-cross-reviewer.md:36-44,136`; `.gitignore` | Cleanup de `specs/<id>/.cross-focus.txt` depende solo de instruction-following; sin entry en `.gitignore` (precedente: `.parent-branch`). Crash entre Write y delete deja el archivo y un `git add -A` lo levanta. | Agregar `specs/**/.cross-focus.txt` a `.gitignore`. |
| 2 | low | edge-case | `sdd-cross-reviewer.md:25-27` | No distingue "settings.json ilegible" de "enabledPlugins ausente". | Explicitar: ilegible ≡ ausente. |
| 3 | low | edge-case | `sdd-cross-reviewer.md:55` | Sin fallback explícito si el schema file no existe en los paths candidatos. | Explicitar fallback a la prosa + nota en el annex. |

Source: sdd-judge, review-feature phase (verdict: PASS WITH WARNINGS)
Date: 2026-08-14

## CROSS-REVIEW — 019-cross-model-review (re-review ciclo 1, post-T007)

### Cross-Findings
| # | Severity | Category | Evidence | Description | Suggested Action |
|---|----------|----------|----------|-------------|------------------|
| 1 | high | cross-model | .claude/agents/sdd-cross-reviewer.md:50-55 | Path del schema equivocado en el Step 5 post-T007: los candidatos instruidos (`<version>/scripts/` y `<version>/`) no existen; el real es `<version>/schemas/review-output.schema.json` (verificado en vivo contra la instalación 1.0.6 — el propio cross-agent tuvo que fallback a la ubicación real para completar esta review). El happy path con plugin activo degradaría a unparseable/skip — rompe AC1. | Resolver `schemas/review-output.schema.json` desde el dir exacto del companion seleccionado; fail-open con razón explícita si falta; fixture test con el layout real. |
| 2 | high | cross-model | .claude/skills/review-feature/SKILL.md:113-121 | El fail-open no cubre un cross-agent que nunca retorna: se lanza en el mismo batch awaited que reviewer/judge y no hay deadline/cancel del lado orquestador — el handler no puede ejecutarse mientras el Agent call sigue pendiente; un cuelgue stallea la consolidación pese al contrato advisory. | Await independiente con deadline orquestador-side; al expirar, cancelar/detach, skip auditado, consolidar con los 2 autoritativos. |
| 3 | medium | cross-model | .claude/skills/review-feature/SKILL.md:91-98 | Fallback de cache puede ejecutar una versión no representada por el install activo cuando falta `installPath` en el registro (uninstall/update parcial → companion huérfano + skew de versión/schema). | installPath ausente → skip auditado, o fallback restringido a la versión exacta del registro. |

Cross-Verdict: FAIL (advisory, model: codex)
Source: sdd-cross-reviewer (codex), review-feature phase
Date: 2026-08-14 (re-review ciclo 1; nota: el fix de shell-injection de T007 AGUANTÓ el testing adversarial de codex — los findings de este ciclo son regresiones/gaps nuevos de T007, no reintroducción)

[2026-08-14T10:38:32Z] Post-re-review decision (user: "dale"): T008 quirúrgico antes de archivar — (a) fix path del schema → `schemas/review-output.schema.json` (cross high #1, verificado); (b) `specs/**/.cross-focus.txt` al `.gitignore` (judge medium); (c) judge lows #2/#3 (settings.json ilegible ≡ enabledPlugins ausente; fallback explícito a prosa si el schema file falta); (d) cross medium #3: `installPath` ausente en el registro → skip auditado (sin fallback a cache huérfano). El cross high #2 (deadline orquestador-side para Agent call colgado) queda como KNOWN-LIMITATION: es estructural del Agent tool (no hay primitiva de cancel desde el orquestador inline); se registra para un follow-up feature. Después de T008: verificación puntual + suite, y /archive-feature directo (sin tercer ciclo de review — rendimientos decrecientes demostrados).

KNOWN-LIMITATION (follow-up candidate): un sdd-cross-reviewer colgado más allá de su deadline interno (600s) stallea el batch paralelo del Step 3 de review-feature — el fail-open documentado no puede ejecutarse mientras el Agent call sigue pendiente. Mitigación actual: deadline interno del agente sobre la llamada companion (600000ms). Fix real requiere await independiente/cancelación a nivel orquestador.

[2026-08-14T11:05:00Z] T008 resolution: fixed all 4 in-scope findings from re-review cycle 1.
1. **Schema path** (cross high #1): `sdd-cross-reviewer.md` step 5 now reads `<resolved version directory>/schemas/review-output.schema.json` (verified live against the installed v1.0.6 plugin — `schemas/` is a sibling of `scripts/`, not nested under it or next to `codex-companion.mjs`). Added an explicit fallback: if the schema file is absent at that path, validate `.result` against the prose field summary instead and note the fallback in the returned `### Cross-Findings` block so it lands in the `decisions.md` annex (covers judge low #3).
2. **Gitignore** (judge medium): added `specs/**/.cross-focus.txt` to `.gitignore`, mirroring the existing `specs/**/.parent-branch` entry.
3. **Settings readability** (judge low #2): `sdd-cross-reviewer.md` step 1 and its "Plugin not active" failure classification now state explicitly that an unreadable or absent `~/.claude/settings.json` is treated identically to `enabledPlugins` being missing — both fail the kill-switch check, neither defaults to enabled.
4. **Fallback binding** (cross medium #3): both `sdd-cross-reviewer.md` step 1 and `review-feature/SKILL.md` Step 2.5 point 4 now require the registry's own `installPath` to resolve to an existing directory/companion script; a missing or invalid `installPath` is an audited skip (`skipped — codex plugin registry entry has no valid installPath`) with no fallback to the highest-version cache directory. The cache-glob fallback language was removed entirely from both files — an unregistered cache version can never be executed.

Cross high #2 (orchestrator-side deadline for a hung Agent call) remains out of scope per the 10:38Z decision — already recorded above as KNOWN-LIMITATION.

Tests: `tests/sdd.test.js` gained one assertion block (RED confirmed before the fix — only the `schemas/review-output.schema.json` assertion had been checked before the block failed; GREEN after) checking `schemas/review-output.schema.json`, `prose field summary`, `specs/**/.cross-focus.txt` in `.gitignore`, `unreadable or absent`, and `no valid installPath` in both `sdd-cross-reviewer.md` and `review-feature/SKILL.md`. Full suite: 14/14 passing.

## Simplify: 2026-08-13 — /simplify-code
- **Files simplified**: none (empty diff)
- **Scope narrowing**: committed diff `main..HEAD` is empty (this repo's `git.md` convention forbids `/implement-task` from committing), so scope fell back to the feature's uncommitted file list. Applying the mandatory exclusion filters removed `.claude/skills/review-feature/SKILL.md` and `.claude/skills/_shared/agent-frontmatter.md` (match `.claude/skills/**/*.md`), `.claude/CLAUDE.md` (explicit SDD-artifact exclusion), and `tests/sdd.test.js` (test-file exclusion). Only `.claude/agents/sdd-cross-reviewer.md` and `.claude/agents/sdd-implement-task.md` remained in scope.
- **Changes**: reviewed both in-scope files against KISS/DRY/YAGNI. `sdd-cross-reviewer.md` was just corrected under T006 and every line maps to a specific protocol step or failure case — no dead code, no speculative abstraction. `sdd-implement-task.md` has one apparent duplication ("test public interfaces, not private helpers" appears in both the TDD quality-bar list and the step 4b test-first gate) but it is intentional reinforcement of a hard rule at its point of use, not accidental duplication — collapsing it would water down normative language. No safe edit found; empty diff.
- **Baseline**: pass (12/12) | **Post-edit**: pass (12/12, no edits made)

## Deltas merged
[2026-08-14T16:45:00Z] Merged implementation deltas into spec.md (archive phase):
- **Happy Path step 2** (MODIFIED): plugin detection now verifies `installed_plugins.json` registry entry + `settings.json` `enabledPlugins` (boolean kill-switch), resolves companion from registry `installPath`; cache glob is fallback only if registry inaccessible, never availability signal.
- **Happy Path step 4** (MODIFIED): focus text written to scratch file `specs/<feature-id>/.cross-focus.txt`, passed via `"$(cat ...)"` to prevent shell injection from spec prose (backticks, `$()`); cleanup unconditional; schema validated from real `<companion-dir>/schemas/review-output.schema.json`; envelope parsing instructions (`.result` unwrap) and timeout deadline (~10 min) added.
- **Edge Cases** (ADDED): documented timeout handling, cross-agent failure handling (fail-open without retries), and KNOWN-LIMITATION about orchestrator-side deadline for hung Agent calls.
- **Rollback Plan** (MODIFIED): added `settings.json` `enabledPlugins` toggle as reversible kill-switch alternative to plugin uninstall.
