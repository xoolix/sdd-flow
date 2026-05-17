# Feature: SDD Orchestration Refinements

## Summary

Mejorar el framework SDD con tres refinamientos inspirados en agent-teams-lite: (1) regla explícita de orchestrator-never-executes en skills orquestadores, (2) fase de exploración automática integrada en `/plan-feature`, y (3) formalización de Given/When/Then en specs y verificación en `/review-feature`.

## Trigger

Mejora interna del framework. Se aplica cuando un desarrollador ejecuta `/plan-feature`, `/review-feature` o `/new-feature`.

## Happy Path

1. Dev ejecuta `/plan-feature` → el skill lanza un Explore agent automático para mapear el codebase relevante antes de diseñar
2. El skill nunca lee/edita código fuente directamente — delega todo a sub-agentes (hard stop)
3. Los sub-agentes devuelven resultados estructurados, el orquestador sintetiza el plan
4. Dev ejecuta `/new-feature` → los acceptance criteria se piden y generan en formato Given/When/Then
5. Dev ejecuta `/review-feature` → la compliance matrix mapea cada scenario GWT a evidencia de test concreta

## Domains

- [x] Other: Skills (`plan-feature`, `review-feature`, `new-feature` SKILL.md)
- [x] Other: Templates (`spec-template.md`)
- [x] Other: Rules/conventions (CLAUDE.md o conventions.md)

## Edge Cases

- **Hard-stop demasiado estricto**: El orquestador necesita leer archivos de estado (tasks.md, spec.md, decisions.md, architecture-map) para coordinar. La regla debe excluir explícitamente estos archivos — solo aplica a código fuente y configuración del proyecto.
- **Explore agrega latencia innecesaria**: En features pequeñas donde el dev ya conoce el codebase, la exploración automática es overhead. Considerar un flag o heurística para skip (ej: si el spec menciona menos de 2 dominios).

## Acceptance Criteria

- [x] Given un dev ejecuta `/plan-feature`, When el skill necesita analizar código fuente, Then delega a un sub-agente Explore en vez de usar Read/Grep directamente (excepto archivos de estado: tasks.md, spec.md, decisions.md)
- [x] Given un dev ejecuta `/plan-feature`, When arranca el proceso, Then automáticamente lanza una fase de exploración del codebase antes de diseñar el plan
- [x] Given un dev ejecuta `/new-feature`, When se piden acceptance criteria, Then se exigen en formato Given/When/Then y no se genera el spec hasta que estén en ese formato
- [x] Given un dev ejecuta `/review-feature`, When se construye la compliance matrix, Then cada scenario GWT del spec se mapea a evidencia de test concreta (pass/fail/missing)

## Rollback Plan

- `git revert` del commit. Son cambios a archivos `.md` (skills y templates), sin migraciones ni runtime.

## Success Criteria

- Ejecutar `/plan-feature` en una feature de prueba y verificar que: el orquestador nunca usa Read/Grep sobre código fuente (solo delega), se genera exploración antes del plan, y los acceptance criteria del spec resultante están en formato GWT.

## Open Questions (resolved)

- ~~¿Definir la lista exacta de "archivos de estado"?~~ → Resuelto: `spec.md`, `plan.md`, `tasks.md`, `decisions.md`, architecture-map output, templates en `.specify/`
- ~~¿Explore genera `exploration.md` persistente?~~ → Resuelto: resultados pasan en memoria al orquestador, sin archivo persistente
