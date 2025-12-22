# Logger Package Implementation Plan

## Overview

Implement a `@seans-mfe-tool/logger` package to replace ~397 console.log/error/warn statements across the MFE tool monorepo with a structured, testable logging solution that integrates seamlessly with existing chalk-based colored output.

## Architecture

### Package Structure

```
packages/logger/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                 # Public API exports
│   ├── logger.ts                # Core Logger class
│   ├── formatters/
│   │   ├── index.ts
│   │   ├── cli-formatter.ts     # Chalk-based colored output
│   │   ├── json-formatter.ts    # Structured JSON logging
│   │   └── plain-formatter.ts   # Plain text (no colors)
│   ├── transports/
│   │   ├── index.ts
│   │   └── console-transport.ts # Console output (default)
│   ├── levels.ts                # Log level definitions
│   ├── types.ts                 # TypeScript interfaces
│   └── __tests__/
│       └── logger.test.ts
└── README.md
```

### Core API Design

```typescript
export type LogLevel = 'debug' | 'info' | 'success' | 'warn' | 'error';
export type LogContext = string;

export interface LoggerOptions {
  level?: LogLevel;
  context?: LogContext;
  formatter?: 'cli' | 'json' | 'plain';
  silent?: boolean;
  colors?: boolean;
  timestamp?: boolean;
  metadata?: Record<string, unknown>;
}

export class Logger {
  // Logging methods
  debug(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  success(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string | Error, metadata?: Record<string, unknown>): void;

  // Utility methods
  setLevel(level: LogLevel): void;
  setContext(context: LogContext): void;
  setSilent(silent: boolean): void;
  child(context: LogContext, metadata?: Record<string, unknown>): Logger;

  // Formatting helpers (chalk integration)
  format: {
    success: (text: string) => string;
    error: (text: string) => string;
    warn: (text: string) => string;
    info: (text: string) => string;
    debug: (text: string) => string;
    command: (text: string) => string;
    path: (text: string) => string;
    code: (text: string) => string;
  };
}

// Factory and singleton
export function createLogger(options?: LoggerOptions): Logger;
export const logger: Logger;
```

### Key Features

1. **Multiple Log Levels**: debug, info, success, warn, error
2. **Chalk Integration**: Seamless colored output using existing chalk dependency
3. **Contextual Logging**: Scoped loggers with context strings (e.g., 'bff:build', 'runtime:lifecycle')
4. **Metadata Support**: Attach structured data to log entries
5. **Silent Mode**: Suppress all output (useful for tests)
6. **Child Loggers**: Create scoped loggers with inherited context
7. **TypeScript Support**: Full type safety

## Implementation Steps

### 1. Create Logger Package Structure

- Create `/packages/logger/` directory
- Add package.json with dependencies (chalk ^4.1.2)
- Add tsconfig.json with composite project configuration
- Update root tsconfig.json with logger reference
- Update root package.json build scripts

### 2. Implement Core Logger

Files to create:
- `src/types.ts` - TypeScript interfaces and types
- `src/levels.ts` - Log level definitions and hierarchy
- `src/logger.ts` - Core Logger class implementation
- `src/formatters/cli-formatter.ts` - Chalk-based formatter
- `src/formatters/json-formatter.ts` - JSON formatter
- `src/formatters/plain-formatter.ts` - Plain text formatter
- `src/transports/console-transport.ts` - Console output
- `src/index.ts` - Public API exports

### 3. Add Tests

- Unit tests for Logger class
- Tests for formatters
- Integration tests

### 4. Integrate with CLI Package

Update `packages/cli/package.json` to add logger dependency.

Migrate console statements in priority order:
- `src/commands/bff.ts` (54 statements)
- `src/commands/deploy.ts` (62 statements)
- `src/commands/create-api.ts` (57 statements)
- `src/commands/remote-generate.ts` (22 statements)
- `src/commands/remote-init.ts` (16 statements)

### 5. Integrate with Runtime Package

Update `packages/runtime/package.json` to add logger dependency.

Migrate console statements:
- `src/base-mfe.ts` (20 statements)
- `src/remote-mfe.ts` (4 statements)
- Update telemetry service to use logger

### 6. Integrate with Codegen Package

Update `packages/codegen/package.json` to add logger dependency.

Migrate console statements:
- `src/UnifiedGenerator/unified-generator.ts` (11 statements)
- `src/APIGenerator/` components (~83 statements)
- Update generated templates to use logger

### 7. Update Documentation

- Create README.md for logger package
- Add migration guide
- Create ADR-069: Structured Logging with Logger Package
- Update main project documentation

## Migration Patterns

### Basic Replacements

```typescript
// Before: console.log(chalk.blue('Building BFF...'));
logger.info('Building BFF...');

// Before: console.log(chalk.green('✓ BFF build complete'));
logger.success('BFF build complete');

// Before: console.error(chalk.red('✗ Build failed'));
logger.error('Build failed');

// Before: console.log(chalk.yellow('⚠ Warning: spec not found'));
logger.warn('Warning: spec not found');
```

### Contextual Usage

```typescript
// Create scoped logger for a command
const bffLogger = logger.child('bff:build');
bffLogger.info('Extracting Mesh configuration...');
bffLogger.success('Configuration extracted');
```

### Metadata Usage

```typescript
// Add structured metadata
logger.info('Processing file', { path: '/path/to/file.ts', size: 1024 });
logger.error('Validation failed', { errors: validationErrors });
```

## Success Criteria

- [ ] Logger package created and building successfully
- [ ] All tests passing
- [ ] CLI commands migrated (211 statements)
- [ ] Runtime package migrated (87 statements)
- [ ] Codegen package migrated (94 statements)
- [ ] Documentation complete
- [ ] No console.log/error/warn statements remaining (except in tests where intentional)
- [ ] All existing tests still passing
