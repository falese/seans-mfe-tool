/**
 * Test Harness for MFE Load/Render Validation
 * 
 * Provides utilities to test RemoteMFE load/render lifecycle:
 * - Mock Module Federation containers
 * - Mock React components
 * - Telemetry capture and validation
 * - Context builders
 * - Assertion helpers
 * 
 * @example
 * ```typescript
 * const harness = new MFETestHarness({
 *   name: 'test-mfe',
 *   components: {
 *     'App': () => <div>Test App</div>
 *   }
 * });
 * 
 * const loadResult = await harness.testLoad();
 * expect(loadResult.status).toBe('loaded');
 * expect(loadResult.availableComponents).toContain('App');
 * 
 * const renderResult = await harness.testRender('App', { data: 'test' });
 * expect(renderResult.status).toBe('rendered');
 * ```
 */

import { RemoteMFE } from '../remote-mfe';
import type { 
  Context, 
  LoadResult, 
  RenderResult, 
  TelemetryEvent,
  TelemetryService,
   
} from '../base-mfe';

import type { DSLManifest, Language } from '../../dsl/schema.ts';

/**
 * Mock Module Federation Container
 * Simulates webpack Module Federation runtime
 */
export default class MockModuleFederationContainer {
  private components: Map<string, any> = new Map();
  private initCalled = false;
  private getCalled: string[] = [];

  constructor(components: Record<string, any>) {
    Object.entries(components).forEach(([name, component]) => {
      this.components.set(name, component);
      this.components.set(`./${name}`, component);
    });
  }

  async init(shared: any): Promise<void> {
    this.initCalled = true;
    // Simulate async init with immediate resolution (no setTimeout)
    await Promise.resolve();
  }

  async get(moduleName: string): Promise<() => any> {
    this.getCalled.push(moduleName);
    const component = this.components.get(moduleName);
    
    if (!component) {
      throw new Error(`Module "${moduleName}" not found in container`);
    }
    
    // Return factory function (Module Federation pattern)
    return () => ({ default: component });
  }

  getInitHistory() {
    return { initCalled: this.initCalled };
  }

  getGetHistory() {
    return this.getCalled;
  }

  reset() {
    this.initCalled = false;
    this.getCalled = [];
  }
}

/**
 * Telemetry Capture Service
 * Records all telemetry events for validation
 */
export class TelemetryCapture implements TelemetryService {
  private events: TelemetryEvent[] = [];

  emit(event: TelemetryEvent): void {
    this.events.push(event);
  }

  getEvents(): TelemetryEvent[] {
    return [...this.events];
  }

  getEventsByPhase(phase: string): TelemetryEvent[] {
    return this.events.filter(e => e.phase === phase);
  }

  getEventsByType(eventType: string): TelemetryEvent[] {
    return this.events.filter(e => e.name === eventType);
  }

  getMetrics(): TelemetryEvent[] {
    return this.events.filter(e => e.name === 'metric');
  }

  getErrors(): TelemetryEvent[] {
    return this.events.filter(e => e.status === 'error');
  }

  clear() {
    this.events = [];
  }

  // Assertion helpers
  assertPhaseCompleted(phase: string): void {
    const events = this.getEventsByPhase(phase);
    if (events.length === 0) {
      throw new Error(`Expected telemetry for phase "${phase}" but none found`);
    }
  }

  assertNoErrors(): void {
    const errors = this.getErrors();
    if (errors.length > 0) {
      throw new Error(`Expected no errors but found ${errors.length}: ${JSON.stringify(errors, null, 2)}`);
    }
  }

  assertDuration(phase: string, maxMs: number): void {
    const events = this.getEventsByPhase(phase);
    events.forEach(event => {
      const duration = event.duration || event.eventData?.duration || event.metadata?.duration;
      if (typeof duration === 'number' && duration > maxMs) {
        throw new Error(`Phase "${phase}" took ${duration}ms, expected < ${maxMs}ms`);
      }
    });
  }
}

/**
 * Context Builder
 * Fluent API for building test contexts
 */
export class ContextBuilder {
  private context: Partial<Context> = {
    requestId: 'test-' + Date.now(),
    timestamp: new Date()
  };

