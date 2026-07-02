/**
 * AngularRemoteMFE Tests
 *
 * Mirrors remote-mfe.test.ts coverage for the Angular sibling class:
 * - REQ-RUNTIME-001: Load capability (atomic entry/mount/enable-render)
 * - REQ-RUNTIME-004: Render capability (component awareness)
 * - REQ-RUNTIME-012: Telemetry emission with identical event names to RemoteMFE
 * - Control plane state update via daemon WebSocket
 *
 * The suite runs under testEnvironment: 'node' (no DOM), so a minimal
 * `document` stub is installed for the mount/render/unmount paths.
 */

import { AngularRemoteMFE } from '../angular-remote-mfe';
import {
  TelemetryCapture,
  ContextBuilder,
  MockDaemonWebSocketClient,
} from './test-harness';
import type { DSLManifest } from '@seans-mfe/dsl';
import type { Context } from '../base-mfe';

/**
 * Mock @angular/platform-browser.bootstrapApplication.
 * Returns a fake ApplicationRef that tracks destroy()/tick() calls and exposes
 * a single component whose instance we can mutate for @Input() assignment tests.
 */
jest.mock(
  '@angular/platform-browser',
  () => {
    return {
      __esModule: true,
      bootstrapApplication: jest.fn(async (Component: any) => {
        const instance: Record<string, unknown> = {};
        const appRef = {
          components: [{ instance, componentType: Component }],
          destroy: jest.fn(),
          tick: jest.fn(),
        };
        return appRef;
      }),
    };
  },
  { virtual: true }
);

/**
 * Concrete test subclass that overrides ONLY loadDomainComponent so the real
 * fetchContainer / extractAvailableComponents / extractCapabilities run and
 * are covered. Returns mock components for the named domain capabilities.
 */
class TestAngularRemoteMFE extends AngularRemoteMFE {
  constructor(
    manifest: DSLManifest,
    deps: any,
    private components: Record<string, any>
  ) {
    super(manifest, deps);
  }

  protected async loadDomainComponent(name: string): Promise<any> {
    if (!this.components[name]) {
      throw new Error(`Test component "${name}" not registered`);
    }
    return this.components[name];
  }
}

function buildManifest(overrides: Partial<DSLManifest> = {}): DSLManifest {
  return {
    name: 'test-angular-remote',
    version: '1.0.0',
    type: 'remote',
    language: 'typescript',
    framework: 'angular',
    bundler: 'webpack',
    remoteEntry: 'http://localhost:3101/remoteEntry.js',
    capabilities: [
      { load: { type: 'platform' } },
      { render: { type: 'platform' } },
      // Domain capability so the real extractAvailableComponents returns it.
      { Greeter: { type: 'domain', description: 'Greets the user' } },
    ],
    ...overrides,
  } as DSLManifest;
}

function makeContext(inputs: Record<string, unknown> = {}): Context {
  return new ContextBuilder().withInputs(inputs).build();
}

/** Minimal DOM element stub with a settable innerHTML. */
function installDocumentStub(): { id: string; innerHTML: string } {
  const el = { id: 'host', innerHTML: '' };
  (global as any).document = {
    getElementById: (id: string) => (id === 'host' ? el : null),
  };
  return el;
}

function removeDocumentStub(): void {
  delete (global as any).document;
}

