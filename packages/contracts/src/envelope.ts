import { classifyError } from './error-classifier';

// ---------------------------------------------------------------------------
// Isomorphic correlation id (ADR-054)
//
// `envelope` is re-exported from the contracts barrel, which is now consumed by
// browser shells (control-plane protocol), not just the Node CLI. Importing
// Node's `crypto` module pulls a builtin into the browser bundle that rspack
// can't resolve. The Web Crypto API (`globalThis.crypto`) is available in both
// browsers (secure context) and Node ≥18, so we use it directly, with a manual
// RFC-4122 v4 fallback for runtimes where it is absent.
// ---------------------------------------------------------------------------

function randomUUID(): string {
  const webCrypto = (globalThis as { crypto?: Crypto }).crypto;
  if (webCrypto && typeof webCrypto.randomUUID === 'function') {
    return webCrypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (webCrypto && typeof webCrypto.getRandomValues === 'function') {
    webCrypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10

  const hex: string[] = [];
  for (let i = 0; i < 16; i += 1) {
    hex.push(bytes[i].toString(16).padStart(2, '0'));
  }
  return (
    hex.slice(0, 4).join('') +
    '-' +
    hex.slice(4, 6).join('') +
    '-' +
    hex.slice(6, 8).join('') +
    '-' +
    hex.slice(8, 10).join('') +
    '-' +
    hex.slice(10, 16).join('')
  );
}

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
