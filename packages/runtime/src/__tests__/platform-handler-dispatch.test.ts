/**
 * ADR-076: platform handlers dispatch by exported function name from a
 * static library (PLATFORM_HANDLER_LIBRARY), not a registry class.
 *
 * Each standard handler already has its own __tests__ file that calls the
 * exported function directly. Those are unit tests of handler *behavior*.
 * These are integration tests of *dispatch*: they prove that a DSL-declared
 * `handler: 'platform.<exportName>'` hook, resolved through BaseMFE's real
 * invokeHandler/invokePlatformHandler — and, for the before/error-phase
 * cases, the full public capability call (mfe.load()) — actually reaches
 * the real handler. Nothing here mocks or re-implements a handler.
 */

import { BaseMFE, type Context, type LoadResult, type RenderResult, type HealthResult, type DescribeResult, type SchemaResult, type QueryResult, type EmitResult } from '../base-mfe';
import type { DSLManifest } from '@seans-mfe/dsl';

class DispatchTestMFE extends BaseMFE {
  public forceLoadError?: Error;
  public lastLoadContext?: Context;

  protected async doLoad(context: Context): Promise<LoadResult> {
    this.lastLoadContext = context;
    if (this.forceLoadError) throw this.forceLoadError;
    return { status: 'loaded', timestamp: new Date() };
  }
  protected async doRender(): Promise<RenderResult> {
    return { status: 'rendered', timestamp: new Date() };
  }
  protected async doRefresh(): Promise<void> {}
  protected async doAuthorizeAccess(): Promise<boolean> { return true; }
  protected async doHealth(): Promise<HealthResult> {
    return { status: 'healthy', checks: [], timestamp: new Date() };
  }
  protected async doDescribe(): Promise<DescribeResult> {
    return { name: this.manifest.name, version: this.manifest.version, type: this.manifest.type, capabilities: [], manifest: this.manifest };
  }
  protected async doSchema(): Promise<SchemaResult> {
    return { schema: 'type Query { test: String }', format: 'graphql' };
  }
  protected async doQuery(): Promise<QueryResult> { return { data: null }; }
  protected async doEmit(): Promise<EmitResult> { return { emitted: true, eventId: 'e1' }; }

  /** Exposes the protected dispatch method this suite is actually testing. */
  public testInvokeHandler(handlerName: string, context: Context): Promise<void> {
    return this.invokeHandler(handlerName, context);
  }
}

function bareManifest(): DSLManifest {
  return { name: 'dispatch-test-mfe', version: '1.0.0', type: 'remote', language: 'typescript', capabilities: [] };
}

/** A manifest whose `load` capability runs one platform handler in the given phase. */
function loadManifestWithHook(phase: 'before' | 'after' | 'error', handlerName: string): DSLManifest {
  return {
    ...bareManifest(),
    capabilities: [{ load: { type: 'platform', lifecycle: { [phase]: [{ hook: { handler: handlerName } }] } } }],
  };
}

function context(overrides?: Partial<Context>): Context {
  return { requestId: 'req-1', timestamp: new Date(), ...overrides };
}

