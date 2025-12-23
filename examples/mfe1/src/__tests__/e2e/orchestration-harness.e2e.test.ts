/**
 * Orchestration Harness E2E Tests
 *
 * Tests multi-MFE orchestration capabilities including:
 * - Parallel MFE loading
 * - Registry management
 * - Capability aggregation
 * - Dependency validation
 * - Partial failure handling
 * - Performance metrics
 *
 * Part of Alpha Orchestration System (Phase 4)
 */

import {
  OrchestrationRuntime,
  OrchestrationTelemetry,
  OrchestrationValidator,
  createOrchestrationContext,
  MFEDescriptor,
  OrchestrationContext,
  LoadResult,
} from '@seans-mfe-tool/runtime';

/**
 * Mock RemoteMFE for testing
 *
 * Simulates different load scenarios without actual network calls
 */
class MockRemoteMFE {
  private shouldFail: boolean;
  private loadDelay: number;
  private mfeId: string;

  constructor(mfeId: string, shouldFail: boolean = false, loadDelay: number = 100) {
    this.mfeId = mfeId;
    this.shouldFail = shouldFail;
    this.loadDelay = loadDelay;
  }

  async load(context: any): Promise<LoadResult> {
    // Simulate load delay
    await new Promise(resolve => setTimeout(resolve, this.loadDelay));

    if (this.shouldFail) {
      return {
        status: 'error' as const,
        timestamp: new Date(),
        duration: this.loadDelay,
        error: {
          phase: 'entry',
          message: 'Mock load failure',
          retryable: true,
          retryCount: 0,
        },
      };
    }

    return {
      status: 'loaded' as const,
      timestamp: new Date(),
      duration: this.loadDelay,
      container: { init: () => Promise.resolve() },
      manifest: {
        name: this.mfeId,
        version: '1.0.0',
        type: 'tool' as const,
        language: 'typescript' as const,
        capabilities: [],
      },
      availableComponents: ['Component1', 'Component2'],
      capabilities: [
        { name: 'load', type: 'platform', available: true },
        { name: 'render', type: 'platform', available: true },
        { name: `${this.mfeId}-capability`, type: 'domain', available: true },
      ],
      telemetry: {
        entry: { start: new Date(), duration: this.loadDelay * 0.4 },
        mount: { start: new Date(), duration: this.loadDelay * 0.3 },
        enableRender: { start: new Date(), duration: this.loadDelay * 0.3 },
      },
    };
  }
}

/**
 * Test orchestration runtime with mock MFE instances
 *
 * Note: Since createMFEInstance is private, we'll use a wrapper approach
 * that manually handles the MFE loading orchestration for testing
 */
class TestOrchestrationRuntime {
  private mockMFEs: Map<string, MockRemoteMFE> = new Map();
  private telemetry: OrchestrationTelemetry;

  constructor(telemetry: OrchestrationTelemetry) {
    this.telemetry = telemetry;
  }

  setMockMFE(descriptor: MFEDescriptor, shouldFail: boolean = false, loadDelay: number = 100) {
    this.mockMFEs.set(
      descriptor.id,
      new MockRemoteMFE(descriptor.id, shouldFail, loadDelay)
    );
  }

