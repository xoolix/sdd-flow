---
name: architecture-map
description: High-level map of how this repository is structured and where changes should land
user-invocable: false
---

# Architecture Map

AWS Lambda function that processes SQS messages and forwards medical reports to the Wellbin API. Handles JWT authentication with token caching via AWS Parameter Store.

## Apps / Packages
- **Lambda Function** (single handler, Node.js 20.x runtime)
  - `handler.ts` — Main SQS event handler (entry point)
  - `scripts/` — Utility scripts (LocalStack setup)
  - `events/` — Sample SQS event payloads for local testing
  - `dist/` — Compiled JavaScript output

## Shared Libraries
- None — single-file handler with inline logic for auth, token caching, and API calls

## API Boundaries
- **Inbound:** AWS SQS trigger (batch of records with `accession_number` and `mrd_id`)
- **Outbound:**
  - `POST {AUTH_URL}` — Wellbin CRM login (username/password -> JWT)
  - `POST {API_URL}/api/admin/manual-medical-report/{mrd_id}/proccess-to-wellbin` — Submit report

## Data Stores
- **AWS Secrets Manager** — API credentials (`prod/api-waas/credentials`)
- **AWS SSM Parameter Store** — Cached JWT token (`/prod/api-waas/jwt-token`, SecureString)

## External Integrations
- **Wellbin CRM API** — JWT authentication
- **Wellbin Medical Report API** — Report submission
- **AWS SQS** — Event source (with DLQ for failed messages)
- **AWS Secrets Manager** — Credential storage
- **AWS SSM Parameter Store** — Token caching

## Operational Entrypoints
- `npm run build` — Compile TypeScript (`tsc`)
- `npm run dev` — Watch mode + SAM local API
- `npm run test-local` — Invoke handler locally via SAM with test event
- `npm run start-localstack` — Start LocalStack Docker container
- `npm run setup-local` — Configure LocalStack secrets/parameters
- `npm run deploy` — Deploy via AWS SAM
- `npm run deploy:guided` — First-time interactive SAM deployment
