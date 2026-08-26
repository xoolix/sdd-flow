# Feature: Autonomous SDD Pipeline

## Summary
Hacer el pipeline SDD más autónomo: el orquestador valida automáticamente el output de cada sub-agente (artifacts, lint/tests, envelope), reintenta con feedback si falla (max 2), y solo escala al humano para decisiones reales o bloqueos. Se eliminan confirmaciones innecesarias de `sdd-continue` y `sdd-ff`.

## Trigger
Usuario invoca `/sdd-continue` o `/sdd-ff`. Cada transición entre fases activa el loop de validación + retry.

## Happy Path
1. Usuario invoca `/sdd-continue` o `/sdd-ff`
2. Orquestador detecta la fase actual
3. Lanza sub-agente sin pedir confirmación al usuario
4. Sub-agente ejecuta la fase, retorna result envelope
5. Orquestador valida automáticamente: artifacts existen en disco, lint/typecheck/tests pasan, envelope completo
6. Si validación OK → avanza a siguiente fase (`sdd-ff`) o presenta resumen (`sdd-continue`)
7. Si validación FAIL → re-lanza sub-agente con errores específicos (max 2 reintentos)
8. Si 2 fallos → escala al humano con diagnóstico

## Domains
- [x] Other: Skills SDD (`sdd-continue`, `sdd-ff`, `sdd-phase-common`)
- [x] Other: Orchestrator rules (`CLAUDE.md`)
- [x] Other: Result envelope contract

## Edge Cases
- Sub-agente retorna `partial` en la misma task 2 veces seguidas → loop infinito en `sdd-ff`. Solución: trackear intentos por task, cap en 2.
- Validación falla por causa externa (lint config rota, tests de otra feature) → retry inútil que gasta tokens. Solución: el diagnóstico de escalación debe incluir contexto suficiente para que el humano identifique si el error es del agente o del entorno.

## Acceptance Criteria
- [ ] Given un sub-agente que completa una fase exitosamente, When el orquestador valida el output, Then avanza a la siguiente fase sin pedir confirmación al usuario.
- [ ] Given un sub-agente que falla validación (lint/test/artifacts), When el orquestador detecta el fallo, Then re-lanza el sub-agente con los errores específicos en el prompt (max 2 reintentos).
- [ ] Given un sub-agente que falla 2 veces en la misma fase, When se agota el budget de reintentos, Then escala al humano con status ESCALATED y diagnóstico de qué falló.
- [ ] Given `sdd-ff` ejecutando implement-task, When la misma task falla 2 veces seguidas, Then detiene el loop y escala en vez de reintentar infinitamente.

## Rollback Plan
- Revert de los commits que modifiquen los SKILL.md — vuelve al modelo manual con confirmaciones.

## Success Criteria
- El pipeline completa un `/sdd-ff` de punta a punta sin intervención humana en al menos 1 feature de prueba.

## Open Questions
- Ninguna
