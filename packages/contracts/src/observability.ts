/**
 * The platform's one observability vocabulary (ADR-081).
 *
 * Every surface — CLI, codegen, control plane, MFE runtime, BFF — describes
 * itself with `PlatformEvent`, which is structurally an OpenTelemetry span or
 * log record. Records are correlated by a W3C trace context that propagates
 * across process boundaries, so a render can be attributed to the build that
 * produced it.
 *
 * This module deliberately depends on nothing:
 *
 *   • No `@opentelemetry/*`. `packages/runtime` is federated into a browser
 *     bundle and the ADR-056 boundary test forbids extra imports there. The
 *     mapping to the OTel SDK is documented in ADR-081 and performed by a
 *     Node-only exporter, when one is wanted.
 *   • No Node builtins. The contracts barrel is consumed by browser shells, so
 *     `crypto` would pull in a builtin rspack cannot resolve — the same lesson
 *     `envelope` learned. Web Crypto is used where available, with a fallback.
 *   • No I/O. This is the schema; emitters do the writing.
 */

// ---------------------------------------------------------------------------
// Attributes
// ---------------------------------------------------------------------------

/**
 * The OTel primitive attribute set. Anything outside it cannot be exported
 * without lossy coercion, so it is not representable here either.
 *
 * Names follow OTel semantic conventions where one exists (`service.name`,
 * `error.type`) and a platform namespace where none does (`cli.command`,
 * `mfe.id`, `mfe.capability`, `mfe.phase`, `slot.address`, `codegen.template`).
 */
export type AttributeValue = string | number | boolean | string[] | number[] | boolean[];

export type Attributes = Record<string, AttributeValue>;

/** Span outcome, mapping to OTel's `SpanStatusCode`. */
export type EventStatus = 'unset' | 'ok' | 'error';

/** Log severity, mapping to OTel's `severityNumber` buckets. */
export type Severity = 'debug' | 'info' | 'warn' | 'error';

/**
 * One observability record.
 *
 * A record with a `duration` reads as a span; one with a `severity` and no
 * `duration` reads as a log event. Both travel the same channel on purpose:
 * splitting logs from traces at the producer is what makes them impossible to
 * join at the consumer.
 */
export interface PlatformEvent {
  /** 32 lowercase hex characters. Shared by everything in one logical operation. */
  traceId: string;
  /** 16 lowercase hex characters. Identifies this record's own unit of work. */
  spanId: string;
  /** The enclosing span, when there is one. */
  parentSpanId?: string;
  /** Operation name for a span; the message for a log event. */
  name: string;
  /** ISO-8601. */
  startTime: string;
  /** Milliseconds. Present on spans, absent on log events. */
  duration?: number;
  status: EventStatus;
  /** Why the status is what it is — typically an error message. */
  statusMessage?: string;
  severity?: Severity;
  attributes?: Attributes;
}

/** The identity a record is emitted under, threaded through a call path. */
export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  /** Whether downstream should record. Absent means yes. */
  sampled?: boolean;
}

// ---------------------------------------------------------------------------
// Id generation
// ---------------------------------------------------------------------------

interface WebCryptoLike {
  getRandomValues?: (array: Uint8Array) => Uint8Array;
}

/** Random bytes from Web Crypto where available, `Math.random` where not. */
function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  const webCrypto = (globalThis as { crypto?: WebCryptoLike }).crypto;
  if (webCrypto && typeof webCrypto.getRandomValues === 'function') {
    webCrypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytes;
}

function toHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i += 1) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Random hex of the given byte length, never all-zero.
 *
 * The all-zero id is reserved by the W3C spec as "invalid", and a receiver is
 * entitled to drop a header carrying one. Astronomically unlikely from a real
 * RNG, but reachable from a stubbed one, which is exactly when it would be
 * hardest to diagnose.
 */
function randomId(byteLength: number): string {
  const bytes = randomBytes(byteLength);
  if (bytes.every((b) => b === 0)) bytes[byteLength - 1] = 1;
  return toHex(bytes);
}

export function newTraceId(): string {
  return randomId(16);
}

export function newSpanId(): string {
  return randomId(8);
}

// ---------------------------------------------------------------------------
// W3C trace context
// ---------------------------------------------------------------------------

/** The only `traceparent` version defined so far. */
const TRACEPARENT_VERSION = '00';

const HEX_32 = /^[0-9a-f]{32}$/;
const HEX_16 = /^[0-9a-f]{16}$/;

/** Serialize for the `traceparent` header or the `TRACEPARENT` env var. */
export function formatTraceparent(context: TraceContext): string {
  const flags = context.sampled === false ? '00' : '01';
  return `${TRACEPARENT_VERSION}-${context.traceId}-${context.spanId}-${flags}`;
}

