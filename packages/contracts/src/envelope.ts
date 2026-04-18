import { randomUUID } from 'crypto';
import { classifyError } from './error-classifier';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CommandResult<T = unknown> = {
  ok: boolean;
  data?: T;
  error?: CommandError;
  warnings: string[];
  telemetry: { durationMs: number; correlationId: string };
};

export type CommandError = {
  type: string;
  code: number;
  message: string;
  retryable: boolean;
  userFacing: boolean;
  details?: unknown;
};

// ---------------------------------------------------------------------------
// Exit codes — sysexits-style
// ---------------------------------------------------------------------------

export const EXIT_CODES = {
  ok:         0,
  generic:    1,
  usage:      2,
  validation: 64,
  business:   65,
  network:    66,
  system:     69,
  unknown:    70,
  security:   77,
  timeout:    124,
} as const;

export type ExitCodeKey = keyof typeof EXIT_CODES;

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

export function exitCodeFor(type: string): number {
  if (type in EXIT_CODES) {
    return EXIT_CODES[type as ExitCodeKey];
  }
  return EXIT_CODES.unknown;
}

export function formatSuccess<T>(
  data: T,
  warnings: string[] = [],
  telemetry?: Partial<{ durationMs: number; correlationId: string }>,
): CommandResult<T> {
  return {
    ok: true,
    data,
    warnings,
    telemetry: {
      durationMs:    telemetry?.durationMs    ?? 0,
      correlationId: telemetry?.correlationId ?? randomUUID(),
    },
  };
}

export function formatError(
  err: unknown,
  correlationId: string,
  startTime?: number,
): CommandResult<never> {
  const error = err instanceof Error ? err : new Error(String(err));
  const classification = classifyError(error, { types: [] });

  const details = buildDetails(error);

  const cmdError: CommandError = {
    type:       classification.type,
    code:       exitCodeFor(classification.type),
    message:    error.message,
    retryable:  classification.retryable,
    userFacing: classification.userFacing ?? false,
    ...(details !== undefined && { details }),
  };

  return {
    ok: false,
    error: cmdError,
    warnings: [],
    telemetry: {
      durationMs:    startTime ? Date.now() - startTime : 0,
      correlationId,
    },
  };
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function buildDetails(error: Error): unknown {
  const e = error as unknown as Record<string, unknown>;
  if (e['field'] !== undefined) {
    return { field: e['field'], constraint: e['constraint'] };
  }
  if (e['details'] !== undefined) {
    return e['details'];
  }
  if (e['statusCode'] !== undefined) {
    return { statusCode: e['statusCode'] };
  }
  return undefined;
}