describe('AngularRemoteMFE', () => {
  let telemetry: TelemetryCapture;

  beforeEach(() => {
    telemetry = new TelemetryCapture();
    jest.clearAllMocks();
  });

  afterEach(() => {
    removeDocumentStub();
  });

  describe('Load Capability', () => {
    it('completes atomic load with all three phases (real fetchContainer + helpers)', async () => {
      const mfe = new TestAngularRemoteMFE(buildManifest(), { telemetry }, { Greeter: class {} });

      const result = await (mfe as any).doLoad(makeContext());

      expect(result.status).toBe('loaded');
      expect(result.container).toBeDefined();
      // Real extractAvailableComponents picks up the domain capability.
      expect(result.availableComponents).toEqual(['Greeter']);
      expect(result.capabilities).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'load', type: 'platform' }),
        expect.objectContaining({ name: 'render', type: 'platform' }),
        expect.objectContaining({ name: 'Greeter', type: 'domain' }),
      ]));
      expect((result.telemetry as any).entry).toBeDefined();
      expect((result.telemetry as any).mount).toBeDefined();
      expect((result.telemetry as any).enableRender).toBeDefined();
    });

    it('emits the same telemetry checkpoint names as RemoteMFE', async () => {
      const mfe = new TestAngularRemoteMFE(buildManifest(), { telemetry }, { Greeter: class {} });
      await (mfe as any).doLoad(makeContext());

      const names = telemetry.getEvents().map((e) => e.name);
      expect(names).toEqual(
        expect.arrayContaining([
          'load-entry',
          'load-entry-metric',
          'load-mount',
          'load-mount-metric',
          'load-enable-render',
          'load-enable-render-metric',
          'load-completed',
        ])
      );
    });

    it('reads remoteEntry from context.inputs when provided', async () => {
      const manifest = buildManifest();
      delete (manifest as any).remoteEntry;
      const mfe = new TestAngularRemoteMFE(manifest, { telemetry }, { Greeter: class {} });

      const result = await (mfe as any).doLoad(
        makeContext({ remoteEntry: 'http://localhost:9999/remoteEntry.js' })
      );
      expect(result.status).toBe('loaded');
    });

    it('returns status=error and emits load-error when remoteEntry missing', async () => {
      const manifest = buildManifest();
      delete (manifest as any).remoteEntry;
      const mfe = new TestAngularRemoteMFE(manifest, { telemetry }, { Greeter: class {} });

      const result = await (mfe as any).doLoad(makeContext());

      expect(result.status).toBe('error');
      expect((result.error as Error).message).toMatch(/Remote entry URL/);
      expect(telemetry.getEvents().map((e) => e.name)).toContain('load-error');
    });

    it('works without a telemetry sink (deps.telemetry undefined)', async () => {
      const mfe = new TestAngularRemoteMFE(buildManifest(), {}, { Greeter: class {} });
      const result = await (mfe as any).doLoad(makeContext());
      expect(result.status).toBe('loaded');
    });
  });

  describe('Render Capability', () => {
    it('throws when component name missing from inputs', async () => {
      const mfe = new TestAngularRemoteMFE(buildManifest(), { telemetry }, { Greeter: class {} });
      await (mfe as any).doLoad(makeContext());

      const result = await (mfe as any).doRender(makeContext({ containerId: 'host' }));
      expect(result.status).toBe('error');
      expect((result.error as Error).message).toMatch(/Component name not provided/);
    });

    it('throws when containerId missing from inputs', async () => {
      const mfe = new TestAngularRemoteMFE(buildManifest(), { telemetry }, { Greeter: class {} });
      await (mfe as any).doLoad(makeContext());

      const result = await (mfe as any).doRender(makeContext({ component: 'Greeter' }));
      expect(result.status).toBe('error');
      expect((result.error as Error).message).toMatch(/Container ID not provided/);
    });

    it('throws when component is not in availableComponents', async () => {
      const mfe = new TestAngularRemoteMFE(buildManifest(), { telemetry }, { Greeter: class {} });
      await (mfe as any).doLoad(makeContext());

      const result = await (mfe as any).doRender(
        makeContext({ component: 'Unknown', containerId: 'host' })
      );
      expect(result.status).toBe('error');
      expect((result.error as Error).message).toMatch(/not found in availableComponents/);
    });

    it('throws when render called before load (no container)', async () => {
      const mfe = new TestAngularRemoteMFE(buildManifest(), { telemetry }, { Greeter: class {} });
      // Force availableComponents without a container by stubbing.
      (mfe as any).availableComponents = ['Greeter'];
      const result = await (mfe as any).doRender(
        makeContext({ component: 'Greeter', containerId: 'host' })
      );
      expect(result.status).toBe('error');
      expect((result.error as Error).message).toMatch(/Container not loaded/);
    });

    it('bootstraps the component, sets the selector host, and applies props as inputs', async () => {
      class GreeterComponent {}
      (GreeterComponent as any).ɵcmp = { selectors: [['app-greeter']] };

      const el = installDocumentStub();
      const mfe = new TestAngularRemoteMFE(buildManifest(), { telemetry }, {
        Greeter: GreeterComponent,
      });
      await (mfe as any).doLoad(makeContext());

      const result = await (mfe as any).doRender(
        makeContext({ component: 'Greeter', containerId: 'host', props: { title: 'hi' } })
      );

      expect(result.status).toBe('rendered');
      expect(el.innerHTML).toBe('<app-greeter></app-greeter>');

      const { bootstrapApplication } = await import('@angular/platform-browser');
      expect(bootstrapApplication).toHaveBeenCalledWith(GreeterComponent, expect.any(Object));

      // appRef instance got the prop applied
      const appRef = (mfe as any).applicationRefs.get('host');
      expect(appRef.components[0].instance.title).toBe('hi');
      expect(appRef.tick).toHaveBeenCalled();

      const names = telemetry.getEvents().map((e) => e.name);
      expect(names).toEqual(
        expect.arrayContaining([
          'render-start',
          'render-component-fetch',
          'render-mount',
          'render-completed',
        ])
      );
    });

    it('falls back to app-mfe-root selector when component has no ɵcmp', async () => {
      const el = installDocumentStub();
      const mfe = new TestAngularRemoteMFE(buildManifest(), { telemetry }, {
        Greeter: class {},
      });
      await (mfe as any).doLoad(makeContext());

      await (mfe as any).doRender(makeContext({ component: 'Greeter', containerId: 'host' }));
      expect(el.innerHTML).toBe('<app-mfe-root></app-mfe-root>');
    });

    it('destroys the prior ApplicationRef when re-rendering the same container', async () => {
      const el = installDocumentStub();
      const mfe = new TestAngularRemoteMFE(buildManifest(), { telemetry }, {
        Greeter: class {},
      });
      await (mfe as any).doLoad(makeContext());

      await (mfe as any).doRender(makeContext({ component: 'Greeter', containerId: 'host' }));
      const firstRef = (mfe as any).applicationRefs.get('host');

      await (mfe as any).doRender(makeContext({ component: 'Greeter', containerId: 'host' }));
      expect(firstRef.destroy).toHaveBeenCalledTimes(1);
      void el;
    });

    it('errors when the DOM container is not found', async () => {
      installDocumentStub();
      const mfe = new TestAngularRemoteMFE(buildManifest(), { telemetry }, {
        Greeter: class {},
      });
      await (mfe as any).doLoad(makeContext());

      const result = await (mfe as any).doRender(
        makeContext({ component: 'Greeter', containerId: 'missing' })
      );
      expect(result.status).toBe('error');
      expect((result.error as Error).message).toMatch(/DOM container #missing not found/);
    });

    it('errors when mountComponent runs outside a browser (no document)', async () => {
      removeDocumentStub();
      const mfe = new TestAngularRemoteMFE(buildManifest(), { telemetry }, {
        Greeter: class {},
      });
      await (mfe as any).doLoad(makeContext());

      const result = await (mfe as any).doRender(
        makeContext({ component: 'Greeter', containerId: 'host' })
      );
      expect(result.status).toBe('error');
      expect((result.error as Error).message).toMatch(/outside a browser environment/);
    });
  });

  describe('unmount', () => {
    it('destroys and removes the ApplicationRef for a container', async () => {
      installDocumentStub();
      const mfe = new TestAngularRemoteMFE(buildManifest(), { telemetry }, {
        Greeter: class {},
      });
      await (mfe as any).doLoad(makeContext());
      await (mfe as any).doRender(makeContext({ component: 'Greeter', containerId: 'host' }));

      const appRef = (mfe as any).applicationRefs.get('host');
      mfe.unmount('host');
      expect(appRef.destroy).toHaveBeenCalledTimes(1);
      expect((mfe as any).applicationRefs.has('host')).toBe(false);
    });

    it('is a no-op for an unknown container', () => {
      const mfe = new TestAngularRemoteMFE(buildManifest(), { telemetry }, {});
      expect(() => mfe.unmount('nope')).not.toThrow();
    });
  });

  describe('loadDomainComponent default', () => {
    it('throws when not overridden', async () => {
      const mfe = new AngularRemoteMFE(buildManifest(), { telemetry });
      await expect((mfe as any).loadDomainComponent('Greeter')).rejects.toThrow(
        /not implemented/
      );
    });
  });

  describe('Shared dependencies', () => {
    it('returns Angular singletons with strictVersion and eager zone.js', () => {
      const mfe = new TestAngularRemoteMFE(buildManifest(), { telemetry }, {});
      const shared = (mfe as any).getSharedDependencies();

      expect(shared['@angular/core']).toEqual(
        expect.objectContaining({ singleton: true, strictVersion: true })
      );
      expect(shared['@angular/common']).toEqual(
        expect.objectContaining({ singleton: true, strictVersion: true })
      );
      expect(shared['@angular/platform-browser']).toEqual(
        expect.objectContaining({ singleton: true, strictVersion: true })
      );
      expect(shared['zone.js']).toEqual(
        expect.objectContaining({ singleton: true, eager: true })
      );
      expect(shared['react']).toBeUndefined();
      expect(shared['react-dom']).toBeUndefined();
    });
  });

  describe('Control plane state', () => {
    it('sends a sendMessage mutation and returns ack=true', async () => {
      const wsClient = new MockDaemonWebSocketClient();
      const mfe = new TestAngularRemoteMFE(buildManifest(), { telemetry, wsClient }, {});
      const result = await (mfe as any).doUpdateControlPlaneState(
        makeContext({ stateKey: 'analysis.complete', stateData: { score: 42 } })
      );

      expect(result.acknowledged).toBe(true);
      const call = wsClient.assertCalledOnce();
      expect(call.query).toMatch(/sendMessage/);
      const envelope = JSON.parse(String(call.variables.m));
      // ADR-057: canonical STATE_UPDATE actionType; stateKey carries the value.
      expect(envelope.payload.actionType).toBe('STATE_UPDATE');
      expect(envelope.payload.stateKey).toBe('analysis.complete');
      expect(envelope.payload.data).toEqual({ score: 42 });
    });

    it('returns ack=false when daemon WebSocket is not connected', async () => {
      const wsClient = new MockDaemonWebSocketClient();
      wsClient.connected = false;
      const mfe = new TestAngularRemoteMFE(buildManifest(), { telemetry, wsClient }, {});
      const result = await (mfe as any).doUpdateControlPlaneState(makeContext({ stateKey: 'foo' }));
      expect(result.acknowledged).toBe(false);
      expect(result.error).toMatch(/not connected/);
    });

    it('returns ack=false when the mutation throws', async () => {
      const wsClient = new MockDaemonWebSocketClient();
      wsClient.mutationError = new Error('socket timed out');
      const mfe = new TestAngularRemoteMFE(buildManifest(), { telemetry, wsClient }, {});
      const result = await (mfe as any).doUpdateControlPlaneState(makeContext({ stateKey: 'foo' }));
      expect(result.acknowledged).toBe(false);
      expect(result.error).toMatch(/timed out/);
    });

    it('rejects a missing/empty stateKey', async () => {
      const wsClient = new MockDaemonWebSocketClient();
      const mfe = new TestAngularRemoteMFE(buildManifest(), { telemetry, wsClient }, {});
      await expect(
        (mfe as any).doUpdateControlPlaneState(makeContext({}))
      ).rejects.toThrow(/stateKey/);
    });
  });

  describe('Other capabilities', () => {
    it('doHealth reports container + components status', async () => {
      const mfe = new TestAngularRemoteMFE(buildManifest(), { telemetry }, { Greeter: class {} });
      await (mfe as any).doLoad(makeContext());

      const result = await (mfe as any).doHealth(makeContext());
      expect(result.status).toBe('healthy');
      expect(result.checks.find((c: any) => c.name === 'container').status).toBe('pass');
      expect(result.checks.find((c: any) => c.name === 'components').status).toBe('pass');
    });

    it('doDescribe returns manifest snapshot', async () => {
      const mfe = new TestAngularRemoteMFE(buildManifest(), { telemetry }, {});
      const result = await (mfe as any).doDescribe(makeContext());
      expect(result.name).toBe('test-angular-remote');
      expect(result.type).toBe('remote');
    });

    it('doSchema returns the manifest as JSON', async () => {
      const mfe = new TestAngularRemoteMFE(buildManifest(), { telemetry }, {});
      const result = await (mfe as any).doSchema(makeContext());
      expect(result.format).toBe('json');
      expect(JSON.parse(result.schema).name).toBe('test-angular-remote');
    });

    it('doQuery throws (not supported on remote MFE)', async () => {
      const mfe = new TestAngularRemoteMFE(buildManifest(), { telemetry }, {});
      await expect((mfe as any).doQuery(makeContext())).rejects.toThrow(/not supported/);
    });

    it('doEmit forwards an event to telemetry and reports emitted=true', async () => {
      const mfe = new TestAngularRemoteMFE(buildManifest(), { telemetry }, {});
      const result = await (mfe as any).doEmit(
        makeContext({ event: { name: 'x', capability: 'emit', status: 'success', timestamp: new Date() } })
      );
      expect(result.emitted).toBe(true);
    });

    it('doEmit reports emitted=false when no event provided', async () => {
      const mfe = new TestAngularRemoteMFE(buildManifest(), { telemetry }, {});
      const result = await (mfe as any).doEmit(makeContext({}));
      expect(result.emitted).toBe(false);
    });

    it('doRefresh and doAuthorizeAccess are safe no-ops', async () => {
      const mfe = new TestAngularRemoteMFE(buildManifest(), { telemetry }, {});
      await expect((mfe as any).doRefresh(makeContext())).resolves.toBeUndefined();
      await expect((mfe as any).doAuthorizeAccess(makeContext())).resolves.toBe(true);
    });
  });
});