  /**
   * Load multiple MFEs using mocks
   * This replicates OrchestrationRuntime.loadMFEs behavior for testing
   */
  async loadMFEs(
    descriptors: MFEDescriptor[],
    context?: OrchestrationContext
  ): Promise<Map<string, LoadResult>> {
    const ctx = context || createOrchestrationContext();
    const startTime = Date.now();

    ctx.orchestrationState = 'loading';
    ctx.totalMFEs = descriptors.length;

    // Emit orchestration start
    this.telemetry.emit({
      name: 'orchestration.load.start',
      workflowId: ctx.workflowId,
      sourceType: 'orchestration',
      metadata: {
        totalMFEs: descriptors.length,
        mfeIds: descriptors.map(d => d.id),
      },
      timestamp: new Date(),
    });

    // Load all MFEs in parallel
    const loadPromises = descriptors.map(async (descriptor) => {
      try {
        const mock = this.mockMFEs.get(descriptor.id);
        if (!mock) {
          throw new Error(`No mock MFE configured for ${descriptor.id}`);
        }

        this.telemetry.emit({
          name: 'mfe.load.start',
          workflowId: ctx.workflowId,
          mfeId: descriptor.id,
          sourceType: 'mfe',
          timestamp: new Date(),
        });

        const loadResult = await mock.load(ctx);

        this.telemetry.emit({
          name: 'mfe.load.completed',
          workflowId: ctx.workflowId,
          mfeId: descriptor.id,
          sourceType: 'mfe',
          metadata: {
            status: loadResult.status,
            duration: loadResult.duration,
          },
          timestamp: new Date(),
        });

        return { id: descriptor.id, loadResult };
      } catch (error) {
        this.telemetry.emit({
          name: 'mfe.load.error',
          workflowId: ctx.workflowId,
          mfeId: descriptor.id,
          sourceType: 'mfe',
          metadata: {
            error: (error as Error).message,
          },
          timestamp: new Date(),
        });

        return { id: descriptor.id, error: error as Error };
      }
    });

    const results = await Promise.allSettled(loadPromises);

    // Aggregate results and update registry
    const loadResultMap = new Map<string, LoadResult>();

    results.forEach((result, index) => {
      const descriptor = descriptors[index];

      if (result.status === 'fulfilled') {
        const mfeResult = result.value;

        if ('loadResult' in mfeResult && mfeResult.loadResult) {
          loadResultMap.set(descriptor.id, mfeResult.loadResult);
          this.updateRegistry(ctx, descriptor.id, mfeResult.loadResult);
        } else if ('error' in mfeResult && mfeResult.error) {
          this.updateRegistryError(ctx, descriptor.id, mfeResult.error);
        }
      } else {
        this.updateRegistryError(ctx, descriptor.id, result.reason);
      }
    });

    // Update orchestration state
    this.updateOrchestrationState(ctx);

    // Emit orchestration completion
    const duration = Date.now() - startTime;
    this.telemetry.emit({
      name: 'orchestration.load.completed',
      workflowId: ctx.workflowId,
      sourceType: 'orchestration',
      metadata: {
        totalMFEs: ctx.totalMFEs,
        loadedMFEs: ctx.loadedMFEs,
        failedMFEs: ctx.failedMFEs,
        duration,
        state: ctx.orchestrationState,
      },
      timestamp: new Date(),
    });

    return loadResultMap;
  }

  getAvailableCapabilities(context: OrchestrationContext): Map<string, any[]> {
    const capabilitiesMap = new Map<string, any[]>();
    context.mfeRegistry.forEach((entry, mfeId) => {
      if (entry.status === 'loaded' || entry.status === 'ready') {
        capabilitiesMap.set(mfeId, entry.capabilities);
      }
    });
    return capabilitiesMap;
  }

  validateDependencies(context: OrchestrationContext): {
    valid: boolean;
    missing: Array<{ mfeId: string; missingCapability: string }>;
  } {
    if (!context.dependencies || context.dependencies.length === 0) {
      return { valid: true, missing: [] };
    }

    const missing: Array<{ mfeId: string; missingCapability: string }> = [];
    const allCapabilities = this.getAvailableCapabilities(context);

    const availableCapabilityNames = new Set<string>();
    allCapabilities.forEach(caps => {
      caps.forEach((cap: any) => {
        if (cap.available) {
          availableCapabilityNames.add(cap.name);
        }
      });
    });

    context.dependencies.forEach(dep => {
      dep.requiredCapabilities.forEach(capName => {
        if (!availableCapabilityNames.has(capName)) {
          missing.push({
            mfeId: dep.mfeId,
            missingCapability: capName,
          });
        }
      });

      dep.requiredMFEs.forEach(requiredMfeId => {
        const entry = context.mfeRegistry.get(requiredMfeId);
        if (!entry || (entry.status !== 'loaded' && entry.status !== 'ready')) {
          missing.push({
            mfeId: dep.mfeId,
            missingCapability: `MFE:${requiredMfeId}`,
          });
        }
      });
    });

    return {
      valid: missing.length === 0,
      missing,
    };
  }

  getHealthStatus(context: OrchestrationContext): {
    healthy: boolean;
    loadedCount: number;
    errorCount: number;
    states: Record<string, string>;
  } {
    const states: Record<string, string> = {};
    context.mfeRegistry.forEach((entry, id) => {
      states[id] = entry.status;
    });

    return {
      healthy: context.failedMFEs === 0,
      loadedCount: context.loadedMFEs,
      errorCount: context.failedMFEs,
      states,
    };
  }

