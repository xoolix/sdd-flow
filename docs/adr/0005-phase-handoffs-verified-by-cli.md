# ADR 0005 — Los handoffs de fase se verifican con chequeos deterministas de la CLI, no con prosa del agente

- **Estado**: aceptada
- **Fecha**: 2026-09-02
- **Feature que la implementa**: 026

## Contexto

La feature 025 agregó una compuerta ANTES de archivar: `.sdd-state`, un recibo con `phase: reviewed`
y el veredicto de paso, que `archive-feature` exige antes de mover una carpeta de `specs/<id>/` a
`specs/archive/`. Esa compuerta cierra un hueco real — un archive no puede arrancar sin que el
review haya pasado — pero solo mira hacia atrás, antes del movimiento. Nada del pipeline volvía a
mirar el commit del archive DESPUÉS de que el agente terminara, para confirmar que el movimiento
completo (la baja bajo `specs/<id>/`, el alta bajo `specs/archive/`) hubiera quedado realmente en
el árbol de git.

## Qué pasó

El hueco no era teórico: se reprodujo dos veces.

La primera, en la feature 021: un archive quedó con la carpeta original todavía trackeada junto a
su copia en `specs/archive/`, sin que ningún chequeo automático lo notara — se corrigió a mano.

La segunda, más grave, fue el archive de la propia feature 025: el commit `294ccfc` la archivó con
6 líneas de alta y 0 de baja — la carpeta vieja quedó duplicada en el árbol —, pese a que el agente
que ejecutó ese paso (haiku, siguiendo `sdd-archive-feature.md`) tenía escrito en su propio
prompt, en texto llano: *"Call exactly one `sdd commit-slice`… do not invent one"*. El agente hizo
un `git commit` directo de todos modos, saltándose la CLI. El resultado pasó desapercibido por la
suite entera: `specs/` quedó con directorios duplicados, `sdd status` seguía reportando `archived`
sin matices, y los tests en verde no cubrían ese caso. Solo lo agarró una revisión manual.

Los dos episodios comparten la misma causa raíz: la instrucción de "usar la CLI, no hagas esto a
mano" vivía únicamente como prosa dentro del archivo que el agente lee y sigue por su cuenta. Nada
del lado del orquestador, ni del lado de `sdd status`, comprobaba el efecto real en el filesystem
o en el historial de git después del hecho.

## Decisión

La ceremonia de verificación de un phase handoff es código determinista dentro de la CLI, nunca
prosa que el agente se autoimpone. Dos piezas concretas:

- `sdd verify-archive <id>`: corre `git show --no-renames --name-status` sobre el commit del
  archive y exige al menos una línea de baja bajo `specs/<id>/` y al menos una de alta bajo
  `specs/archive/*-<id>/`, con `specs/<id>/` fuera del árbol de HEAD. Los orquestadores lo corren
  como validación post-fase y confían únicamente en su código de salida — nunca en lo que el
  agente reporte haber hecho.
- El chequeo de integridad de `sdd status`: si `specs/<id>/` y `specs/archive/*-<id>/` aparecen
  trackeados a la vez, reporta el estado roto en vez de `archived`. Es el backstop permanente —
  hubiera agarrado el bypass de `294ccfc` con solo correr `status` en cualquier momento posterior,
  sin depender de que el orquestador hubiera corrido en el momento exacto del archive.

La prosa del agente sigue teniendo un lugar — como self-check, como guía de lo que se espera que
haga — pero es UX, no enforcement. Enforcement es el código que corre después del hecho y verifica
el efecto en git y en el filesystem, no la promesa de que el agente lo hizo bien.

Hay un precedente externo directo para esta postura: la doctrina de gentle-ai (Apache-2.0 ©
gentleman-programming), en su `docs/testing-agents-deterministically.md`, lo dice en los mismos
términos: *"A model asserting 'I verified it, it passes' is prose, not proof."*

## Consecuencias

- Los tres archivos de orquestación (`sdd-next`, `sdd-auto`, `sdd-phase-common.md` § F) llevan la
  misma cláusula, verbatim, corriendo `sdd verify-archive` post-fase: fallo → reintento →
  `ESCALATED`. La fase de archive deja de ser reintentable sin verificación real de por medio.
- El propio agente de archive gana un self-check equivalente antes de borrar `.sdd-state` — no
  reemplaza la compuerta del orquestador, la complementa.
- `sdd status` queda como backstop permanente e independiente de cuándo corrió el orquestador:
  cualquier invocación posterior detecta el síntoma (carpetas duplicadas), no solo el momento del
  archive.
- Todo gate que se agregue de acá en más al pipeline hereda el mismo principio: verificar el
  efecto en git o en el filesystem después del hecho, nunca conformarse con que el agente narre
  haber seguido el procedimiento.

## Alternativas consideradas

- **Prosa más fuerte** en `sdd-archive-feature.md` — un texto más enfático, más ejemplos de qué no
  hacer. Descartada: ya falló dos veces con prosa que ya era explícita y literal ("do not invent
  one"); no hay margen de redacción que un agente no pueda saltearse bajo presión o ambigüedad.
- **Self-report del agente** como única señal — que el propio agente declare en su envelope que
  verificó el movimiento. Descartada: es exactamente el tipo de afirmación que este ADR sostiene
  que no se puede confiar sin verificación externa — el bypass de `294ccfc` ocurrió con un agente
  que, de habérsele preguntado, probablemente hubiera reportado éxito.
