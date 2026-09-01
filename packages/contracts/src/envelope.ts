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

interface WebCryptoLike {
  randomUUID?: () => string;
  getRandomValues?: (array: Uint8Array) => Uint8Array;
}

function randomUUID(): string {
  const webCrypto = (globalThis as { crypto?: WebCryptoLike }).crypto;
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

/**
 * The `--dry-run` mixin: what a mutating command reports it WOULD do.
 *
 * Every mutating command carries it (ADR-018 / the CLI contract), so it is
 * part of the envelope's vocabulary rather than any one command's result. It
 * lives here because `@seans-mfe/contracts` is the one package the CLI and
 * every plugin already depend on — PLUGIN-CONTRACT §1 requires it as a regular
 * dependency — which makes this the only place all three can share one
 * definition.
 *
 * It was previously declared in `src/oclif/results.ts` AND copied into
 * `@seans-mfe/plugin-bff/src/types.ts` under the comment "duplicated here so the
 * plugin is self-contained". Extracting a second plugin would have made three
 * copies of a contract type, which is precisely the shape ADR-080 exists to
 * make unrepresentable.
 */
export interface PlannedChange {
  op: 'create' | 'overwrite' | 'skip' | 'spawn';
  target: string;
  detail?: string;
}

/** Mixin added to every mutating command result. */
export interface MutatingResult {
  dryRun: boolean;
  plannedChanges?: PlannedChange[];
}

export type CommandResult<T = unknown> = {
  ok: boolean;
  data?: T;
  error?: CommandError;
  warnings: string[];
  telemetry: {
    durationMs: number;
    correlationId: string;
    /**
     * W3C trace id for this invocation (ADR-081), tying the envelope to the
     * events the command emitted and to anything it spawned.
     *
     * Optional because this envelope is a published contract (ADR-018) with
     * generated schemas behind it: `correlationId` stays, and consumers that
     * predate tracing keep working.
     */
    traceId?: string;
  };
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
  telemetry?: Partial<{ durationMs: number; correlationId: string; traceId: string }>,
): CommandResult<T> {
  return {
    ok: true,
    data,
    warnings,
    telemetry: {
      durationMs:    telemetry?.durationMs    ?? 0,
      correlationId: telemetry?.correlationId ?? randomUUID(),
      // Omitted rather than defaulted: an envelope with no trace id says
      // "untraced", which is honest. A minted-here id would say "traced" and
      // correlate with nothing (ADR-081).
      ...(telemetry?.traceId !== undefined && { traceId: telemetry.traceId }),
    },
  };
}

export function formatError(
  err: unknown,
  correlationId: string,
  startTime?: number,
  traceId?: string,
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
      ...(traceId !== undefined && { traceId }),
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
