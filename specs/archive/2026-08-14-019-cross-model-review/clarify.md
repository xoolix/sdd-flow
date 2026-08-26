# Clarify — 019-cross-model-review

## Block 1 — Comportamiento

### Q: ¿Cómo integra el veredicto del cross-reviewer en la consolidación final?
Recommended answer: advisory puro en v1 — findings registrados en `decisions.md` como `CROSS-REVIEW` (análogo a `JUDGMENT-DAY`) y warnings en el envelope; sin poder de FAIL/bloqueo. Promoción a bloqueante en feature futura con historial de falsos positivos.
> dale

### Q: ¿Cuándo corre el cross-reviewer y qué pasa cuando no puede correr?
Recommended answer: corre solo en modo `judgment-day` (tercer agente del fan-out paralelo); `--minimal` lo excluye igual que al judge. Si la tool MCP del modelo opuesto no está disponible, el orquestador lo detecta antes de lanzar, sigue con reviewer + judge, anota `cross-review: skipped — <razón>` en el envelope y lo registra en `decisions.md`. Nunca rompe el pipeline.
> ok

## Block 2 — Scope técnico

### Q: ¿El cross-reviewer es un agent nativo nuevo (`.claude/agents/sdd-cross-reviewer.md`) o lógica inline en `review-feature/SKILL.md`?
Recommended answer: agent nativo nuevo `sdd-cross-reviewer.md` (patrón sdd-reviewer/sdd-judge) con `mcpServers: [codex]` en frontmatter; body arma el prompt de review, delega a la tool `codex` y traduce la respuesta al formato de findings. Entra como tercer agente del fan-out del Step 3 y se suma a los "internal native agents".
> ok

### Q: ¿Cómo se registra y se resuelve el `implemented-by` para elegir el modelo opuesto?
Recommended answer: `sdd-implement-task` escribe `[timestamp] implemented-by: claude` en `decisions.md` (dedupe por valor); `review-feature` lo lee en Step 1.5 y elige el opuesto. Fallback sin marker: asumir el runtime actual (Claude Code → cross con codex) y anotar la asunción. Caso mixto: el opuesto al último valor registrado.
> ok

### Q: ¿Dónde se registra el MCP server `codex` y cómo detecta el orquestador la disponibilidad?
Recommended answer: registro a nivel usuario (`claude mcp add --scope user codex -- codex mcp-server`), NO `.mcp.json` commiteado (evita prompt de aprobación y dependencia forzada del CLI para todos). Detección en pre-flight de review-feature: Bash `claude mcp get codex`, exit 0 = disponible; si no, skip auditado. Candidato futuro para `sdd doctor`.
> ok

## Block 3 — Contrato / datos

### Q: ¿Qué contrato de salida tiene el cross-reviewer y qué campos nuevos aparecen en el envelope de review-feature?
Recommended answer: todo aditivo — cross-reviewer devuelve el mismo formato de findings que el judge (tabla severidad + file:line) y veredicto PASS/PASS WITH WARNINGS/FAIL; su FAIL se degrada a warnings (advisory). decisions.md gana `## CROSS-REVIEW — <feature-id>` (patrón JUDGMENT-DAY). Envelope gana `**Cross-Review**: <verdict> (advisory, model: codex) | skipped — <razón>`. Tabla de consolidación del Step 4 sin cambios.
> ok

### Q: ¿Esta feature cubre solo la dirección Claude→Codex, o también la inversa?
Recommended answer: solo Claude→Codex en 019. El diseño queda simétrico (marker bidireccional), pero el lado Codex se implementa dentro del port full-parity, no acá.
> solo claude-codex

## Block 4 — Riesgos técnicos

### Q: ¿Qué hace el cross-reviewer cuando la llamada a codex falla en runtime o devuelve salida no parseable?
Recommended answer: falla runtime → 1 retry, luego `Cross-Review: skipped — runtime error: <detalle>` y sigue normal. Salida no parseable → `Cross-Review: completed (unparseable, advisory)` + salida cruda truncada (~100 líneas) en `## CROSS-REVIEW` de decisions.md marcada `formato libre`. Nada del cross-reviewer cambia el veredicto final ni consume los retries de fase del orquestador.
> ok

## Block 5 — Acceptance + rollback

### Q: ¿Cómo verificás que anda y cómo se apaga si molesta?
Recommended answer: dogfood — (1) con codex registrado, /review-feature sobre feature implementada con Claude → envelope con Cross-Review + sección ## CROSS-REVIEW en decisions.md; (2) sin codex registrado → skipped auditado, veredicto final idéntico. Kill-switch: `claude mcp remove codex` (skip natural, sin tocar código); remoción total por git revert. Sin flag adicional.
> ok

## Prototype checkpoint

### Q: PROTOTYPE-REQUIRED antes de /plan-feature — ¿qué expone y devuelve realmente `codex mcp-server`?
Recommended answer: marcar prerequisito — el contrato de la tool codex nunca fue verificado y todo el diseño depende de él.
> dale

## Revisión post-spec — plugin oficial de Codex instalado

Contexto: el usuario instaló `codex@openai-codex` (marketplace `openai/codex-plugin-cc`). Scan de `~/.claude/plugins/cache/openai-codex/codex/1.0.6/`: `scripts/codex-companion.mjs` con subcomando `review [--wait|--background] [--base <ref>] [--scope auto|working-tree|branch]` y salida JSON validada por `schemas/review-output.schema.json` (`verdict: approve|needs-attention`; `findings[]`: severity critical/high/medium/low, file, line_start/line_end, confidence, recommendation). El agente `codex-rescue` del plugin solo forwardea `task` (review prohibido) — no reemplaza a `sdd-cross-reviewer`.

### Q: ¿Cambiamos la integración al plugin oficial en vez del MCP server?
Recommended answer: sí — `sdd-cross-reviewer` sigue siendo agent nativo pero su body llama por Bash a `codex-companion.mjs review --wait --base <ref>`; detección pre-flight = companion script existe (glob sobre `~/.claude/plugins/cache/openai-codex/codex/*/`) + codex CLI disponible. Sin registro MCP, sin `mcpServers` en frontmatter.
> Plugin runtime (Recommended) [via AskUserQuestion]

### Q: ¿Qué hacemos con el PROTOTYPE-REQUIRED ahora que el contrato está en el schema del plugin?
Recommended answer: reducirlo a un mini-run — una corrida en vivo de `codex-companion.mjs review --wait --base main` para verificar auth del CLI, tiempos, y que el JSON real matchea el schema.
> Reducir a mini-run (Recommended) [via AskUserQuestion]
