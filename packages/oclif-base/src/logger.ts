/**
 * The platform event emitter (ADR-081).
 *
 * ADR-039 asked for "the structured logger from `@falese/smt-oclif-base`". This
 * is it — but emitting the platform-wide `PlatformEvent` schema rather than a
 * CLI-local log format, so a warning from codegen and a span from a command
 * land in the same vocabulary and under the same trace.
 *
 * It writes to `process.stderr` directly and never through `console`. The
 * `--json` stdout contract (ADR-018) is held today by `redirectStdoutToStderr()`
 * monkey-patching `console.log`; an emitter that went through `console` would be
 * correct only while that patch is installed. Writing to stderr itself is
 * correct unconditionally — and one fewer thing depending on a global patch.
 */

import {
  childContext,
  endSpan,
  formatTraceparent,
  logEvent,
  startSpan,
  type Attributes,
  type PlatformEvent,
  type Severity,
  type TraceContext,
} from '@falese/smt-contracts';

/** `silent` is not a severity — it is the absence of all of them. */
export type LogLevel = Severity | 'silent';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

export interface LoggerOptions {
  /** The trace this logger's events belong to. */
  context: TraceContext;
  /** Minimum severity to emit. Default `info`. */
  level?: LogLevel;
  /** Attributes merged into every event — `service.name`, `cli.command`, … */
  attributes?: Attributes;
  /** Sink override. Defaults to stderr; tests and embedders can redirect. */
  write?: (line: string) => void;
}

export interface Logger {
  debug(message: string, attributes?: Attributes): void;
  info(message: string, attributes?: Attributes): void;
  warn(message: string, attributes?: Attributes): void;
  error(message: string, attributes?: Attributes): void;
  /**
   * Time an operation as a span. The callback receives a child logger whose
   * events nest under it, so work done inside is attributable to it.
   * Rethrows after recording the failure — this observes, it does not swallow.
   */
  span<T>(name: string, fn: (logger: Logger) => Promise<T>, attributes?: Attributes): Promise<T>;
  /** `traceparent` to hand to a child process via the `TRACEPARENT` env var. */
  traceparent(): string;
  /** This logger's trace id, for the command envelope (ADR-018). */
  traceId(): string;
}

function writeToStderr(line: string): void {
  process.stderr.write(line + '\n');
}

/**
 * Resolve the level from an explicit option, then the environment.
 *
 * `SMT_LOG_LEVEL` is read here rather than in `BaseCommand` so library code
 * that builds its own logger honours it too.
 */
function resolveLevel(explicit: LogLevel | undefined): LogLevel {
  if (explicit) return explicit;
  const fromEnv = process.env['SMT_LOG_LEVEL']?.toLowerCase();
  if (fromEnv && fromEnv in LEVEL_ORDER) return fromEnv as LogLevel;
  return 'info';
}

export function createLogger(options: LoggerOptions): Logger {
  const level = resolveLevel(options.level);
  const write = options.write ?? writeToStderr;
  const base = options.attributes;

  const threshold = LEVEL_ORDER[level];

  const emit = (event: PlatformEvent): void => {
    // JSON.stringify handles the escaping, so a message with a newline stays
    // one record rather than becoming two malformed ones.
    write(JSON.stringify(event));
  };

  const merge = (attributes?: Attributes): Attributes | undefined => {
    if (!base && !attributes) return undefined;
    return { ...base, ...attributes };
  };

  const log = (severity: Severity, message: string, attributes?: Attributes): void => {
    if (LEVEL_ORDER[severity] < threshold) return;
    emit(logEvent(options.context, severity, message, merge(attributes)));
  };

  return {
    debug: (message, attributes) => log('debug', message, attributes),
    info: (message, attributes) => log('info', message, attributes),
    warn: (message, attributes) => log('warn', message, attributes),
    error: (message, attributes) => log('error', message, attributes),

    async span<T>(
      name: string,
      fn: (logger: Logger) => Promise<T>,
      attributes?: Attributes,
    ): Promise<T> {
      const spanContext = childContext(options.context);
      const span = startSpan(spanContext, name, merge(attributes));
      const inner = createLogger({ ...options, context: spanContext, level });

      try {
        const result = await fn(inner);
        if (threshold < LEVEL_ORDER.silent) emit(endSpan(span, { status: 'ok' }));
        return result;
      } catch (error) {
        if (threshold < LEVEL_ORDER.silent) emit(endSpan(span, { status: 'error', error }));
        throw error;
      }
    },

    traceparent: () => formatTraceparent(options.context),
    traceId: () => options.context.traceId,
  };
}