/**
 * Parse a `traceparent`, returning `undefined` for anything malformed.
 *
 * Undefined rather than throwing: an unparseable inherited header means we
 * start a new trace, which is a recoverable loss of correlation. Failing a
 * command because a caller passed a bad env var would not be.
 */
export function parseTraceparent(header: string | undefined): TraceContext | undefined {
  if (!header) return undefined;

  const parts = header.trim().toLowerCase().split('-');
  if (parts.length !== 4) return undefined;

  const [version, traceId, spanId, flags] = parts;
  if (version !== TRACEPARENT_VERSION) return undefined;
  if (!HEX_32.test(traceId) || traceId === '0'.repeat(32)) return undefined;
  if (!HEX_16.test(spanId) || spanId === '0'.repeat(16)) return undefined;
  if (!/^[0-9a-f]{2}$/.test(flags)) return undefined;

  return { traceId, spanId, sampled: (Number.parseInt(flags, 16) & 0x01) === 0x01 };
}

/**
 * The trace context this process should emit under.
 *
 * Inherits from `TRACEPARENT` when a caller set one — becoming a child of that
 * span — and starts a fresh root trace otherwise. This is what ties a `mesh
 * build` or an MCP child process (ADR-019) back to the command that spawned it.
 *
 * The environment is a parameter rather than read from `process.env` so this
 * module stays free of Node globals and directly testable.
 */
export function traceContextFromEnv(env: Record<string, string | undefined>): TraceContext {
  const inherited = parseTraceparent(env['TRACEPARENT'] ?? env['traceparent']);
  if (inherited) {
    return {
      traceId: inherited.traceId,
      spanId: newSpanId(),
      parentSpanId: inherited.spanId,
      sampled: inherited.sampled,
    };
  }
  return { traceId: newTraceId(), spanId: newSpanId() };
}

/** A child context for work nested inside `parent`. */
export function childContext(parent: TraceContext): TraceContext {
  return {
    traceId: parent.traceId,
    spanId: newSpanId(),
    parentSpanId: parent.spanId,
    sampled: parent.sampled,
  };
}

// ---------------------------------------------------------------------------
// Record construction
// ---------------------------------------------------------------------------

/** Read the type name an error should be attributed to. */
function errorType(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    // Typed errors from ./errors carry their own discriminant, which is more
    // useful than the constructor name a bundler may have mangled.
    const typed = (error as { type?: unknown }).type;
    if (typeof typed === 'string' && typed.length > 0) return typed;
    const ctor = (error as { constructor?: { name?: string } }).constructor;
    if (ctor?.name) return ctor.name;
  }
  return 'unknown';
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/** Begin a span. Pair with `endSpan` to give it a duration and an outcome. */
export function startSpan(
  context: TraceContext,
  name: string,
  attributes?: Attributes,
): PlatformEvent {
  return {
    traceId: context.traceId,
    spanId: context.spanId,
    ...(context.parentSpanId ? { parentSpanId: context.parentSpanId } : {}),
    name,
    startTime: new Date().toISOString(),
    status: 'unset',
    ...(attributes ? { attributes } : {}),
  };
}

export interface EndSpanOptions {
  status: EventStatus;
  error?: unknown;
  attributes?: Attributes;
}

/**
 * Close a span: stamp its duration, outcome, and — when it failed — the error
 * type and message, under the OTel-conventional `error.type` attribute.
 */
export function endSpan(span: PlatformEvent, options: EndSpanOptions): PlatformEvent {
  const attributes: Attributes = { ...span.attributes, ...options.attributes };
  if (options.error !== undefined) {
    attributes['error.type'] = errorType(options.error);
  }

  return {
    ...span,
    status: options.status,
    duration: Math.max(0, Date.now() - Date.parse(span.startTime)),
    ...(options.error !== undefined ? { statusMessage: errorMessage(options.error) } : {}),
    ...(Object.keys(attributes).length > 0 ? { attributes } : {}),
  };
}

/**
 * A point-in-time record — what a log line becomes.
 *
 * It hangs off the current span as its parent, so a warning emitted during
 * codegen is attributable to the template render it happened inside. Error
 * severity also sets error status, so consumers can filter failures on one
 * field regardless of whether they came from a span or a log.
 */
export function logEvent(
  context: TraceContext,
  severity: Severity,
  name: string,
  attributes?: Attributes,
): PlatformEvent {
  return {
    traceId: context.traceId,
    spanId: newSpanId(),
    parentSpanId: context.spanId,
    name,
    startTime: new Date().toISOString(),
    status: severity === 'error' ? 'error' : 'unset',
    severity,
    ...(attributes ? { attributes } : {}),
  };
}