describe('Platform handler dispatch (ADR-076)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.JWT_SECRET;
  });

  describe('platform.validateJWT', () => {
    it('resolves by export name via invokeHandler and sets context.user', async () => {
      const mfe = new DispatchTestMFE(bareManifest());
      const decoded = { sub: '1', username: 'ada', roles: ['admin'] };
      process.env.JWT_SECRET = 'testsecret';
      jest.spyOn(require('jsonwebtoken'), 'verify').mockReturnValue(decoded);

      const ctx = context({ jwt: 'good-token' });
      await mfe.testInvokeHandler('platform.validateJWT', ctx);

      expect(ctx.user).toEqual(decoded);
    });

    it('runs as a real before-phase hook through mfe.load() end to end', async () => {
      const decoded = { sub: '1', username: 'ada', roles: ['admin'] };
      process.env.JWT_SECRET = 'testsecret';
      jest.spyOn(require('jsonwebtoken'), 'verify').mockReturnValue(decoded);

      const mfe = new DispatchTestMFE(loadManifestWithHook('before', 'platform.validateJWT'));
      const result = await mfe.load(context({ jwt: 'good-token' }));

      expect(result.status).toBe('loaded');
      // Proves the mutation made by the before-phase handler flowed through
      // the same context object into doLoad — not just that dispatch ran.
      expect(mfe.lastLoadContext?.user).toEqual(decoded);
    });
  });

  describe('platform.validateInputs / platform.sanitizeInputs', () => {
    it('validateInputs throws through dispatch when inputs are missing', async () => {
      const mfe = new DispatchTestMFE(bareManifest());
      await expect(mfe.testInvokeHandler('platform.validateInputs', context())).rejects.toThrow('Inputs required');
    });

    it('sanitizeInputs strips angle brackets from string inputs through dispatch', async () => {
      const mfe = new DispatchTestMFE(bareManifest());
      const ctx = context({ inputs: { name: '<script>evil</script>' } });
      await mfe.testInvokeHandler('platform.sanitizeInputs', ctx);
      expect(ctx.inputs?.name).toBe('scriptevil/script');
    });
  });

  describe('platform.logTelemetry', () => {
    it('emits a telemetry.log event through dispatch', async () => {
      const emitMock = jest.fn();
      const mfe = new DispatchTestMFE(bareManifest());
      await mfe.testInvokeHandler('platform.logTelemetry', context({ emit: emitMock }));
      expect(emitMock).toHaveBeenCalledWith(expect.objectContaining({ name: 'telemetry.log', status: 'success' }));
    });
  });

  describe('platform.cacheResult', () => {
    it('emits a caching.result.cache event through dispatch', async () => {
      const emitMock = jest.fn();
      const mfe = new DispatchTestMFE(bareManifest());
      await mfe.testInvokeHandler('platform.cacheResult', context({ emit: emitMock }));
      expect(emitMock).toHaveBeenCalledWith(expect.objectContaining({ name: 'caching.result.cache', status: 'success' }));
    });
  });

  describe('platform.rateLimitCheck', () => {
    it('emits a rate-limiting.check event through dispatch', async () => {
      const emitMock = jest.fn();
      const mfe = new DispatchTestMFE(bareManifest());
      await mfe.testInvokeHandler('platform.rateLimitCheck', context({ emit: emitMock }));
      expect(emitMock).toHaveBeenCalledWith(expect.objectContaining({ name: 'rate-limiting.check', status: 'success' }));
    });
  });

  describe('platform.handleError', () => {
    it('receives context.error (not an explicit second argument) via invokeHandler', async () => {
      const emitMock = jest.fn();
      const mfe = new DispatchTestMFE(bareManifest());
      const err = new Error('direct-dispatch-boom');
      await mfe.testInvokeHandler('platform.handleError', context({ emit: emitMock, error: err }));
      expect(emitMock).toHaveBeenCalledWith(expect.objectContaining({
        name: 'error.handling.handle',
        metadata: expect.objectContaining({ error: 'direct-dispatch-boom' }),
      }));
    });

    it('runs as a real error-phase hook through mfe.load() when doLoad throws', async () => {
      const emitMock = jest.fn();
      const mfe = new DispatchTestMFE(loadManifestWithHook('error', 'platform.handleError'));
      mfe.forceLoadError = new Error('load-boom');

      // ADR-002: main-phase failures still propagate to the caller even
      // though the error-phase hook ran and handled it.
      await expect(mfe.load(context({ emit: emitMock }))).rejects.toThrow('load-boom');

      expect(emitMock).toHaveBeenCalledWith(expect.objectContaining({
        name: 'error.handling.handle',
        metadata: expect.objectContaining({ error: 'load-boom' }),
      }));
    });
  });

  describe('platform.checkPermissions (known boundary — ADR-076 Boundaries)', () => {
    it('cannot be safely dispatched by name: dispatch supplies only `context`, but checkPermissions requires requiredRoles', async () => {
      const mfe = new DispatchTestMFE(bareManifest());
      const ctx = context({ user: { sub: '1', username: 'ada', roles: ['admin'] } as Context['user'] });
      // This is the documented gap, not a desired outcome: fixing it means
      // building a way for a manifest hook to pass per-invocation config
      // into a handler call, which ADR-076 explicitly does not add.
      await expect(mfe.testInvokeHandler('platform.checkPermissions', ctx)).rejects.toThrow();
    });
  });
});