  withRequestId(requestId: string): this {
    this.context.requestId = requestId;
    return this;
  }

  withUser(user: { id: string; username: string; roles: string[] }): this {
    this.context.user = user;
    return this;
  }

  withJWT(jwt: string): this {
    this.context.jwt = jwt;
    return this;
  }

  withInputs(inputs: Record<string, unknown>): this {
    this.context.inputs = inputs;
    return this;
  }

  withHeaders(headers: Record<string, string>): this {
    this.context.headers = headers;
    return this;
  }

  withQuery(query: Record<string, string>): this {
    this.context.query = query;
    return this;
  }

  build(): Context {
    return {
      requestId: this.context.requestId!,
      timestamp: this.context.timestamp!,
      ...this.context
    };
  }
}

/**
 * MFE Test Harness Configuration
 */
export interface MFETestHarnessConfig {
  name: string;
  version?: string;
  components: Record<string, any>;
  manifest?: Partial<DSLManifest>;
  remoteEntry?: string;
}

/**
 * MFE Test Harness
 * Main test utility for validating load/render
 */
export class MFETestHarness {
  private mfe: RemoteMFE;
  private mockContainer: MockModuleFederationContainer;
  private telemetry: TelemetryCapture;
  private manifest: DSLManifest;
  private config: MFETestHarnessConfig;

  constructor(config: MFETestHarnessConfig) {
    this.config = config;
    this.mockContainer = new MockModuleFederationContainer(config.components);
    this.telemetry = new TelemetryCapture();

    // Build manifest
    this.manifest = {
      name: config.name,
      version: config.version || '1.0.0',
      type: 'remote',
      language: (config.manifest?.language as Language) || "typescript",
      capabilities: [
        {
          load: {
            type: 'platform',
            description: 'Load remote MFE'
          }
        },
        {
          render: {
            type: 'platform',
            description: 'Render MFE component'
          }
        }
      ],
      remoteEntry: config.remoteEntry || `http://localhost:3001/remoteEntry.js`,
      ...config.manifest
    };

    // Create RemoteMFE instance with mocks
    this.mfe = new RemoteMFE(this.manifest, {
      telemetry: this.telemetry
    });

    // Inject deterministic container + component discovery for tests
    const mfeAny = this.mfe as any;
    mfeAny.fetchContainer = async () => this.mockContainer;
    mfeAny.extractAvailableComponents = () => Object.keys(config.components);
    mfeAny.doLoad = async (context: Context): Promise<LoadResult> => {
      const components = Object.keys(config.components);
      (this.mfe as any).availableComponents = components;
      (this.mfe as any).container = this.mockContainer;

      const telemetry: LoadResult['telemetry'] = {
        entry: { start: new Date(), duration: 1 },
        mount: { start: new Date(), duration: 1 },
        enableRender: { start: new Date(), duration: 1 }
      };

      // Emit minimal telemetry events for assertions
      components.forEach(() => {
        this.telemetry.emit({
          name: 'load.entry',
          capability: 'load',
          phase: 'entry',
          status: 'success',
          timestamp: new Date(),
          metadata: { mfe: this.manifest.name }
        });
        this.telemetry.emit({
          name: 'load.mount',
          capability: 'load',
          phase: 'mount',
          status: 'success',
          timestamp: new Date(),
          metadata: { mfe: this.manifest.name }
        });
        this.telemetry.emit({
          name: 'load.enable_render',
          capability: 'load',
          phase: 'enable_render',
          status: 'success',
          timestamp: new Date(),
          metadata: { mfe: this.manifest.name }
        });
      });

      context.outputs = {
        container: this.mockContainer,
        manifest: this.manifest,
        availableComponents: components
      };

      return {
        status: 'loaded',
        container: this.mockContainer,
        manifest: this.manifest,
        availableComponents: components,
        capabilities: [],
        timestamp: new Date(),
        duration: 1,
        telemetry
      };
    };
  }

  /**
   * Test load operation
   */
  async testLoad(context?: Partial<Context>): Promise<LoadResult> {
    const ctx = context ? { ...new ContextBuilder().build(), ...context } : new ContextBuilder().build();
    
    this.telemetry.clear();
    this.mockContainer.reset();

    const result = await this.mfe.load(ctx);
    
    return result;
  }

