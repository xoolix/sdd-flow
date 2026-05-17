# Quick Spec: claude-md-symlink

<!-- Fast-lane: migrate .claude/CLAUDE.md from copy-on-init to symlink-based
     distribution. Single-domain (bin/sdd + SDD_HOME distribution). No new deps. -->

## Summary

Migrar `.claude/CLAUDE.md` de archivo copiado-una-vez-al-init a **symlink** apuntando a `SDD_HOME/.claude/CLAUDE.md`. Los cambios en SDD_HOME propagan automáticamente a todos los proyectos del equipo vía `git pull`, sin merges manuales ni includes. El contenido genuinamente per-proyecto (sub-sección `## Model Overrides`, vacía hoy) se mueve a `.claude/rules/model-overrides.md` — archivo ya cargado automáticamente por Claude Code vía el patrón `.claude/rules/*.md`.

## Trigger

- **Automático**: mantainer pushea cambios a `SDD_HOME/.claude/CLAUDE.md` → miembros hacen `git pull` en SDD_HOME → symlinks resuelven a la versión nueva sin acción adicional.
- **One-time migración**: proyectos pre-migración (CLAUDE.md como copy) corren `sdd update` una vez para convertir copy → symlink.

## Happy Path

1. Mantainer edita `SDD_HOME/.claude/CLAUDE.md` y pushea.
2. Miembro hace `git pull` en su copia local de SDD_HOME.
3. En proyectos con CLAUDE.md symlinked → el symlink refleja el cambio instantáneo.
4. En proyectos pre-migración → `sdd update` detecta copy, backup a `.claude/CLAUDE.md.backup`, crea symlink, warn "mové overrides custom a `.claude/rules/model-overrides.md`".
5. Proyectos nuevos `sdd init` → symlink de entrada + scaffold `.claude/rules/model-overrides.md` vacío.

## Acceptance Criteria

- [ ] **Given** un proyecto pre-migración con `.claude/CLAUDE.md` como archivo copiado, **When** el usuario corre `sdd update`, **Then** el archivo se respalda a `.claude/CLAUDE.md.backup`, se reemplaza por un symlink a `SDD_HOME/.claude/CLAUDE.md`, y el comando imprime una advertencia pidiendo mover overrides custom a `.claude/rules/model-overrides.md`.
- [ ] **Given** un proyecto nuevo, **When** el usuario corre `sdd init`, **Then** `.claude/CLAUDE.md` se crea como symlink a `SDD_HOME/.claude/CLAUDE.md` (no como copy), y existe `.claude/rules/model-overrides.md` como scaffold vacío con el header `# Model Overrides`.

## Rollback Plan

- Por proyecto: `rm .claude/CLAUDE.md && mv .claude/CLAUDE.md.backup .claude/CLAUDE.md` restaura el file.
- A nivel SDD: `git revert` del PR restaura `bin/sdd` al comportamiento `cp`. Proyectos ya migrados quedan con symlink hasta rollback manual — funcional, no destructivo.

## Success Criterion

- **Cero ediciones manuales de `.claude/CLAUDE.md`** en proyectos del equipo durante los primeros 30 días post-merge (los cambios de SDD_HOME propagan vía symlink + `git pull`, sin touch manual).

---

## Plan

### Touched files

- `SDD_HOME/.claude/CLAUDE.md` — remover sub-sección `## Model Overrides`.
- `SDD_HOME/.claude/rules/model-overrides.md` — **nuevo**, scaffold con `# Model Overrides` header + comentario explicativo.
- `SDD_HOME/bin/sdd` — `cmd_init` (CLAUDE.md → symlink; install rules/model-overrides.md); `cmd_update` (migración copy → symlink con backup); `cmd_doctor` (warn si no es symlink); `usage` (actualizar help text).
- `SDD_HOME/README.md` — breve nota de migración en sección "Adopción progresiva".

### Approach

