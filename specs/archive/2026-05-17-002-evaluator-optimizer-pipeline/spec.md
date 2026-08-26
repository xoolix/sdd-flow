# Feature: Evaluator-Optimizer Pipeline with Voting Review

## Summary
Mejorar el pipeline SDD con 3 patrones de Anthropic: (1) environment feedback durante implement-task (tests/lint inline, no solo al final), (2) voting en review con 3 agentes paralelos, (3) loop evaluator-optimizer donde review FAIL → auto-fix → re-review (max 2 ciclos).

## Trigger
Se activa cuando el pipeline llega a `/implement-task` (environment feedback) y `/review-feature` (voting + evaluator-optimizer loop).

## Happy Path
1. `/implement-task` ejecuta — sub-agente corre tests/lint **durante** la implementación, corrige en el momento, incluye output en envelope
2. Todas las tasks completas → orquestador lanza `/review-feature`
3. Se lanzan 3 agentes de review en paralelo (voting)
4. Orquestador compara veredictos: coinciden → usa veredicto, divergen → flag al humano
5. Si veredicto FAIL → orquestador lanza `/implement-task` con feedback específico (qué criterios fallaron)
6. Después del fix → re-review automático
7. Loop hasta PASS o max 2 ciclos review→fix

## Domains
- [x] Other: implement-task skill (environment feedback inline)
- [x] Other: review-feature skill (voting con 3 agentes paralelos + feedback específico)
- [x] Other: sdd-continue / sdd-ff (loop evaluator-optimizer: review → fix → re-review)
- [x] Other: sdd-phase-common (envelope con test output y review feedback)

## Edge Cases
- Los 3 agentes de review dan veredictos distintos (1 PASS, 1 FAIL, 1 PASS WITH WARNINGS) → mayoría simple, pero si hay un FAIL se flaggea al humano.
- Loop evaluator-optimizer no converge (review FAIL, fix, re-review FAIL por otro motivo) → cap de 2 ciclos, luego ESCALATE.

## Acceptance Criteria
- [ ] Given un implement-task ejecutándose, When el sub-agente modifica código, Then corre tests/lint durante la implementación e incluye el output concreto en el result envelope.
- [ ] Given todas las tasks completas y se lanza review-feature, When se inicia el review, Then se lanzan 3 agentes de review en paralelo y el orquestador compara veredictos (coinciden → usa veredicto, divergen → flag al humano).
- [ ] Given un review con veredicto FAIL, When el orquestador recibe el resultado, Then lanza automáticamente implement-task con el feedback específico del review.
- [ ] Given un loop evaluator-optimizer en curso, When el re-review falla por segunda vez, Then detiene el loop y escala al humano (max 2 ciclos review→fix).

## Rollback Plan
- Revert de los commits en los SKILL.md — vuelve al review simple sin voting ni loop.

## Success Criteria
- Un `/sdd-ff` completa el ciclo review→fix→re-review automáticamente en al menos 1 feature de prueba, y el voting de 3 agentes produce un veredicto consensuado.

## Open Questions
- Ninguna
