/**
 * AngularRemoteMFE Tests
 *
 * Mirrors remote-mfe.test.ts coverage for the Angular sibling class:
 * - REQ-RUNTIME-001: Load capability (atomic entry/mount/enable-render)
 * - REQ-RUNTIME-004: Render capability (component awareness)
 * - REQ-RUNTIME-012: Telemetry emission with identical event names to RemoteMFE
 * - Control plane state update via daemon WebSocket
 */

import { AngularRemoteMFE } from '../angular-remote-mfe';
import {
  TelemetryCapture,
  ContextBuilder,
  MockDaemonWebSocketClient,
} from './test-harness';
import type { DSLManifest } from '../../dsl/schema';
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
 * Concrete test subclass that overrides loadDomainComponent to return mock
 * components synchronously, parallel to how the test harness wires RemoteMFE.
 */
class TestAngularRemoteMFE extends AngularRemoteMFE {
  constructor(
    manifest: DSLManifest,
    deps: any,
    private components: Record<string, any>
  ) {
    super(manifest, deps);
    // Bypass the fetchContainer mock-by-default; we'll let it run and inject
    // available components below.
    (this as any).fetchContainer = async () => ({
      init: async () => undefined,
      get: async () => () => ({ default: class {} }),
    });
    (this as any).extractAvailableComponents = () => Object.keys(this.components);
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
    ],
    ...overrides,
  } as DSLManifest;
}

function makeContext(inputs: Record<string, unknown> = {}): Context {
  return new ContextBuilder().withInputs(inputs).build();
}

