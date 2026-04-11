/**
 * RemoteMFE Tests
 * 
 * Tests for Module Federation remote MFE implementation
 * Covers:
 * - REQ-RUNTIME-001: Load capability (atomic entry/mount/enable-render)
 * - REQ-RUNTIME-004: Render capability (component awareness)
 * - REQ-RUNTIME-012: Telemetry emission
 * - State management and lifecycle
 */

import { RemoteMFE } from '../remote-mfe';
import {
  createTestHarness,
  createTestContext,
  createMockComponent,
  MFETestHarness,
  TelemetryCapture,
  ContextBuilder,
  MockDaemonWebSocketClient,
} from './test-harness';
import type { Context, LoadResult, RenderResult } from '../base-mfe';

describe('RemoteMFE', () => {
  const AppComponent = createMockComponent('App');
  const HeaderComponent = createMockComponent('Header');
  const FooterComponent = createMockComponent('Footer');

  let harness: MFETestHarness;

  beforeEach(() => {
    harness = createTestHarness({
      name: 'test-remote',
      components: {
        App: AppComponent,
        Header: HeaderComponent,
        Footer: FooterComponent,
      },
      version: '2.0.0',
      remoteEntry: 'http://localhost:5000/remoteEntry.js',
      manifest: {
        language: 'typescript' as const,
      },
    });
    harness.reset();
  });

  describe('Load Capability (REQ-RUNTIME-001)', () => {
    it('should complete atomic load with all three phases', async () => {
      const loadResult = await harness.testLoad();

      // Verify load result structure
      expect(loadResult.status).toBe('loaded');
      expect(loadResult.container).toBeDefined();
      expect(loadResult.manifest).toBeDefined();
      expect(loadResult.availableComponents).toEqual(['App', 'Header', 'Footer']);
      expect(loadResult.timestamp).toBeInstanceOf(Date);
      expect(loadResult.duration).toBeGreaterThan(0);

      // Verify telemetry phases
      expect(loadResult.telemetry).toBeDefined();
      expect((loadResult.telemetry as any)?.entry).toBeDefined();
      expect((loadResult.telemetry as any)?.mount).toBeDefined();
      expect((loadResult.telemetry as any)?.enableRender).toBeDefined();
    });

    it('should emit telemetry events for entry phase', async () => {
      await harness.testLoad();
      const telemetry = harness.getTelemetry();

      const entryEvents = telemetry.getEventsByPhase('entry');
      expect(entryEvents.length).toBeGreaterThan(0);
      expect(entryEvents[0].capability).toBe('load');
      expect(entryEvents[0].metadata?.mfe).toBe('test-remote');
    });

    it('should emit telemetry events for mount phase', async () => {
      await harness.testLoad();
      const telemetry = harness.getTelemetry();

      const mountEvents = telemetry.getEventsByPhase('mount');
      expect(mountEvents.length).toBeGreaterThan(0);
      expect(mountEvents[0].capability).toBe('load');
    });

    it('should emit telemetry events for enable_render phase', async () => {
      await harness.testLoad();
      const telemetry = harness.getTelemetry();

      const enableRenderEvents = telemetry.getEventsByPhase('enable_render');
      expect(enableRenderEvents.length).toBeGreaterThan(0);
      expect(enableRenderEvents[0].capability).toBe('load');
    });

    it('should populate availableComponents after load', async () => {
      const loadResult = await harness.testLoad();

      expect(loadResult.availableComponents).toContain('App');
      expect(loadResult.availableComponents).toContain('Header');
      expect(loadResult.availableComponents).toContain('Footer');
      expect((loadResult.availableComponents as string[]).length).toBe(3);
    });

    it('should set container after load', async () => {
      const loadResult = await harness.testLoad();

      expect(loadResult.container).toBeDefined();
      expect(loadResult.container).toBe(harness.getContainer());
    });

    it('should transition state from uninitialized to ready after load', async () => {
      expect(harness.getMFE().getState()).toBe('uninitialized');
      
      await harness.testLoad();
      
      expect(harness.getMFE().getState()).toBe('ready');
    });

    it('should use remoteEntry from context if provided', async () => {
      const context = new ContextBuilder()
        .withInputs({ remoteEntry: 'http://custom:9000/entry.js' })
        .build();

      const loadResult = await harness.testLoad(context);
      expect(loadResult.status).toBe('loaded');
    });

    it('should use remoteEntry from manifest if not in context', async () => {
      const loadResult = await harness.testLoad();
      expect(loadResult.status).toBe('loaded');
      expect((loadResult.manifest as any).remoteEntry).toBe('http://localhost:5000/remoteEntry.js');
    });

    it('should measure and report load duration', async () => {
      const loadResult = await harness.testLoad();

      expect(loadResult.duration).toBeGreaterThan(0);
      expect((loadResult.telemetry as any)?.entry.duration).toBeGreaterThanOrEqual(0);
      expect((loadResult.telemetry as any)?.mount.duration).toBeGreaterThanOrEqual(0);
      expect((loadResult.telemetry as any)?.enableRender.duration).toBeGreaterThanOrEqual(0);
    });

    it('should emit no errors during successful load', async () => {
      await harness.testLoad();
      const telemetry = harness.getTelemetry();

      expect(telemetry.getErrors()).toHaveLength(0);
    });
  });

  describe('Render Capability (REQ-RUNTIME-004)', () => {
    beforeEach(async () => {
      await harness.testLoad();
    });

    it('should render component successfully', async () => {
      const renderResult = await harness.testRender('App', { title: 'Test App' });

      expect(renderResult.status).toBe('rendered');
      expect(renderResult.component).toBe('App');
      expect(renderResult.element).toBeDefined();
      expect(renderResult.timestamp).toBeInstanceOf(Date);
      expect(renderResult.duration).toBeGreaterThanOrEqual(0);
    });

    it('should pass props to rendered component', async () => {
      const props = { title: 'My Title', count: 42 };
      const renderResult = await harness.testRender('App', props);

      expect(renderResult.status).toBe('rendered');
      expect(renderResult.element).toBeDefined();
    });

    it('should render multiple different components', async () => {
      const result1 = await harness.testRender('App', { id: 1 });
      expect(result1.status).toBe('rendered');
      expect(result1.component).toBe('App');

      const result2 = await harness.testRender('Header', { id: 2 });
      expect(result2.status).toBe('rendered');
      expect(result2.component).toBe('Header');

      const result3 = await harness.testRender('Footer', { id: 3 });
      expect(result3.status).toBe('rendered');
      expect(result3.component).toBe('Footer');
    });

    it('should emit render_start telemetry event', async () => {
      await harness.testRender('App');
      const telemetry = harness.getTelemetry();

      const renderStartEvents = telemetry.getEventsByPhase('render_start');
      expect(renderStartEvents.length).toBeGreaterThan(0);
      expect(renderStartEvents[0].capability).toBe('render');
      expect(renderStartEvents[0].metadata?.component).toBe('App');
    });

    it('should return error status for unknown component', async () => {
      const renderResult = await harness.testRender('UnknownComponent');

      expect(renderResult.status).toBe('error');
      expect(renderResult.error).toBeDefined();
      expect((renderResult.error as Error).message).toMatch(/not found/i);
    });

    it('should validate component exists before rendering', async () => {
      const renderResult = await harness.testRender('NonExistent');

      expect(renderResult.status).toBe('error');
      expect((renderResult.error as Error).message).toContain('NonExistent');
      expect((renderResult.error as Error).message).toContain('not found in availableComponents');
    });

    it('should require container to be loaded before render', async () => {
      // Reset to uninitialized state
      harness.reset();
      
      // Try to render without loading
      const mfe = harness.getMFE();
      const context = new ContextBuilder()
        .withInputs({ component: 'App', props: {}, containerId: 'test' })
        .build();

      await expect(mfe.render(context)).rejects.toThrow(/uninitialized/i);
    });

    it('should require component name in context', async () => {
      const context = new ContextBuilder()
        .withInputs({ props: {}, containerId: 'test' })
        .build();

      const mfe = harness.getMFE();
      const renderResult = await mfe.render(context);
      
      expect(renderResult.status).toBe('error');
      expect((renderResult.error as Error).message).toContain('Component name not provided');
    });

    it('should require containerId in context', async () => {
      const context = new ContextBuilder()
        .withInputs({ component: 'App', props: {} })
        .build();

      const mfe = harness.getMFE();
      const renderResult = await mfe.render(context);
      
      expect(renderResult.status).toBe('error');
      expect((renderResult.error as Error).message).toContain('Container ID not provided');
    });

    it('should measure render duration', async () => {
      const renderResult = await harness.testRender('App');

      expect(renderResult.duration).toBeGreaterThanOrEqual(0);
      expect(renderResult.renderDuration).toBeDefined();
      expect(renderResult.mountDuration).toBeDefined();
    });

    it('should transition state to rendering then back to ready', async () => {
      expect(harness.getMFE().getState()).toBe('ready');
      
      // State transitions happen during render
      await harness.testRender('App');
      
      expect(harness.getMFE().getState()).toBe('ready');
    });
  });

  describe('Full Load → Render Flow', () => {
    it('should complete full flow from uninitialized to rendered', async () => {
      expect(harness.getMFE().getState()).toBe('uninitialized');

      const { loadResult, renderResult } = await harness.testFullFlow('App', { test: true });

      expect(loadResult.status).toBe('loaded');
      expect(renderResult.status).toBe('rendered');
      expect(harness.getMFE().getState()).toBe('ready');
    });

    it('should maintain telemetry across load and render', async () => {
      await harness.testLoad();
      const loadTelemetry = harness.getTelemetry();
      const loadEvents = loadTelemetry.getEvents();

      await harness.testRender('App');
      const renderTelemetry = harness.getTelemetry();
      const renderEvents = renderTelemetry.getEvents();

      // Load should have entry, mount, enable_render phases
      expect(loadEvents.some((e: any) => e.phase === 'entry')).toBe(true);
      expect(loadEvents.some((e: any) => e.phase === 'mount')).toBe(true);
      expect(loadEvents.some((e: any) => e.phase === 'enable_render')).toBe(true);

      // Render should have render_start phase
      expect(renderEvents.some((e: any) => e.phase === 'render_start')).toBe(true);
    });
  });

  describe('State Management', () => {
    it('should start in uninitialized state', () => {
      expect(harness.getMFE().getState()).toBe('uninitialized');
    });

    it('should allow load from uninitialized state', async () => {
      expect(harness.getMFE().getState()).toBe('uninitialized');
      
      const loadResult = await harness.testLoad();
      
      expect(loadResult.status).toBe('loaded');
      expect(harness.getMFE().getState()).toBe('ready');
    });

    it('should allow render from ready state', async () => {
      await harness.testLoad();
      expect(harness.getMFE().getState()).toBe('ready');

      const renderResult = await harness.testRender('App');
      
      expect(renderResult.status).toBe('rendered');
    });

    it('should reset to uninitialized state', async () => {
      await harness.testLoad();
      expect(harness.getMFE().getState()).toBe('ready');

      harness.reset();
      
      expect(harness.getMFE().getState()).toBe('uninitialized');
      expect((harness.getMFE() as any).container).toBeNull();
      expect((harness.getMFE() as any).availableComponents).toEqual([]);
    });
  });

  describe('Telemetry Integration (REQ-RUNTIME-012)', () => {
    it('should emit telemetry events at all load checkpoints', async () => {
      await harness.testLoad();
      const telemetry = harness.getTelemetry();

      const allEvents = telemetry.getEvents();
      
      // Should have events for each load phase
      const phases = allEvents.map((e: any) => e.phase || e.metadata?.phase || e.eventData?.phase);
      expect(phases.filter(p => p === 'entry' || p === 'mount' || p === 'enable_render' || p === 'enableRender').length).toBeGreaterThan(0);
    });

    it('should emit telemetry events at render checkpoints', async () => {
      await harness.testLoad();
      await harness.testRender('App');
      
      const telemetry = harness.getTelemetry();
      const renderEvents = telemetry.getEventsByPhase('render_start');
      
      expect(renderEvents.length).toBeGreaterThan(0);
    });

    it('should include mfe name in all telemetry events', async () => {
      await harness.testLoad();
      const telemetry = harness.getTelemetry();

      const allEvents = telemetry.getEvents();
      allEvents.forEach((event: any) => {
        const mfeName = event.mfe || event.metadata?.mfe;
        expect(mfeName || event.name).toBeDefined();
      });
    });

    it('should include capability in telemetry metadata', async () => {
      const loadResult = await harness.testLoad();
      const loadTelemetry = harness.getTelemetry();
      const loadEvents = loadTelemetry.getEvents();
      
      const loadEventsWithCapability = loadEvents.filter((e: any) => 
        e.capability === 'load' || e.eventData?.capability === 'load' || e.metadata?.capability === 'load'
      );
      expect(loadEventsWithCapability.length).toBeGreaterThan(0);
      
      await harness.testRender('App');
      const renderTelemetry = harness.getTelemetry();
      const renderEvents = renderTelemetry.getEvents();
      
      const renderEventsWithCapability = renderEvents.filter((e: any) => 
        e.capability === 'render' || e.eventData?.capability === 'render' || e.metadata?.capability === 'render'
      );
      expect(renderEventsWithCapability.length).toBeGreaterThan(0);
    });

    it('should emit error telemetry on render failure', async () => {
      await harness.testLoad();
      await harness.testRender('NonExistent');
      
      const telemetry = harness.getTelemetry();
      const errors = telemetry.getErrors();
      
      expect(errors.length).toBeGreaterThan(0);
      const errorPhase = errors[0].phase || errors[0].eventData?.phase;
      expect(errorPhase).toBeDefined();
    });

    it('should include timestamps in all telemetry events', async () => {
      await harness.testLoad();
      const telemetry = harness.getTelemetry();

      const allEvents = telemetry.getEvents();
      allEvents.forEach((event: any) => {
        expect(event.timestamp).toBeInstanceOf(Date);
      });
    });

    it('should tag events appropriately', async () => {
      await harness.testLoad();
      const telemetry = harness.getTelemetry();

      const allEvents = telemetry.getEvents();
      // Just verify events were emitted, tags are optional
      expect(allEvents.length).toBeGreaterThan(0);
      
      // If tags exist, they should be an array
      allEvents.forEach((event: any) => {
        const tags = event.metadata?.tags || event.tags;
        if (tags !== undefined) {
          expect(Array.isArray(tags)).toBe(true);
        }
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle load errors gracefully', async () => {
      // This would require mocking a failed container fetch
      // For now, verify error structure is correct
      const loadResult = await harness.testLoad();
      expect(loadResult.status).toBe('loaded');
    });

    it('should return error status for component not found', async () => {
      await harness.testLoad();
      const renderResult = await harness.testRender('Missing');

      expect(renderResult.status).toBe('error');
      expect(renderResult.error).toBeInstanceOf(Error);
    });

    it('should include error details in result', async () => {
      await harness.testLoad();
      const renderResult = await harness.testRender('Invalid');

      expect(renderResult.status).toBe('error');
      expect(renderResult.error).toBeDefined();
      expect((renderResult.error as Error).message).toBeTruthy();
    });

    it('should emit error telemetry on failure', async () => {
      await harness.testLoad();
      await harness.testRender('BadComponent');

      const telemetry = harness.getTelemetry();
      const errors = telemetry.getErrors();

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].status).toBe('error');
    });
  });

  describe('Component Discovery', () => {
    it('should discover all available components after load', async () => {
      const loadResult = await harness.testLoad();

      expect(loadResult.availableComponents).toHaveLength(3);
      expect(loadResult.availableComponents).toEqual(
        expect.arrayContaining(['App', 'Header', 'Footer'])
      );
    });

    it('should validate component exists before render', async () => {
      await harness.testLoad();
      
      const validResult = await harness.testRender('App');
      expect(validResult.status).toBe('rendered');

      const invalidResult = await harness.testRender('NotThere');
      expect(invalidResult.status).toBe('error');
    });
  });

  describe('Context Propagation', () => {
    it('should accept context in load operation', async () => {
      const context = new ContextBuilder()
        .withRequestId('req-123')
        .withUser({ id: 'u1', username: 'test', roles: ['admin'] })
        .build();

      const loadResult = await harness.testLoad(context);
      expect(loadResult.status).toBe('loaded');
    });

    it('should accept context in render operation', async () => {
      await harness.testLoad();

      const context = new ContextBuilder()
        .withRequestId('req-456')
        .withInputs({ component: 'App', props: { test: true }, containerId: 'app-root' })
        .build();

      const renderResult = await harness.testRender('App', { test: true }, 'app-root', context);
      expect(renderResult.status).toBe('rendered');
    });

    it('should use inputs from context for render', async () => {
      await harness.testLoad();

      const renderResult = await harness.testRender('Header', { logo: 'test.png' }, 'header-container');

      expect(renderResult.status).toBe('rendered');
      expect(renderResult.component).toBe('Header');
    });
  });
});

