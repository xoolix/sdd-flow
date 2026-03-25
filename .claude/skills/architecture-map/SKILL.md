---
name: architecture-map
description: High-level map of how this repository is structured and where changes should land
user-invocable: false
---

# Architecture Map

**api-turnos-nest** — NestJS REST API that reverse-engineers the EGES medical appointment system, providing modern endpoints while writing to the same SQL Server database for full compatibility.

## Apps / Packages

| App | Directory | Stack | Purpose |
|-----|-----------|-------|---------|
| API Server | `src/` | NestJS 11, TypeScript 5.9, mssql | REST API for appointment scheduling |
| CLI | `src/cli.ts` | nest-commander | Admin commands (API key management) |
| Decompiled Source | `decompiled/` | C# (.NET) | Original EGES system — source of truth for business logic |

Single application (not a monorepo). Managed by **Yarn** with **Node.js >=20**.

## Shared Libraries

| Module | Path | Purpose |
|--------|------|---------|
| Database service | `src/database/database.service.ts` | EGES SQL Server connection pool (mssql) |
| Auth DB service | `src/database/auth-database.service.ts` | Auth database connection |
| Date utilities | `src/utils/date-utils.ts` | Timezone-aware date helpers (Argentina) |
| Horario utilities | `src/utils/horario-utils.ts` | Schedule/timetable helpers |
| String utilities | `src/utils/string-utils.ts` | String manipulation |
| Filter utilities | `src/utils/filter-utils.ts` | Query filtering helpers |
| TimeSet | `src/utils/time-set.ts` | Time slot set operations |
| Common module | `src/common/` | Winston logger, OpenSearch logger, guards, interceptors, decorators |
| Config | `src/config/` | Database configs, practices mapping JSON |

## API Boundaries

**REST API** (prefix: `/api`, Swagger docs at `/api/docs`):

| Module | Key Endpoints | Purpose |
|--------|--------------|---------|
| schedule | `GET /schedule/preview` | **Critical** — appointment availability calculation |
| turnos | `POST /appointments`, `GET /appointments` | Appointment CRUD |
| pacientes | Patient lookup/management | Patient data operations |
| catalogos | Provinces, cities, localities | System catalog data |
| servicios | Medical services | Service listings |
| obras-sociales | Health insurance plans | Insurance coverage |
| practicas | Medical practices | Practice definitions |
| admin | Admin operations | Cache management, system admin |
| health | `GET /health` | Health checks (Terminus) |
| whatsapp-confirmation | WhatsApp confirmation webhooks | Appointment confirmation via WhatsApp |

**Authentication:** API key strategy via `passport-custom` (header-based).

## Data Stores

| Store | Technology | Purpose |
|-------|-----------|---------|
| EGES Database | SQL Server (mssql driver, raw SQL) | Primary data — appointments, patients, schedules, practices |
| Auth Database | SQL Server (separate connection) | API keys and permissions |
| In-memory cache | cache-manager + keyv | Comportamientos, duraciones, prácticas, excepciones caching |

**No ORM** — all queries are raw SQL via the mssql driver. Schema documented in `docs/schema.sql`.

## External Integrations

| Service | Library | Purpose |
|---------|---------|---------|
| AWS SQS | @aws-sdk/client-sqs | Message queue (WhatsApp confirmations) |
| OpenSearch | @opensearch-project/opensearch | Optional structured logging destination |
| WhatsApp/Botmaker | HTTP (axios) | Patient appointment confirmation |

## Feature Modules

| Module | Path | Purpose |
|--------|------|---------|
| **comportamientos** | `src/modules/comportamientos/` | **Critical** — business rules engine affecting availability, validation, durations |
| **schedule** | `src/modules/schedule/` | Availability calculation (93KB service) |
| **turnos** | `src/modules/turnos/` | Appointment management (50KB service) |
| horarios | `src/modules/horarios/` | Professional schedules |
| duraciones | `src/modules/duraciones/` | Duration configurations with caching |
| feriados | `src/modules/feriados/` | Holiday management |
| topes | `src/modules/topes/` | Appointment limits/caps |
| condiciones | `src/modules/condiciones/` | Patient conditions (age, weight, claustrophobia) |
| whatsapp-confirmation | `src/modules/whatsapp-confirmation/` | WhatsApp-based appointment confirmation |

## Operational Entrypoints

| Command | Purpose |
|---------|---------|
| `yarn install` | Install dependencies |
| `yarn start:dev` | Dev server with hot reload (port 3003) |
| `yarn start:debug` | Debug mode |
| `yarn build` | Compile TypeScript to `dist/` |
| `yarn start:prod` | Production server (`node dist/main`) |
| `yarn test` | Unit tests (Jest) |
| `yarn test:e2e` | End-to-end tests |
| `yarn test:cov` | Test coverage report |
| `yarn lint` | ESLint with auto-fix |
| `yarn format` | Prettier formatting |
| `yarn cli` | CLI commands (API key management) |
| `docker compose up` | Docker deployment (port 3000) |