describe('AngularRemoteMFE', () => {
  let telemetry: TelemetryCapture;

  beforeEach(() => {
    telemetry = new TelemetryCapture();
    jest.clearAllMocks();
    // jsdom provides document in the default jest env, but be defensive.
    if (typeof document !== 'undefined') {
      document.body.innerHTML = '';
    }
  });

  describe('Load Capability', () => {
    it('completes atomic load with all three phases', async () => {
      const mfe = new TestAngularRemoteMFE(buildManifest(), { telemetry }, {
        Greeter: class {},
      });

      const result = await (mfe as any).doLoad(makeContext());

      expect(result.status).toBe('loaded');
      expect(result.container).toBeDefined();
      expect(result.availableComponents).toEqual(['Greeter']);
      expect((result.telemetry as any).entry).toBeDefined();
      expect((result.telemetry as any).mount).toBeDefined();
      expect((result.telemetry as any).enableRender).toBeDefined();
    });

    it('emits the same telemetry checkpoint names as RemoteMFE', async () => {
      const mfe = new TestAngularRemoteMFE(buildManifest(), { telemetry }, {
        Greeter: class {},
      });
      await (mfe as any).doLoad(makeContext());

      const names = telemetry.getEvents().map((e) => e.name);
      // Parity guarantee with RemoteMFE — platform consumers filter on these.
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

    it('returns status=error and emits load-error when remoteEntry missing', async () => {
      const manifest = buildManifest();
      delete (manifest as any).remoteEntry;
      const mfe = new TestAngularRemoteMFE(manifest, { telemetry }, { Greeter: class {} });

      const result = await (mfe as any).doLoad(makeContext());

      expect(result.status).toBe('error');
      expect((result.error as Error).message).toMatch(/Remote entry URL/);
      const names = telemetry.getEvents().map((e) => e.name);
      expect(names).toContain('load-error');
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

    it('throws when component is not in availableComponents', async () => {
      const mfe = new TestAngularRemoteMFE(buildManifest(), { telemetry }, { Greeter: class {} });
      await (mfe as any).doLoad(makeContext());

      const result = await (mfe as any).doRender(
        makeContext({ component: 'Unknown', containerId: 'host' })
      );

      expect(result.status).toBe('error');
      expect((result.error as Error).message).toMatch(/not found in availableComponents/);
    });

    it('bootstraps the Angular standalone component and applies props as inputs', async () => {
      class GreeterComponent {}
      // Attach ɵcmp metadata so selector resolution finds a tag.
      (GreeterComponent as any).ɵcmp = { selectors: [['app-greeter']] };

      // jsdom global document needed
      if (typeof document === 'undefined') return;
      const host = document.createElement('div');
      host.id = 'host';
      document.body.appendChild(host);

      const mfe = new TestAngularRemoteMFE(buildManifest(), { telemetry }, {
        Greeter: GreeterComponent,
      });
      await (mfe as any).doLoad(makeContext());

      const result = await (mfe as any).doRender(
        makeContext({ component: 'Greeter', containerId: 'host', props: { title: 'hi' } })
      );

      expect(result.status).toBe('rendered');
      expect(host.innerHTML).toContain('<app-greeter>');

      // bootstrapApplication mock was called with the component
      const { bootstrapApplication } = await import('@angular/platform-browser');
      expect(bootstrapApplication).toHaveBeenCalledWith(GreeterComponent, expect.any(Object));

      // Telemetry parity with RemoteMFE
      const names = telemetry.getEvents().map((e) => e.name);
      expect(names).toEqual(
        expect.arrayContaining(['render-start', 'render-component-fetch', 'render-mount', 'render-completed'])
      );
    });

    it('unmount() destroys the prior ApplicationRef', async () => {
      class GreeterComponent {}
      (GreeterComponent as any).ɵcmp = { selectors: [['app-greeter']] };

      if (typeof document === 'undefined') return;
      const host = document.createElement('div');
      host.id = 'host';
      document.body.appendChild(host);

      const mfe = new TestAngularRemoteMFE(buildManifest(), { telemetry }, {
        Greeter: GreeterComponent,
      });
      await (mfe as any).doLoad(makeContext());
      await (mfe as any).doRender(
        makeContext({ component: 'Greeter', containerId: 'host' })
      );

      const appRefs: Map<string, any> = (mfe as any).applicationRefs;
      const appRef = appRefs.get('host');
      expect(appRef).toBeDefined();

      mfe.unmount('host');

      expect(appRef.destroy).toHaveBeenCalledTimes(1);
      expect(appRefs.has('host')).toBe(false);
    });
  });

  describe('Shared dependencies', () => {
    it('returns Angular singletons with strictVersion: true', () => {
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
      // React deps must NOT appear in an Angular MFE's shared scope
      expect(shared['react']).toBeUndefined();
      expect(shared['react-dom']).toBeUndefined();
    });
  });

  describe('Control plane state', () => {
    it('sends a sendMessage mutation over the daemon WebSocket and returns ack=true', async () => {
      const wsClient = new MockDaemonWebSocketClient();
      const mfe = new TestAngularRemoteMFE(buildManifest(), { telemetry, wsClient }, {});
      const result = await (mfe as any).doUpdateControlPlaneState(
        makeContext({ stateKey: 'analysis.complete', stateData: { score: 42 } })
      );

      expect(result.acknowledged).toBe(true);
      const call = wsClient.assertCalledOnce();
      expect(call.query).toMatch(/sendMessage/);
      const envelope = JSON.parse(String(call.variables.m));
      expect(envelope.payload.actionType).toBe('analysis.complete');
      expect(envelope.payload.data).toEqual({ score: 42 });
    });

    it('returns ack=false when daemon WebSocket is not connected', async () => {
      const wsClient = new MockDaemonWebSocketClient();
      wsClient.connected = false;
      const mfe = new TestAngularRemoteMFE(buildManifest(), { telemetry, wsClient }, {});
      const result = await (mfe as any).doUpdateControlPlaneState(
        makeContext({ stateKey: 'foo' })
      );

      expect(result.acknowledged).toBe(false);
      expect(result.error).toMatch(/not connected/);
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

    it('doQuery throws (not supported on remote MFE)', async () => {
      const mfe = new TestAngularRemoteMFE(buildManifest(), { telemetry }, {});
      await expect((mfe as any).doQuery(makeContext())).rejects.toThrow(/not supported/);
    });
  });
});