  private updateRegistry(ctx: OrchestrationContext, mfeId: string, loadResult: LoadResult): void {
    const entry: any = {
      id: mfeId,
      status: loadResult.status === 'loaded' ? 'loaded' : 'error',
      loadResult,
      capabilities: loadResult.capabilities || [],
      loadedAt: new Date(),
      duration: loadResult.duration,
    };

    ctx.mfeRegistry.set(mfeId, entry);

    if (loadResult.status === 'loaded') {
      ctx.loadedMFEs++;
    } else {
      ctx.failedMFEs++;
    }
  }

  private updateRegistryError(ctx: OrchestrationContext, mfeId: string, error: Error): void {
    const entry: any = {
      id: mfeId,
      status: 'error',
      capabilities: [],
      error: {
        phase: 'load',
        message: error.message,
        retryable: false,
      },
    };

    ctx.mfeRegistry.set(mfeId, entry);
    ctx.failedMFEs++;
  }

  private updateOrchestrationState(ctx: OrchestrationContext): void {
    if (ctx.failedMFEs === ctx.totalMFEs) {
      ctx.orchestrationState = 'failure';
    } else if (ctx.failedMFEs > 0) {
      ctx.orchestrationState = 'partial-failure';
    } else {
      ctx.orchestrationState = 'ready';
    }
  }
}

/**
 * Orchestration test harness
 */
class OrchestrationHarness {
  private runtime: TestOrchestrationRuntime;
  private telemetry: OrchestrationTelemetry;

  constructor() {
    this.telemetry = new OrchestrationTelemetry();
    this.runtime = new TestOrchestrationRuntime(this.telemetry);
  }

  getRuntime(): TestOrchestrationRuntime {
    return this.runtime;
  }

  getTelemetry(): OrchestrationTelemetry {
    return this.telemetry;
  }

  reset(): void {
    this.telemetry.clear();
  }
}

