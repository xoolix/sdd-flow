# Repository Constitution

## 1. Specs drive changes
All material changes should start from a feature spec or a research recommendation.

## 2. Research before architecture when uncertainty is high
If feasibility, scalability, security, model choice, or user experience is unclear, create a research spike before implementation.

## 3. Plans must be executable
Technical plans should mention touched modules, contracts, data model impact, migration impact, observability, and test strategy.

## 4. Tasks must be atomic
Each task should be small enough to implement and validate in one focused iteration.

## 5. Decisions must remain traceable
When implementation changes direction, update `decisions.md` or publish an ADR.

## 6. Done means verified
A feature is not done until acceptance criteria are checked and validation is recorded.

## 7. Test-first cuando aplica
Si el cambio tiene comportamiento testeable, el test va antes que el código. Test que falla, después código que pasa.

## 8. Evidence over claims
Done significa salida real de comandos pegada, no afirmaciones sobre cómo debería funcionar.
