# Clarify — 021-project-aware-templates

## Step 0 — code-resolved (scan de esta sesión)

- `code-resolved: .specify/templates/spec-template.md` — `## Domains` es una checklist fija de 8 ítems (Database/API/Frontend/Infrastructure/Auth/Notifications/External integrations/Other).
- `code-resolved: .specify/templates/plan-template.md` — `## Touched areas` tiene campos fijos `APIs/contracts:`, `DB/schema:`, `Jobs/workers:`, `UI surfaces:`. Además `## Observability` (Logs/Metrics/Alerts) asume servicio corriendo y `## Migration / rollout` asume Backfill/Feature flags.
- `code-resolved: .specify/templates/research-template.md` — `## Evaluation criteria` fija: Complexity, Cost, Performance, Reliability, Security, Team fit, Vendor lock-in (taxonomía de selección de vendor).
- `code-resolved: .specify/templates/tasks-template.md` y `fix-spec-template.md` — su `touches:` ya es free-form (`<modules/files/domains>`). No necesitan cambio. **tasks-template.md además lo modificó el feature 020 (campo `type:`) — evitarlo reduce conflicto de merge entre ramas.**
- `code-resolved: NADIE parsea `## Domains`` — grep en `.claude/`, `bin/sdd` y `tests/` devuelve una sola referencia: `new-feature/SKILL.md:172`, que es la instrucción de mapeo. Tampoco se parsean `## Touched areas` ni `## Evaluation criteria`. Rediseñarlas NO es breaking.
- `code-resolved: secciones que SÍ son contrato` — `## Tasks` (parseada por implement-task, simplify-code, review-feature, archive-feature y `bin/sdd:1118`) y `Summary` / `Acceptance Criteria` / `Rollback Plan` (extraídas por `extract_section` en `bin/sdd:905` para armar el body del PR). Renombrarlas rompe el gate de PR de 020. Intocables.
- `code-resolved: .claude/skills/init-project/SKILL.md` sección 3 — hoy dice literalmente "**Domain rules**: Leave as TODO for the user to fill". Es la línea exacta a cambiar.
- `code-resolved: .claude/rules/conventions.md` en este repo — vacío, solo headers (`## Stack`, `## Naming`, `## Folder structure`, `## Lint / Format`, `## Domain rules`). `/init-project` nunca se corrió acá.
- `code-resolved: bin/sdd` — `cmd_init` copia `.claude/rules/*.md` desde SDD_HOME pero saltea los existentes; `cmd_update` no toca `rules/` en absoluto.

## Block 1 — Comportamiento

### Q: ¿Qué alcance tiene el feature: solo `## Domains`, o toda la taxonomía fija?
Recommended answer: Las 3 zonas — `## Domains` (spec), `## Touched areas` + `## Observability` + `## Migration/rollout` (plan), `## Evaluation criteria` (research). Ninguna está parseada, así que el riesgo es el mismo que tocar una sola; arreglar solo Domains deja el plan pidiendo "UI surfaces" en un CLI.
> Las 3 zonas de taxonomía (Recomendado)

### Q: ¿De dónde saca el artefacto los dominios reales del proyecto?
Recommended answer: Free-form como primario (el agente los deriva de su Step 0 scan) + `conventions.md` § Domain rules como enriquecimiento opcional si tiene contenido. Funciona siempre y degrada con gracia; `/init-project` pasa a llenar esa sección en vez de dejarla como TODO.
> Free-form + conventions.md si existe (Recomendado)

## Block 2 — Scope técnico

### Q: ¿Dónde vive la instrucción de derivar dominios: en el comentario del template o en los agentes?
Recommended answer: En el comentario HTML del template. Un solo lugar por sección, viaja solo por el symlink, y es literalmente lo que el agente ya lee al copiar el template.
> En el comentario del template (Recomendado)

### Inferencias surfaced (no corregidas por el usuario)
- `## Domains` conserva su nombre. No lo parsea nadie, pero `new-feature/SKILL.md:172` mapea contra él y renombrarlo cuesta una edición coordinada a cambio de nada.
- **Este feature no tiene problema de migración**, a diferencia del hueco que 020 dejó con `git.md`: los templates son symlink (se actualizan solos en todos los proyectos) y `conventions.md` es enriquecimiento opcional, así que un proyecto que nunca corrió `/init-project` funciona igual.
- Archivos extra que entran al scope, encontrados verificando el riesgo de las secciones condicionales: `plan-feature/SKILL.md:94` (su lista "Fills in:" enumera "Observability plan" y "Migration / rollout strategy" como obligatorias) y `sdd-reviewer.md:43` (su check de completitud busca "observability" faltante).
- Ni `sdd-reviewer` ni `sdd-judge` exigen que existan secciones del template — verificado por grep. Las secciones condicionales no rompen el review.

## Block 3 — Contrato / datos

### Q: ¿Qué pasa con `## Observability` y `## Migration / rollout` cuando el proyecto no tiene nada de eso?
Recommended answer: Secciones condicionales — el comentario del template dice incluirlas solo si el proyecto tiene esa superficie. Ahorra palabras contra el budget de 800 del plan y el artefacto refleja el proyecto.
> Secciones condicionales, se omiten (Recomendado)

## Block 4 — Riesgos técnicos

### Q: Si el agente omite una sección que SÍ correspondía, el silencio la tapa. ¿Cómo lo evitás?
Recommended answer: Una línea explícita de descarte (`## Observability — N/A: <razón>`) en vez de borrar la sección. Cuesta ~10 palabras en vez de 60, la decisión queda visible, y el reviewer puede discutirla. Un descarte silencioso es indistinguible de un olvido.
> Una línea explícita de descarte (Recomendado)

## Block 5 — Acceptance + rollback

### Q: ¿Cómo verificás que los templates nuevos producen mejores artefactos?
Recommended answer: Content-assertions sobre los templates + una task final que regenera el `plan.md` de 021 con el template nuevo y compara. Evidencia concreta dentro del propio feature, sin esperar al siguiente. Nota de orden: el spec y el plan de 021 se escriben con los templates VIEJOS porque la implementación viene después, así que el feature no puede verificarse a sí mismo sin regenerar.
> Tests + regenerar un artefacto de muestra (Recomendado)

### Rollback (code-resolved)
Revertir el commit. Los templates son symlink a SDD_HOME → todos los proyectos vuelven al instante, sin `sdd update`.

### ADR — considerado y no ofrecido
El principio "los artefactos derivan su estructura del proyecto en vez de prescribirla" gobierna decisiones futuras, pero comparado con el ADR 0002 (que revirtió una política de seguridad y creó un boundary de enforcement) esto es hacer un template menos prescriptivo. Se le ofreció al usuario dejarlo asentado; no lo pidió.

## Quality gate — validado por el usuario
Los 3 bloques (6 acceptance criteria en G/W/T, rollback vía symlink, success metric doble) fueron presentados y el usuario respondió "ok" sin correcciones.