describe('Orchestration E2E Tests', () => {
  let harness: OrchestrationHarness;

  beforeEach(() => {
    harness = new OrchestrationHarness();
  });

  describe('Multi-MFE Loading', () => {
    it('should load multiple MFEs in parallel successfully', async () => {
      const runtime = harness.getRuntime();
      const context = createOrchestrationContext();

      const descriptors: MFEDescriptor[] = [
        { id: 'mfe-a', manifestUrl: 'http://localhost:3001/manifest', remoteEntryUrl: 'http://localhost:3001/remoteEntry.js', type: 'remote' },
        { id: 'mfe-b', manifestUrl: 'http://localhost:3002/manifest', remoteEntryUrl: 'http://localhost:3002/remoteEntry.js', type: 'remote' },
        { id: 'mfe-c', manifestUrl: 'http://localhost:3003/manifest', remoteEntryUrl: 'http://localhost:3003/remoteEntry.js', type: 'remote' },
      ];

      // Configure mocks - all succeed
      descriptors.forEach(desc => runtime.setMockMFE(desc, false, 100));

      const results = await runtime.loadMFEs(descriptors, context);

      // Validate orchestration state
      expect(context.orchestrationState).toBe('ready');
      expect(context.loadedMFEs).toBe(3);
      expect(context.failedMFEs).toBe(0);
      expect(context.totalMFEs).toBe(3);

      // Validate registry
      expect(context.mfeRegistry.size).toBe(3);
      expect(results.size).toBe(3);

      // Validate all results are successful
      results.forEach((result, mfeId) => {
        expect(result.status).toBe('loaded');
        expect(result.capabilities).toBeDefined();
      });
    });

    it('should handle partial failures gracefully', async () => {
      const runtime = harness.getRuntime();
      const context = createOrchestrationContext();

      const descriptors: MFEDescriptor[] = [
        { id: 'mfe-a', manifestUrl: 'http://localhost:3001/manifest', remoteEntryUrl: 'http://localhost:3001/remoteEntry.js', type: 'remote' },
        { id: 'mfe-b', manifestUrl: 'http://localhost:3002/manifest', remoteEntryUrl: 'http://localhost:3002/remoteEntry.js', type: 'remote' },
        { id: 'mfe-c', manifestUrl: 'http://localhost:3003/manifest', remoteEntryUrl: 'http://localhost:3003/remoteEntry.js', type: 'remote' },
      ];

      // Configure mocks - mfe-b fails, others succeed
      runtime.setMockMFE(descriptors[0], false, 100);
      runtime.setMockMFE(descriptors[1], true, 100); // Fail
      runtime.setMockMFE(descriptors[2], false, 100);

      const results = await runtime.loadMFEs(descriptors, context);

      // Validate partial failure state
      expect(context.orchestrationState).toBe('partial-failure');
      expect(context.loadedMFEs).toBe(2);
      expect(context.failedMFEs).toBe(1);
      expect(context.totalMFEs).toBe(3);

      // Validate registry has all entries
      expect(context.mfeRegistry.size).toBe(3);

      // Check specific MFE states
      const mfeA = context.mfeRegistry.get('mfe-a');
      const mfeB = context.mfeRegistry.get('mfe-b');
      const mfeC = context.mfeRegistry.get('mfe-c');

      expect(mfeA?.status).toBe('loaded');
      expect(mfeB?.status).toBe('error');
      expect(mfeC?.status).toBe('loaded');
    });

    it('should handle complete failure when all MFEs fail', async () => {
      const runtime = harness.getRuntime();
      const context = createOrchestrationContext();

      const descriptors: MFEDescriptor[] = [
        { id: 'mfe-a', manifestUrl: 'http://localhost:3001/manifest', remoteEntryUrl: 'http://localhost:3001/remoteEntry.js', type: 'remote' },
        { id: 'mfe-b', manifestUrl: 'http://localhost:3002/manifest', remoteEntryUrl: 'http://localhost:3002/remoteEntry.js', type: 'remote' },
      ];

      // All MFEs fail
      descriptors.forEach(desc => runtime.setMockMFE(desc, true, 100));

      const results = await runtime.loadMFEs(descriptors, context);

      expect(context.orchestrationState).toBe('failure');
      expect(context.loadedMFEs).toBe(0);
      expect(context.failedMFEs).toBe(2);
    });
  });

  describe('Capability Aggregation', () => {
    it('should aggregate capabilities from all loaded MFEs', async () => {
      const runtime = harness.getRuntime();
      const context = createOrchestrationContext();

      const descriptors: MFEDescriptor[] = [
        { id: 'mfe-a', manifestUrl: 'http://localhost:3001/manifest', remoteEntryUrl: 'http://localhost:3001/remoteEntry.js', type: 'remote' },
        { id: 'mfe-b', manifestUrl: 'http://localhost:3002/manifest', remoteEntryUrl: 'http://localhost:3002/remoteEntry.js', type: 'remote' },
      ];

      descriptors.forEach(desc => runtime.setMockMFE(desc, false, 100));

      await runtime.loadMFEs(descriptors, context);

      const capabilities = runtime.getAvailableCapabilities(context);

      expect(capabilities.size).toBe(2);
      expect(capabilities.get('mfe-a')).toBeDefined();
      expect(capabilities.get('mfe-b')).toBeDefined();

      // Each MFE should have platform + domain capabilities
      capabilities.get('mfe-a')!.forEach(cap => {
        expect(['load', 'render', 'mfe-a-capability']).toContain(cap.name);
      });
    });

    it('should exclude failed MFEs from capability aggregation', async () => {
      const runtime = harness.getRuntime();
      const context = createOrchestrationContext();

      const descriptors: MFEDescriptor[] = [
        { id: 'mfe-a', manifestUrl: 'http://localhost:3001/manifest', remoteEntryUrl: 'http://localhost:3001/remoteEntry.js', type: 'remote' },
        { id: 'mfe-b', manifestUrl: 'http://localhost:3002/manifest', remoteEntryUrl: 'http://localhost:3002/remoteEntry.js', type: 'remote' },
      ];

      runtime.setMockMFE(descriptors[0], false, 100);
      runtime.setMockMFE(descriptors[1], true, 100); // Fail

      await runtime.loadMFEs(descriptors, context);

      const capabilities = runtime.getAvailableCapabilities(context);

      // Only mfe-a should be in capabilities
      expect(capabilities.size).toBe(1);
      expect(capabilities.get('mfe-a')).toBeDefined();
      expect(capabilities.get('mfe-b')).toBeUndefined();
    });
  });

  describe('Dependency Validation', () => {
    it('should validate dependencies are satisfied', async () => {
      const runtime = harness.getRuntime();
      const context = createOrchestrationContext();
      context.dependencies = [
        {
          mfeId: 'mfe-c',
          requiredCapabilities: ['mfe-a-capability', 'mfe-b-capability'],
          requiredMFEs: ['mfe-a', 'mfe-b'],
        },
      ];

      const descriptors: MFEDescriptor[] = [
        { id: 'mfe-a', manifestUrl: 'http://localhost:3001/manifest', remoteEntryUrl: 'http://localhost:3001/remoteEntry.js', type: 'remote' },
        { id: 'mfe-b', manifestUrl: 'http://localhost:3002/manifest', remoteEntryUrl: 'http://localhost:3002/remoteEntry.js', type: 'remote' },
        { id: 'mfe-c', manifestUrl: 'http://localhost:3003/manifest', remoteEntryUrl: 'http://localhost:3003/remoteEntry.js', type: 'remote' },
      ];

      descriptors.forEach(desc => runtime.setMockMFE(desc, false, 100));

      await runtime.loadMFEs(descriptors, context);

      const validation = runtime.validateDependencies(context);

      expect(validation.valid).toBe(true);
      expect(validation.missing).toHaveLength(0);
    });

    it('should detect missing dependencies', async () => {
      const runtime = harness.getRuntime();
      const context = createOrchestrationContext();
      context.dependencies = [
        {
          mfeId: 'mfe-c',
          requiredCapabilities: ['non-existent-capability'],
          requiredMFEs: ['mfe-a'],
        },
      ];

      const descriptors: MFEDescriptor[] = [
        { id: 'mfe-a', manifestUrl: 'http://localhost:3001/manifest', remoteEntryUrl: 'http://localhost:3001/remoteEntry.js', type: 'remote' },
        { id: 'mfe-c', manifestUrl: 'http://localhost:3003/manifest', remoteEntryUrl: 'http://localhost:3003/remoteEntry.js', type: 'remote' },
      ];

      descriptors.forEach(desc => runtime.setMockMFE(desc, false, 100));

      await runtime.loadMFEs(descriptors, context);

      const validation = runtime.validateDependencies(context);

      expect(validation.valid).toBe(false);
      expect(validation.missing.length).toBeGreaterThan(0);
      expect(validation.missing[0].missingCapability).toBe('non-existent-capability');
    });
  });

  describe('Health Status', () => {
    it('should report healthy status when all MFEs load', async () => {
      const runtime = harness.getRuntime();
      const context = createOrchestrationContext();

      const descriptors: MFEDescriptor[] = [
        { id: 'mfe-a', manifestUrl: 'http://localhost:3001/manifest', remoteEntryUrl: 'http://localhost:3001/remoteEntry.js', type: 'remote' },
        { id: 'mfe-b', manifestUrl: 'http://localhost:3002/manifest', remoteEntryUrl: 'http://localhost:3002/remoteEntry.js', type: 'remote' },
      ];

      descriptors.forEach(desc => runtime.setMockMFE(desc, false, 100));

      await runtime.loadMFEs(descriptors, context);

      const health = runtime.getHealthStatus(context);

      expect(health.healthy).toBe(true);
      expect(health.loadedCount).toBe(2);
      expect(health.errorCount).toBe(0);
      expect(health.states['mfe-a']).toBe('loaded');
      expect(health.states['mfe-b']).toBe('loaded');
    });

    it('should report unhealthy status with failures', async () => {
      const runtime = harness.getRuntime();
      const context = createOrchestrationContext();

      const descriptors: MFEDescriptor[] = [
        { id: 'mfe-a', manifestUrl: 'http://localhost:3001/manifest', remoteEntryUrl: 'http://localhost:3001/remoteEntry.js', type: 'remote' },
        { id: 'mfe-b', manifestUrl: 'http://localhost:3002/manifest', remoteEntryUrl: 'http://localhost:3002/remoteEntry.js', type: 'remote' },
      ];

      runtime.setMockMFE(descriptors[0], false, 100);
      runtime.setMockMFE(descriptors[1], true, 100); // Fail

      await runtime.loadMFEs(descriptors, context);

      const health = runtime.getHealthStatus(context);

      expect(health.healthy).toBe(false);
      expect(health.loadedCount).toBe(1);
      expect(health.errorCount).toBe(1);
    });
  });

  describe('Performance Metrics', () => {
    it('should calculate aggregated performance metrics', async () => {
      const runtime = harness.getRuntime();
      const context = createOrchestrationContext();

      const descriptors: MFEDescriptor[] = [
        { id: 'mfe-a', manifestUrl: 'http://localhost:3001/manifest', remoteEntryUrl: 'http://localhost:3001/remoteEntry.js', type: 'remote' },
        { id: 'mfe-b', manifestUrl: 'http://localhost:3002/manifest', remoteEntryUrl: 'http://localhost:3002/remoteEntry.js', type: 'remote' },
        { id: 'mfe-c', manifestUrl: 'http://localhost:3003/manifest', remoteEntryUrl: 'http://localhost:3003/remoteEntry.js', type: 'remote' },
      ];

      // Different load times
      runtime.setMockMFE(descriptors[0], false, 100);
      runtime.setMockMFE(descriptors[1], false, 200); // Slowest
      runtime.setMockMFE(descriptors[2], false, 150);

      await runtime.loadMFEs(descriptors, context);

      const metrics = OrchestrationValidator.getAggregatedPerformance(context);

      expect(metrics.slowestMFE).toBeDefined();
      expect(metrics.slowestMFE!.id).toBe('mfe-b');
      expect(metrics.slowestMFE!.duration).toBe(200);
      expect(metrics.averageDuration).toBe(150); // (100+200+150)/3
      expect(metrics.successRate).toBe(100);
      expect(metrics.criticalPath).toContain('mfe-b');
    });
  });

  describe('Orchestration Validation', () => {
    it('should validate successful orchestration', async () => {
      const runtime = harness.getRuntime();
      const context = createOrchestrationContext();

      const descriptors: MFEDescriptor[] = [
        { id: 'mfe-a', manifestUrl: 'http://localhost:3001/manifest', remoteEntryUrl: 'http://localhost:3001/remoteEntry.js', type: 'remote' },
      ];

      runtime.setMockMFE(descriptors[0], false, 100);

      await runtime.loadMFEs(descriptors, context);

      const validation = OrchestrationValidator.validate(context);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.warnings).toHaveLength(0);
    });

    it('should detect validation errors on complete failure', async () => {
      const runtime = harness.getRuntime();
      const context = createOrchestrationContext();

      const descriptors: MFEDescriptor[] = [
        { id: 'mfe-a', manifestUrl: 'http://localhost:3001/manifest', remoteEntryUrl: 'http://localhost:3001/remoteEntry.js', type: 'remote' },
      ];

      runtime.setMockMFE(descriptors[0], true, 100);

      await runtime.loadMFEs(descriptors, context);

      const validation = OrchestrationValidator.validate(context);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Telemetry Tracking', () => {
    it('should emit orchestration-level telemetry events', async () => {
      const runtime = harness.getRuntime();
      const telemetry = harness.getTelemetry();
      const context = createOrchestrationContext();

      const descriptors: MFEDescriptor[] = [
        { id: 'mfe-a', manifestUrl: 'http://localhost:3001/manifest', remoteEntryUrl: 'http://localhost:3001/remoteEntry.js', type: 'remote' },
      ];

      runtime.setMockMFE(descriptors[0], false, 100);

      await runtime.loadMFEs(descriptors, context);

      const events = telemetry.getEvents();

      // Should have start and completion events
      const startEvent = events.find(e => e.name === 'orchestration.load.start');
      const completeEvent = events.find(e => e.name === 'orchestration.load.completed');

      expect(startEvent).toBeDefined();
      expect(completeEvent).toBeDefined();
      expect(startEvent!.workflowId).toBe(context.workflowId);
      expect(completeEvent!.workflowId).toBe(context.workflowId);
    });

    it('should track workflow events across MFEs', async () => {
      const runtime = harness.getRuntime();
      const telemetry = harness.getTelemetry();
      const context = createOrchestrationContext();

      const descriptors: MFEDescriptor[] = [
        { id: 'mfe-a', manifestUrl: 'http://localhost:3001/manifest', remoteEntryUrl: 'http://localhost:3001/remoteEntry.js', type: 'remote' },
        { id: 'mfe-b', manifestUrl: 'http://localhost:3002/manifest', remoteEntryUrl: 'http://localhost:3002/remoteEntry.js', type: 'remote' },
      ];

      descriptors.forEach(desc => runtime.setMockMFE(desc, false, 100));

      await runtime.loadMFEs(descriptors, context);

      const workflowEvents = telemetry.getEventsByWorkflow(context.workflowId);

      expect(workflowEvents.length).toBeGreaterThan(0);

      // All events should have the same workflow ID
      workflowEvents.forEach(event => {
        expect(event.workflowId).toBe(context.workflowId);
      });
    });
  });
});
