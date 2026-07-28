/**
 * observability — the platform event schema and its trace context (ADR-081).
 *
 * Two properties are load-bearing and both are pinned here:
 *
 *   1. The ids are W3C-shaped. A trace id that is not 32 lowercase hex
 *      characters, or a span id that is not 16, cannot round-trip through a
 *      `traceparent` header and so cannot leave this process.
 *   2. The module is browser-bundleable. The contracts barrel is consumed by
 *      browser shells, so — exactly as `envelope` had to learn — importing
 *      Node's `crypto` pulls a builtin rspack cannot resolve. The same applies
 *      to `@opentelemetry/*`, which ADR-081 keeps out of every package the
 *      browser loads.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  newTraceId,
  newSpanId,
  formatTraceparent,
  parseTraceparent,
  traceContextFromEnv,
  startSpan,
  endSpan,
  logEvent,
  type PlatformEvent,
} from '../observability';

const TRACE_ID = /^[0-9a-f]{32}$/;
const SPAN_ID = /^[0-9a-f]{16}$/;

describe('trace ids', () => {
  it('mints a 32-hex trace id', () => {
    expect(newTraceId()).toMatch(TRACE_ID);
  });

  it('mints a 16-hex span id', () => {
    expect(newSpanId()).toMatch(SPAN_ID);
  });

  it('does not repeat itself', () => {
    const ids = new Set(Array.from({ length: 64 }, () => newTraceId()));
    expect(ids.size).toBe(64);
  });

  it('never mints the all-zero id the spec reserves as invalid', () => {
    for (let i = 0; i < 32; i += 1) {
      expect(newTraceId()).not.toBe('0'.repeat(32));
      expect(newSpanId()).not.toBe('0'.repeat(16));
    }
  });
});

describe('traceparent', () => {
  const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
  const spanId = '00f067aa0ba902b7';

  it('formats the version, ids and sampled flag', () => {
    expect(formatTraceparent({ traceId, spanId, sampled: true })).toBe(
      `00-${traceId}-${spanId}-01`,
    );
  });

  it('formats an unsampled context with flags 00', () => {
    expect(formatTraceparent({ traceId, spanId, sampled: false })).toBe(
      `00-${traceId}-${spanId}-00`,
    );
  });

  it('treats a context with no explicit sampling decision as sampled', () => {
    expect(formatTraceparent({ traceId, spanId })).toMatch(/-01$/);
  });

  it('round-trips', () => {
    const header = formatTraceparent({ traceId, spanId, sampled: false });
    expect(parseTraceparent(header)).toEqual({ traceId, spanId, sampled: false });
  });

  it.each([
    ['empty', ''],
    ['not a header', 'nonsense'],
    ['wrong field count', '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7'],
    ['short trace id', '00-4bf92f35-00f067aa0ba902b7-01'],
    ['short span id', '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067-01'],
    ['non-hex', '00-zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz-00f067aa0ba902b7-01'],
    ['all-zero trace id', `00-${'0'.repeat(32)}-00f067aa0ba902b7-01`],
    ['all-zero span id', `00-4bf92f3577b34da6a3ce929d0e0e4736-${'0'.repeat(16)}-01`],
    ['unsupported version', 'ff-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'],
  ])('rejects a %s header', (_label, header) => {
    expect(parseTraceparent(header)).toBeUndefined();
  });

  it('accepts uppercase hex but normalises it, since ids are compared as strings', () => {
    const parsed = parseTraceparent(`00-${traceId.toUpperCase()}-${spanId.toUpperCase()}-01`);
    expect(parsed).toEqual({ traceId, spanId, sampled: true });
  });
});

describe('traceContextFromEnv', () => {
  it('adopts an inherited TRACEPARENT', () => {
    const ctx = traceContextFromEnv({
      TRACEPARENT: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
    });
    expect(ctx.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
    // The inherited span becomes the parent — we are a child of the caller.
    expect(ctx.parentSpanId).toBe('00f067aa0ba902b7');
    expect(ctx.spanId).toMatch(SPAN_ID);
    expect(ctx.spanId).not.toBe('00f067aa0ba902b7');
  });

  it('mints a fresh root context when the variable is absent', () => {
    const ctx = traceContextFromEnv({});
    expect(ctx.traceId).toMatch(TRACE_ID);
    expect(ctx.spanId).toMatch(SPAN_ID);
    expect(ctx.parentSpanId).toBeUndefined();
  });

  it('mints a fresh root context rather than propagating a malformed one', () => {
    const ctx = traceContextFromEnv({ TRACEPARENT: 'garbage' });
    expect(ctx.traceId).toMatch(TRACE_ID);
    expect(ctx.parentSpanId).toBeUndefined();
  });

  it('reads the lowercase spelling too, which some tools emit', () => {
    const ctx = traceContextFromEnv({
      traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
    });
    expect(ctx.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
  });
});

describe('span events', () => {
  it('starts a span carrying its context, name and attributes', () => {
    const ctx = traceContextFromEnv({});
    const span = startSpan(ctx, 'cli.command', { 'cli.command': 'mfe:validate' });

    expect(span.traceId).toBe(ctx.traceId);
    expect(span.spanId).toBe(ctx.spanId);
    expect(span.name).toBe('cli.command');
    expect(span.attributes).toEqual({ 'cli.command': 'mfe:validate' });
    expect(typeof span.startTime).toBe('string');
    // Not finished yet: no duration, status still unset.
    expect(span.duration).toBeUndefined();
    expect(span.status).toBe('unset');
  });

  it('ends a span with a duration and an ok status', () => {
    const span = startSpan(traceContextFromEnv({}), 'codegen.render');
    const done = endSpan(span, { status: 'ok' });

    expect(done.status).toBe('ok');
    expect(typeof done.duration).toBe('number');
    expect(done.duration).toBeGreaterThanOrEqual(0);
  });

  it('records the error type and message when a span fails', () => {
    const span = startSpan(traceContextFromEnv({}), 'codegen.render');
    const done = endSpan(span, { status: 'error', error: new TypeError('bad template') });

    expect(done.status).toBe('error');
    expect(done.statusMessage).toBe('bad template');
    expect(done.attributes).toEqual(
      expect.objectContaining({ 'error.type': 'TypeError' }),
    );
  });

  it('prefers a typed error\'s own type over its constructor name', () => {
    const typed = Object.assign(new Error('nope'), { type: 'validation' });
    const done = endSpan(startSpan(traceContextFromEnv({}), 'x'), {
      status: 'error',
      error: typed,
    });
    expect(done.attributes).toEqual(expect.objectContaining({ 'error.type': 'validation' }));
  });

  it('keeps attributes set at start when ending adds more', () => {
    const span = startSpan(traceContextFromEnv({}), 'x', { 'mfe.id': 'flappy' });
    const done = endSpan(span, { status: 'ok', attributes: { 'mfe.capability': 'load' } });
    expect(done.attributes).toEqual({ 'mfe.id': 'flappy', 'mfe.capability': 'load' });
  });
});

describe('log events', () => {
  it('produces a severity-tagged record with no duration', () => {
    const ctx = traceContextFromEnv({});
    const event = logEvent(ctx, 'warn', 'template missing', { 'codegen.template': 'App.tsx' });

    expect(event.severity).toBe('warn');
    expect(event.name).toBe('template missing');
    expect(event.traceId).toBe(ctx.traceId);
    expect(event.duration).toBeUndefined();
    expect(event.attributes).toEqual({ 'codegen.template': 'App.tsx' });
  });

  it('correlates a log event to the span it happened inside', () => {
    const ctx = traceContextFromEnv({});
    const event = logEvent(ctx, 'info', 'generated');
    expect(event.parentSpanId).toBe(ctx.spanId);
  });

  it('marks error-severity records with error status so consumers can filter on one field', () => {
    expect(logEvent(traceContextFromEnv({}), 'error', 'boom').status).toBe('error');
    expect(logEvent(traceContextFromEnv({}), 'info', 'fine').status).toBe('unset');
  });
});

describe('observability is browser-bundleable (ADR-081 §3)', () => {
  const src = readFileSync(join(__dirname, '..', 'observability.ts'), 'utf8');

  it('does not import the Node "crypto" module', () => {
    expect(src).not.toMatch(/from\s+['"]crypto['"]/);
    expect(src).not.toMatch(/require\(\s*['"]crypto['"]\s*\)/);
  });

  it('does not import any @opentelemetry package', () => {
    // Prose may name the SDK — ADR-081 is largely *about* it. Only a real
    // import would put it in the bundle.
    expect(src).not.toMatch(/from\s+['"]@opentelemetry\/[^'"]+['"]/);
    expect(src).not.toMatch(/require\(\s*['"]@opentelemetry\/[^'"]+['"]\s*\)/);
    expect(src).not.toMatch(/import\s*\(\s*['"]@opentelemetry\/[^'"]+['"]\s*\)/);
  });

  it('is a type-and-function module with no I/O of its own', () => {
    // Emitters do the writing; the schema must stay free of process/fs so it
    // can be imported by a browser bundle and by CI scripts alike.
    expect(src).not.toMatch(/process\.(stdout|stderr)/);
    expect(src).not.toMatch(/from\s+['"]fs['"]/);
  });
});

describe('PlatformEvent typing', () => {
  it('accepts the OTel primitive attribute set', () => {
    const event: PlatformEvent = {
      traceId: newTraceId(),
      spanId: newSpanId(),
      name: 'x',
      startTime: new Date().toISOString(),
      status: 'unset',
      attributes: {
        'service.name': 'seans-mfe-tool',
        'http.status_code': 200,
        'cli.dry_run': true,
        'mfe.slots': ['header', 'body'],
      },
    };
    expect(event.attributes?.['mfe.slots']).toEqual(['header', 'body']);
  });
});
