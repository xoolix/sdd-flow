# Technical Plan

## Inputs
- Spec: `specs/001-centralized-logging/spec.md`
- Clarifications: None
- Research inputs: None (greenfield project, SMALL complexity)

## Current state
This is a greenfield project with no existing source code, no application framework, and no logging infrastructure. The repository contains only project scaffolding (specs, docs, tests directories — all empty). There is no runtime code to integrate with yet.

## Proposed design

### Overview
A centralized logging module that any application module can import and use. The logger enforces a standard format and supports automatic file rotation based on configurable size limits.

### Components

**1. Logger core (`src/logger/index.js`)**
- Singleton logger instance created on first import or explicit `init()` call.
- Wraps a logging library (e.g., `winston`) to provide structured, formatted output.
- Exposes standard log levels: `error`, `warn`, `info`, `debug`.

**2. Formatter (`src/logger/formatter.js`)**
- Defines the standard log format: `[ISO-8601 timestamp] [LEVEL] [module] message { optional JSON metadata }`.
- All log entries pass through this formatter, guaranteeing consistency regardless of calling module.

**3. Rotation handler (via transport configuration)**
- Uses file transport with rotation (e.g., `winston-daily-rotate-file` or built-in max-size rotation).
- Configurable `maxSize` (default: 10 MB) and `maxFiles` (default: 5 rotated files).
- Rotation is transparent — no log messages are lost during rotation.

**4. Configuration (`src/logger/config.js`)**
- Reads from environment variables or a config object passed to `init()`.
- Settings: `LOG_LEVEL`, `LOG_DIR`, `LOG_MAX_SIZE`, `LOG_MAX_FILES`, `LOG_FORMAT` (json | text).
- Sensible defaults for all settings.

### Initialization flow
1. Application entry point calls `logger.init(options?)` or imports the logger (auto-init with defaults).
2. Logger creates file transport with rotation config and console transport.
3. Logger instance is cached (singleton) — subsequent imports return the same instance.
4. Modules call `logger.info('message', { module: 'moduleName', ...meta })`.

## Touched areas
- Files/modules: `src/logger/index.js`, `src/logger/formatter.js`, `src/logger/config.js`, `package.json`
- APIs/contracts: Logger public API (`init`, `info`, `warn`, `error`, `debug`)
- DB/schema: N/A
- Jobs/workers: N/A
- UI surfaces: N/A

## Data flow
- **Write path**: Application module -> `logger.info(msg, meta)` -> formatter applies standard format -> transports (console + file with rotation) write output.
- **Read path**: Log files are read externally (tail, log aggregator). No in-app read path.
- **Rotation path**: When active log file exceeds `maxSize`, transport renames current file with timestamp suffix and creates a new file. Old files beyond `maxFiles` are deleted.

## Migration / rollout
- Backfill: N/A (greenfield)
- Compatibility: N/A
- Feature flags: N/A
- Rollback: Revert commit removes the logging module entirely.

## Observability
- Logs: This feature IS the logging infrastructure.
- Metrics: N/A for initial implementation.
- Alerts: N/A for initial implementation.

## Test strategy
- Unit: Test formatter produces correct format. Test config defaults and overrides. Test singleton behavior.
- Integration: Test file rotation triggers at configured size. Test no messages lost during rotation.
- E2E/manual: Start app, verify log file created with correct format, fill to rotation size, verify rotation occurs.

## Risks and mitigations
- **Risk**: Chosen logging library adds unnecessary weight. **Mitigation**: Use `winston` which is mature and widely adopted; evaluate bundle size.
- **Risk**: File rotation loses messages under high throughput. **Mitigation**: Integration test verifies message count before and after rotation; use stream-based writes.