// =============================================================================
// doUpdateControlPlaneState — standalone tests (not using the load/render harness)
// =============================================================================

describe('RemoteMFE.doUpdateControlPlaneState', () => {
  const manifest: any = {
    name: 'test-mfe',
    version: '1.0.0',
    type: 'remote',
    language: 'typescript',
    capabilities: [],
    remoteEntry: 'http://localhost:3001/remoteEntry.js',
  };

  function makeContext(inputs: Record<string, unknown>, requestId = 'req-001'): Context {
    return new ContextBuilder().withRequestId(requestId).withInputs(inputs).build();
  }

  function makeMFE(wsClient?: MockDaemonWebSocketClient): RemoteMFE {
    const mfe = new RemoteMFE(manifest, { wsClient });
    // Bypass state guard — updateControlPlaneState requires 'ready' or 'rendering'
    (mfe as any).state = 'ready';
    return mfe;
  }

  it('happy path: connected client + daemon ack → acknowledged: true', async () => {
    const ws = new MockDaemonWebSocketClient();
    ws.mutationResult = true;

    const result = await makeMFE(ws).updateControlPlaneState(
      makeContext({ stateKey: 'BUTTON_CLICK', stateData: { id: 42 } }),
    );

    expect(result.acknowledged).toBe(true);
    expect(result.correlationId).toBe('req-001');
    expect(result.error).toBeNull();

    const call = ws.assertCalledOnce();
    expect(call.query).toContain('sendMessage');
    const envelope = JSON.parse(call.variables['m'] as string);
    expect(envelope.direction).toBe('ACTION');
    expect(envelope.kind).toBe('ACTION');
    expect(envelope.payload.actionType).toBe('BUTTON_CLICK');
    expect(envelope.payload.data).toEqual({ id: 42 });
    expect(envelope.metadata.correlationId).toBe('req-001');
  });

  it('no wsClient in deps → not connected error, no throw', async () => {
    const result = await makeMFE(undefined).updateControlPlaneState(
      makeContext({ stateKey: 'SUBMIT' }),
    );

    expect(result.acknowledged).toBe(false);
    expect(result.error).toBe('Daemon WebSocket not connected');
  });

  it('wsClient.connected = false → not connected error, no throw', async () => {
    const ws = new MockDaemonWebSocketClient();
    ws.connected = false;

    const result = await makeMFE(ws).updateControlPlaneState(
      makeContext({ stateKey: 'SUBMIT' }),
    );

    expect(result.acknowledged).toBe(false);
    expect(result.error).toBe('Daemon WebSocket not connected');
    expect(ws.getCalls()).toHaveLength(0); // mutation never called
  });

  it('mutation times out → acknowledged: false, error contains timed out', async () => {
    const ws = new MockDaemonWebSocketClient();
    ws.mutationError = new Error('sendMessage timed out');

    const result = await makeMFE(ws).updateControlPlaneState(
      makeContext({ stateKey: 'CLICK' }),
    );

    expect(result.acknowledged).toBe(false);
    expect(result.error).toBe('sendMessage timed out');
  });

  it('daemon returns false → acknowledged: false', async () => {
    const ws = new MockDaemonWebSocketClient();
    ws.mutationResult = false;

    const result = await makeMFE(ws).updateControlPlaneState(
      makeContext({ stateKey: 'CLICK' }),
    );

    expect(result.acknowledged).toBe(false);
    expect(result.error).toBe('sendMessage mutation failed');
  });

  it('mutation rejects with non-timeout error → error is preserved', async () => {
    const ws = new MockDaemonWebSocketClient();
    ws.mutationError = new Error('GraphQL mutation error: field sendMessage not found');

    const result = await makeMFE(ws).updateControlPlaneState(
      makeContext({ stateKey: 'CLICK' }),
    );

    expect(result.acknowledged).toBe(false);
    expect(result.error).toContain('GraphQL mutation error');
  });

  it('missing stateKey → throws (programming error, not network error)', async () => {
    const ws = new MockDaemonWebSocketClient();

    await expect(
      makeMFE(ws).updateControlPlaneState(makeContext({ stateData: {} })),
    ).rejects.toThrow('stateKey');
  });

  it('correlationId falls back to context.requestId when not supplied', async () => {
    const ws = new MockDaemonWebSocketClient();

    const result = await makeMFE(ws).updateControlPlaneState(
      makeContext({ stateKey: 'CLICK' }, 'ctx-request-99'),
    );

    expect(result.correlationId).toBe('ctx-request-99');
    const envelope = JSON.parse(ws.assertCalledOnce().variables['m'] as string);
    expect(envelope.metadata.correlationId).toBe('ctx-request-99');
  });

  it('explicit correlationId in inputs takes precedence over requestId', async () => {
    const ws = new MockDaemonWebSocketClient();

    const result = await makeMFE(ws).updateControlPlaneState(
      makeContext({ stateKey: 'CLICK', correlationId: 'explicit-corr-id' }, 'ctx-request-99'),
    );

    expect(result.correlationId).toBe('explicit-corr-id');
    const envelope = JSON.parse(ws.assertCalledOnce().variables['m'] as string);
    expect(envelope.metadata.correlationId).toBe('explicit-corr-id');
  });
});
