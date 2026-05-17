# Tasks

## Execution order

### 1. Foundation
- [x] Initialize Node.js project: run `npm init`, create `src/` directory structure (`src/logger/`), add `winston` and `winston-daily-rotate-file` as dependencies.
- [x] Create logger configuration module (`src/logger/config.js`): define defaults for `LOG_LEVEL` (info), `LOG_DIR` (./logs), `LOG_MAX_SIZE` (10m), `LOG_MAX_FILES` (5), `LOG_FORMAT` (text). Support env variable overrides and an `options` object.

### 2. Core implementation
- [x] Create formatter module (`src/logger/formatter.js`): implement standard format `[ISO-8601] [LEVEL] [module] message { meta }`. Export a `winston.format` compatible formatter.
- [x] Create logger core (`src/logger/index.js`): implement singleton logger with `init(options?)` function. Configure console transport and file transport with rotation (using `winston-daily-rotate-file`). Apply the standard formatter to all transports. Export log methods: `info`, `warn`, `error`, `debug`.
- [x] Wire rotation settings: ensure file transport uses `maxSize` and `maxFiles` from config. Verify rotation creates new file and preserves all messages.

### 3. Validation
- [x] Unit tests: test formatter output matches standard format, test config defaults and overrides, test logger singleton returns same instance.
- [x] Integration tests: test file rotation triggers at configured max size, test no messages are lost during rotation (count messages written vs messages in rotated + active files).
- [x] Manual verification: document steps to start app, write logs, trigger rotation, and inspect output format.
- [x] Docs update: add `docs/architecture/logging.md` describing the logging module API, configuration options, and format specification.

## Notes
- Each task should map to a concrete change.
- Update `decisions.md` if the plan changes.
- Tasks in section 1 must complete before section 2. Section 3 can partially overlap with section 2 (unit tests can start once formatter is done).
- All configuration values must have sensible defaults so the logger works with zero configuration.
