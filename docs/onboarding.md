# Onboarding SDD

Tenés una idea de feature o un bug. Esta guía te dice exactamente qué comandos correr, en orden.

> **Prerrequisitos**: SDD ya inicializado en el repo. Si no, corré `/init-project` primero (ver `README.md`). Y necesitás Claude Code CLI instalado.
>
> **Sobre `<feature-id>`**: cada feature tiene un id formato `NNN-slug` (ej. `016-onboarding-1-pager`). `/sdd-new` lo genera; los demás comandos lo reciben como argumento.

---

## Regla de lane

| Criterio | Lane |
|----------|------|
| Bug chico con Current/Expected/Unchanged claro | **Fix fast-lane** |
| Un solo dominio, sin dependencias entre módulos, ≤2 criterios de aceptación (GWT) | **Fast-lane** |
| Cualquier otra cosa (multi-dominio, deps cruzadas, > 2 AC, o alta incertidumbre) | **Full-spec** |

No elijas manualmente salvo que quieras forzar una lane: `/sdd-new` decide por vos.

---

## Camino feliz

No memorices lanes ni fases:

```
/sdd-new <descripción>
/sdd-next <feature-id>
```

Repetí `/sdd-next` hasta que archive. Usá los comandos manuales solo si querés controlar fase por fase.

---

## Entry único

Para features, cambios chicos o bugs:

```
/sdd-new <descripción>
```

`/sdd-new` decide la lane:

| Caso | Lane | Artefacto |
|------|------|-----------|
| Bug chico con Current/Expected/Unchanged | fix | `quick-spec.md` |
| Cambio chico single-domain, sin deps, ≤2 GWT | quick | `quick-spec.md` |
| Todo lo demás | full-spec | `clarify.md` + `spec.md` |

Si no estás seguro, no decidas vos: usá `/sdd-new`.

---

## Avance

```
/sdd-next <feature-id>
```

Repetí `/sdd-next` hasta archive. También podés usar:

- `/sdd-auto <feature-id>` — encadena todas las fases restantes automáticamente.
- Comandos manuales (`/plan-feature`, `/implement-task`, etc.) si querés controlar fase por fase.

---

## Herramientas útiles

- `/grill-me` — antes de escribir spec, stress-testea un plan con preguntas de a una.
- `/tdd` — para trabajar red-green-refactor sobre una tarea puntual.
- `/prototype` — para validar UI, state machine o modelo antes de hacerlo producción.

---

## Si te trabás

| Situación | Escape hatch |
|-----------|-------------|
| Incertidumbre técnica o de producto antes de planificar | `/research-spike <tema>` |
| Duda sobre decisiones arquitecturales del proyecto | Leer `docs/adr/` |
| Necesitás ver cómo se resolvió algo similar antes | Ver `specs/archive/` |
| Nada de lo anterior funciona | Pedile al equipo |

---

## Más detalle

- `.claude/CLAUDE.md` — flujo completo, model routing, phase detection, reglas del orquestador.
- `README.md` — instalación del CLI y setup inicial.
- `docs/adr/` — decisiones arquitecturales del proyecto.
