/**
 * The platform event emitter (ADR-081, closing #322).
 *
 * ADR-039 asked for a structured logger in this package. What it gets is an
 * emitter for the platform-wide `PlatformEvent` schema, and one property does
 * most of the work: it writes to **stderr directly**, never through `console`.
 *
 * That matters because the `--json` stdout contract (ADR-018) is currently held
 * by `redirectStdoutToStderr()` monkey-patching `console.log`. An emitter that
 * went through `console` would be correct only while that patch is installed.
 * Writing to stderr itself is correct unconditionally, which is what these
 * tests pin.
 */
import { createLogger, type Logger } from '../logger';
import { traceContextFromEnv, type PlatformEvent } from '@falese/smt-contracts';

/** Capture process.stderr.write without touching console. */
function captureStderr(): { lines: () => string[]; restore: () => void } {
  const original = process.stderr.write.bind(process.stderr);
  const chunks: string[] = [];
  (process.stderr as NodeJS.WriteStream).write = ((chunk: string | Uint8Array): boolean => {
    chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
    return true;
  }) as typeof process.stderr.write;
  return {
    lines: () => chunks.join('').split('\n').filter(Boolean),
    restore: () => {
      (process.stderr as NodeJS.WriteStream).write = original;
    },
  };
}

function parsed(lines: string[]): PlatformEvent[] {
  return lines.map((l) => JSON.parse(l) as PlatformEvent);
}

describe('createLogger', () => {
  let stderr: ReturnType<typeof captureStderr>;
  let logger: Logger;

  beforeEach(() => {
    stderr = captureStderr();
    logger = createLogger({ context: traceContextFromEnv({}), level: 'debug' });
  });

  afterEach(() => stderr.restore());

  it('writes one JSON line per event to stderr', () => {
    logger.info('generated 3 files');
    logger.warn('template missing');

    const events = parsed(stderr.lines());
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual(
      expect.objectContaining({ name: 'generated 3 files', severity: 'info' }),
    );
    expect(events[1].severity).toBe('warn');
  });

  it('emits nothing on stdout', () => {
    const stdoutSpy = jest.spyOn(process.stdout, 'write').mockReturnValue(true);
    logger.error('boom');
    expect(stdoutSpy).not.toHaveBeenCalled();
    stdoutSpy.mockRestore();
  });

  it('does not route through console, so it is correct with or without the --json patch', () => {
    const consoleSpies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      jest.spyOn(console, m).mockImplementation(() => undefined),
    );
    logger.info('hello');
    logger.error('bad');
    for (const spy of consoleSpies) expect(spy).not.toHaveBeenCalled();
    for (const spy of consoleSpies) spy.mockRestore();
  });

  it('puts every event on the same trace', () => {
    logger.debug('a');
    logger.info('b');
    logger.error('c');

    const traces = new Set(parsed(stderr.lines()).map((e) => e.traceId));
    expect(traces.size).toBe(1);
  });

  it('carries attributes through', () => {
    logger.warn('missing template', { 'codegen.template': 'App.tsx.ejs' });
    expect(parsed(stderr.lines())[0].attributes).toEqual({
      'codegen.template': 'App.tsx.ejs',
    });
  });

  it('merges the logger-wide attributes into every event', () => {
    stderr.restore();
    stderr = captureStderr();
    const scoped = createLogger({
      context: traceContextFromEnv({}),
      level: 'debug',
      attributes: { 'service.name': 'seans-mfe-tool' },
    });

    scoped.info('one', { 'cli.command': 'bff:build' });

    expect(parsed(stderr.lines())[0].attributes).toEqual({
      'service.name': 'seans-mfe-tool',
      'cli.command': 'bff:build',
    });
  });

  it('emits valid JSON even when a message contains newlines and quotes', () => {
    logger.error('line one\nline "two"');
    const lines = stderr.lines();
    expect(lines).toHaveLength(1); // one record, not two
    expect(JSON.parse(lines[0]).name).toBe('line one\nline "two"');
  });

  describe('level filtering', () => {
    it('drops events below the configured level', () => {
      stderr.restore();
      stderr = captureStderr();
      const quiet = createLogger({ context: traceContextFromEnv({}), level: 'warn' });

      quiet.debug('no');
      quiet.info('no');
      quiet.warn('yes');
      quiet.error('yes');

      expect(parsed(stderr.lines()).map((e) => e.severity)).toEqual(['warn', 'error']);
    });

    it('silences everything at level "silent"', () => {
      stderr.restore();
      stderr = captureStderr();
      const silent = createLogger({ context: traceContextFromEnv({}), level: 'silent' });

      silent.error('not even this');

      expect(stderr.lines()).toEqual([]);
    });

    it('defaults to info, so debug is off unless asked for', () => {
      stderr.restore();
      stderr = captureStderr();
      const dflt = createLogger({ context: traceContextFromEnv({}) });

      dflt.debug('hidden');
      dflt.info('shown');

      expect(parsed(stderr.lines()).map((e) => e.severity)).toEqual(['info']);
    });
  });

  describe('spans', () => {
    it('emits a completed span with a duration when the work succeeds', async () => {
      const result = await logger.span('codegen.render', async () => 'done');

      expect(result).toBe('done');
      const [event] = parsed(stderr.lines());
      expect(event.name).toBe('codegen.render');
      expect(event.status).toBe('ok');
      expect(typeof event.duration).toBe('number');
    });

    it('emits an error span and rethrows when the work throws', async () => {
      await expect(
        logger.span('codegen.render', async () => {
          throw new TypeError('bad template');
        }),
      ).rejects.toThrow('bad template');

      const [event] = parsed(stderr.lines());
      expect(event.status).toBe('error');
      expect(event.statusMessage).toBe('bad template');
      expect(event.attributes).toEqual(
        expect.objectContaining({ 'error.type': 'TypeError' }),
      );
    });

    it('nests events emitted inside the span under it', async () => {
      await logger.span('outer', async (child) => {
        child.info('inner');
      });

      const events = parsed(stderr.lines());
      const inner = events.find((e) => e.name === 'inner')!;
      const outer = events.find((e) => e.name === 'outer')!;
      expect(inner.traceId).toBe(outer.traceId);
      expect(inner.parentSpanId).toBe(outer.spanId);
    });
  });

  describe('propagation', () => {
    it('exposes a traceparent for handing to a child process', () => {
      const context = traceContextFromEnv({
        TRACEPARENT: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      });
      const child = createLogger({ context });

      expect(child.traceparent()).toMatch(
        /^00-4bf92f3577b34da6a3ce929d0e0e4736-[0-9a-f]{16}-01$/,
      );
    });

    it('exposes its trace id for the command envelope', () => {
      const context = traceContextFromEnv({});
      expect(createLogger({ context }).traceId()).toBe(context.traceId);
    });
  });
});