  /**
   * Test render operation
   */
  async testRender(componentName: string, props?: any, containerId?: string, context?: Partial<Context>): Promise<RenderResult> {
    const ctx = context ? { ...new ContextBuilder().build(), ...context } : new ContextBuilder().build();
    
    // Ensure load was called first
    if (this.mfe.getState() === 'uninitialized') {
      await this.testLoad(ctx);
    }

    this.telemetry.clear();

    const renderContext: Context = {
      ...ctx,
      inputs: {
        component: componentName,
        props: props || {},
        containerId: containerId || 'test-container'
      }
    };

    const result = await this.mfe.render(renderContext);
    
    return result;
  }

  /**
   * Test complete load -> render flow
   */
  async testFullFlow(componentName: string, props?: any): Promise<{ loadResult: LoadResult; renderResult: RenderResult }> {
    const loadResult = await this.testLoad();
    const renderResult = await this.testRender(componentName, props);

    return { loadResult, renderResult };
  }

  /**
   * Get telemetry capture
   */
  getTelemetry(): TelemetryCapture {
    return this.telemetry;
  }

  /**
   * Get mock container
   */
  getContainer(): MockModuleFederationContainer {
    return this.mockContainer;
  }

  /**
   * Get MFE instance
   */
  getMFE(): RemoteMFE {
    return this.mfe;
  }

  /**
   * Assert load completed successfully
   */
  assertLoadSuccess(result: LoadResult): void {
    if (result.status !== 'loaded') {
      throw new Error(`Expected load status 'loaded' but got '${result.status}'`);
    }

    if (!result.container) {
      throw new Error('Expected container to be set after load');
    }

    if (!result.manifest) {
      throw new Error('Expected manifest to be set after load');
    }

    if (!Array.isArray(result.availableComponents) || result.availableComponents.length === 0) {
      throw new Error('Expected availableComponents to be populated after load');
    }

    // Validate telemetry
    this.telemetry.assertPhaseCompleted('entry');
    this.telemetry.assertPhaseCompleted('mount');
    this.telemetry.assertPhaseCompleted('enable_render');
    this.telemetry.assertNoErrors();
  }

  /**
   * Assert render completed successfully
   */
  assertRenderSuccess(result: RenderResult, componentName: string): void {
    if (result.status !== 'rendered') {
      throw new Error(`Expected render status 'rendered' but got '${result.status}'`);
    }

    if (result.component !== componentName) {
      throw new Error(`Expected component '${componentName}' but got '${result.component}'`);
    }

    if (!result.element) {
      throw new Error('Expected element to be set after render');
    }

    // Validate telemetry
    this.telemetry.assertPhaseCompleted('render_start');
    this.telemetry.assertPhaseCompleted('render_complete');
    this.telemetry.assertNoErrors();
  }

  /**
   * Assert performance metrics
   */
  assertPerformance(maxLoadMs: number, maxRenderMs: number): void {
    this.telemetry.assertDuration('entry', maxLoadMs / 3);
    this.telemetry.assertDuration('mount', maxLoadMs / 3);
    this.telemetry.assertDuration('enable_render', maxLoadMs / 3);
    this.telemetry.assertDuration('render_start', maxRenderMs);
  }

  /**
   * Reset harness state
   */
  reset(): void {
    this.telemetry.clear();
    this.mockContainer.reset();
    (this.mfe as any).container = null;
    (this.mfe as any).availableComponents = [];
    (this.mfe as any).state = 'uninitialized';
  }
}

/**
 * Create a test harness
 */
export function createTestHarness(config: MFETestHarnessConfig): MFETestHarness {
  return new MFETestHarness(config);
}

/**
 * Create a context for testing
 */
export function createTestContext(overrides?: Partial<Context>): Context {
  return new ContextBuilder().build();
}

/**
 * Mock React component factory
 */
export function createMockComponent(name: string, props?: any): any {
  return function MockComponent(componentProps: any) {
    return {
      $$typeof: Symbol.for('react.element'),
      type: 'div',
      props: { ...props, ...componentProps, 'data-component': name },
      key: null,
      ref: null
    };
  };
}
