# Quick-spec: Onboarding 1-pager

## Intent

Crear `docs/onboarding.md`, un 1-pager que un dev nuevo lee al incorporarse al equipo SDD. Responde "tengo una idea de feature, ¿qué hago?" con la trayectoria mínima de comandos. Reemplaza la necesidad de leer CLAUDE.md (300 líneas, optimizado para Claude) en su primer día.

**Audiencia**: dev humano que se incorpora a un equipo de 10 que ya usa SDD.

## Acceptance Criteria

- [ ] **AC-1**: **Given** un dev nuevo abre `docs/onboarding.md` por primera vez, **When** lee top-to-bottom, **Then** encuentra (a) el decision rule fast-lane vs full-spec arriba, (b) la trayectoria de comandos en orden cronológico para AMBOS lanes, (c) un escape hatch ("si te trabás → /research-spike o leé los archivados"), y (d) link a CLAUDE.md para detalle.
- [ ] **AC-2**: **Given** el doc renderizado, **When** se mide longitud, **Then** cabe en ≤500 palabras (1 página real).

## Plan

**Files**: 1 archivo nuevo: `docs/onboarding.md`.

**Approach**:
1. Title + 1-sentence goal.
2. **"¿Cuándo uso qué?"** — decision rule literal del CLAUDE.md (`single-domain, no deps, ≤2 GWT → fast-lane`). Tabla simple o tree.
3. **"Fast-lane flow"** — comandos en orden: `/new-quick-feature` (o `/new-fix` para bugs) → `/implement-task` → `/simplify-code` → `/review-feature` → `/archive-feature`. Manual invocation (no `/sdd-next` en fast-lane).
4. **"Full-spec flow"** — `/new-feature` → `/plan-feature` → loop `/implement-task` → `/simplify-code` → `/review-feature` → `/archive-feature`. Mencionar `/sdd-next` o `/sdd-auto` como shortcut opcional.
5. **"Si te trabás"** — escape hatches: `/research-spike` para uncertainty técnica/producto, leer `docs/adr/` para decisiones arquitecturales, ver `specs/archive/` para ejemplos previos, ask al equipo.
6. **"Más detalle"** — link a `.claude/CLAUDE.md`, `README.md`, `docs/adr/`.

**Change list (atomic tasks)**:
- [x] Crear `docs/onboarding.md` con las 6 secciones de Approach.
- [x] Verificar ≤500 palabras: `wc -w docs/onboarding.md`.
- [x] Verificar que cada comando referenciado existe como `.claude/skills/<name>/SKILL.md` o agent.

## Rollback

Pure additive. `git revert <commit>` o `rm docs/onboarding.md` restaura estado pre-feature. No flags, no behavioral changes a otras skills.

## Success

En las 4 semanas post-merge, ≥1 dev nuevo onboarded reporta (informalmente, conversación o async) que `docs/onboarding.md` fue suficiente para arrancar sin requerir leer CLAUDE.md o pedir ayuda. Métrica binaria, baja-rigor (este es onboarding doc, no infrastructure crítica).