- CLAUDE.md default pasa de `cp` → `ln -sfn` en `cmd_init` (el flag `--copy` existente sigue forzando cp para standalone installs).
- `cmd_update` detecta si CLAUDE.md es file o symlink: si file, backup + symlink + warn; si symlink, `ln -sfn` refresh (no-op funcional); si falta, crear.
- `cmd_doctor` agrega un check: CLAUDE.md existe AND es symlink (o `--copy` install).
- Sub-sección `## Model Overrides` hoy vacía → movida a un archivo propio con el mismo header, Claude Code la carga vía `.claude/rules/*.md`.

### Test strategy

- **Manual**: crear proyecto throwaway, `sdd init`, verificar CLAUDE.md es symlink + `rules/model-overrides.md` existe. Luego simular proyecto pre-migración (copy manual), `sdd update`, verificar backup + symlink + warn.
- **Doctor**: `sdd doctor` en proyecto pre-migración debe flagear; post-migración debe pasar.
- **No hay tests automatizados** — shell script + markdown.

---

## Tasks

<!-- Change list. Each flipped to `- [x]` by /implement-task Step 4c.
     WARNING: the `## Tasks` header is IMMUTABLE — parsed by 4 downstream skills. -->

- [x] Crear `.claude/rules/model-overrides.md` con header `# Model Overrides` + comentario explicativo (1 archivo nuevo).
- [x] Remover sub-sección `## Model Overrides` de `.claude/CLAUDE.md` en SDD_HOME.
- [x] Edit `bin/sdd` `cmd_init`: CLAUDE.md default → `ln -sfn` (preservar `--copy` para override).
- [x] Edit `bin/sdd` `cmd_init`: instalar `rules/model-overrides.md` al set de rules copiados (skip si existe, igual patrón que otros).
- [x] Edit `bin/sdd` `cmd_update`: si `.claude/CLAUDE.md` es file regular → backup a `.backup` + crear symlink + imprimir warn sobre overrides.
- [x] Edit `bin/sdd` `cmd_update`: si `.claude/CLAUDE.md` ya es symlink → `ln -sfn` refresh (idempotente).
- [x] Edit `bin/sdd` `cmd_doctor`: agregar check "CLAUDE.md is symlink (or `--copy` install)" — warn si es file regular sin ser `--copy`.
- [x] Edit `bin/sdd` `usage`: documentar el nuevo comportamiento (CLAUDE.md symlinked por default, `--copy` para standalone).
- [x] Update `README.md` sección "Adopción progresiva": agregar bullet de migración para proyectos existentes (`sdd update` convierte copy → symlink).
- [x] Edit `bin/sdd` `cmd_update`: add missing-file branch — create symlink when `.claude/CLAUDE.md` is absent (closes SPEC-GAP-HIGH #1 + RFB #1).
- [x] Edit `bin/sdd` `cmd_init` + `cmd_update`: auto-add `.claude/CLAUDE.md` to project `.gitignore` if not already present (closes SPEC-GAP-HIGH #3 partial, prevents absolute-symlink leakage into git).
- [x] Edit `bin/sdd` `cmd_doctor`: warn if `.claude/CLAUDE.md` is git-tracked (closes SPEC-GAP #6 — git tracking undocumented).
- [x] Replace `is_copy_install()` heuristic with explicit sentinel file `.specify/.sdd-copy-install` — `sdd init --copy` creates it, `is_copy_install()` checks for it (heuristic kept as legacy fallback). Closes round-2 CRITICAL: `cp -R` on symlinked `~/.specify/templates` produces symlink in project, breaking heuristic on common setups.
- [x] Inside `is_copy_install` branch of `cmd_update`, add nested handler for absent AND broken-symlink CLAUDE.md — `cp` from SDD_HOME (not symlink, respects `--copy` semantics). Closes round-2 CRITICAL + round-3 medium #12: `elif` cascade unreachability for both absent and broken-symlink sub-cases.
