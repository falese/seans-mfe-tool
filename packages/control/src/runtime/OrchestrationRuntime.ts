/**
 * Orchestration Runtime for Multi-MFE Coordination
 *
 * Coordinates loading and lifecycle management of multiple MFE instances.
 * Provides capability aggregation, dependency validation, and health monitoring.
 *
 * Part of Alpha Orchestration System (Phase 2)
 */

import type { RemoteMFE, LoadResult, CapabilityMetadata } from '@seans-mfe-tool/runtime';
import {
  OrchestrationContext,
  MFERegistryEntry,
  createOrchestrationContext,
} from './OrchestrationContext';
import { OrchestrationTelemetry } from './OrchestrationTelemetry';
import { RegistryClient } from '../daemon/RegistryClient';
import { logger } from '@seans-mfe-tool/logger';

/**
 * MFE descriptor for loading
 */
export interface MFEDescriptor {
  /** Unique MFE identifier */
  id: string;

  /** URL to MFE manifest */
  manifestUrl: string;

  /** URL to Module Federation remote entry */
  remoteEntryUrl: string;

  /** MFE type */
  type: 'remote' | 'bff' | 'tool';
}

/**
 * Load result for a single MFE
 */
interface MFELoadResult {
  id: string;
  loadResult?: LoadResult;
  error?: Error;
}

/**
 * Orchestration Runtime
 *
 * Manages multiple MFE instances, coordinating their loading,
 * tracking their state, and aggregating their capabilities.
 */
export class OrchestrationRuntime {
  private mfeInstances: Map<string, RemoteMFE> = new Map();
  private telemetry: OrchestrationTelemetry;
  private registryClient?: RegistryClient;

  constructor(telemetry?: OrchestrationTelemetry, registryClient?: RegistryClient) {
    this.telemetry = telemetry || new OrchestrationTelemetry();
    this.registryClient = registryClient;
  }

  /**
   * Load multiple MFEs in parallel
   *
   * Executes parallel loading of all MFE descriptors, updating the
   * orchestration context with registry state and telemetry.
   *
   * @param descriptors - Array of MFE descriptors to load
   * @param context - Orchestration context (optional, will create if not provided)
   * @returns Map of MFE ID to LoadResult
   */
  async loadMFEs(
    descriptors: MFEDescriptor[],
    context?: OrchestrationContext
  ): Promise<Map<string, LoadResult>> {
    const ctx = context || createOrchestrationContext();
    const startTime = Date.now();

    // Update orchestration state
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
    const loadPromises = descriptors.map(descriptor =>
      this.loadSingleMFE(descriptor, ctx)
    );

    const results = await Promise.allSettled(loadPromises);

    // Aggregate results
    const loadResultMap = new Map<string, LoadResult>();

    results.forEach((result, index) => {
      const descriptor = descriptors[index];

      if (result.status === 'fulfilled') {
        const mfeResult = result.value;

        if (mfeResult.loadResult) {
          loadResultMap.set(descriptor.id, mfeResult.loadResult);
          this.updateRegistry(ctx, descriptor.id, mfeResult.loadResult);
        } else if (mfeResult.error) {
          this.updateRegistryError(ctx, descriptor.id, mfeResult.error);
        }
      } else {
        // Promise rejected
        this.updateRegistryError(ctx, descriptor.id, result.reason);
      }
    });

    // Update orchestration state based on results
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

  /**
   * Get aggregated capabilities from all loaded MFEs
   *
   * @param context - Orchestration context
   * @returns Map of MFE ID to capabilities array
   */
  getAvailableCapabilities(
    context: OrchestrationContext
  ): Map<string, CapabilityMetadata[]> {
    const capabilitiesMap = new Map<string, CapabilityMetadata[]>();

    context.mfeRegistry.forEach((entry, mfeId) => {
      if (entry.status === 'loaded' || entry.status === 'ready') {
        capabilitiesMap.set(mfeId, entry.capabilities);
      }
    });

    return capabilitiesMap;
  }

  /**
   * Validate dependencies are satisfied
   *
   * Checks that all required capabilities and MFEs are available
   * before proceeding with rendering or execution.
   *
   * @param context - Orchestration context
   * @returns Validation result with missing dependencies
   */
  validateDependencies(context: OrchestrationContext): {
    valid: boolean;
    missing: Array<{ mfeId: string; missingCapability: string }>;
  } {
    if (!context.dependencies || context.dependencies.length === 0) {
      return { valid: true, missing: [] };
    }

    const missing: Array<{ mfeId: string; missingCapability: string }> = [];
    const allCapabilities = this.getAvailableCapabilities(context);

    // Flatten all capabilities
    const availableCapabilityNames = new Set<string>();
    allCapabilities.forEach(caps => {
      caps.forEach(cap => {
        if (cap.available) {
          availableCapabilityNames.add(cap.name);
        }
      });
    });

    // Check each dependency
    context.dependencies.forEach(dep => {
      // Check required capabilities
      dep.requiredCapabilities.forEach(capName => {
        if (!availableCapabilityNames.has(capName)) {
          missing.push({
            mfeId: dep.mfeId,
            missingCapability: capName,
          });
        }
      });

      // Check required MFEs are loaded
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

  /**
   * Get orchestration health status
   *
   * @param context - Orchestration context
   * @returns Health status with state breakdown
   */
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

  /**
   * Get MFE instance by ID
   *
   * @param mfeId - MFE identifier
   * @returns RemoteMFE instance or undefined
   */
  getMFEInstance(mfeId: string): RemoteMFE | undefined {
    return this.mfeInstances.get(mfeId);
  }

  /**
   * Get telemetry collector
   *
   * @returns Orchestration telemetry instance
   */
  getTelemetry(): OrchestrationTelemetry {
    return this.telemetry;
  }

  // Private helper methods

  /**
   * Load a single MFE
   *
   * @param descriptor - MFE descriptor
   * @param context - Orchestration context
   * @returns Load result or error
   */
  private async loadSingleMFE(
    descriptor: MFEDescriptor,
    context: OrchestrationContext
  ): Promise<MFELoadResult> {
    try {
      // Emit MFE load start
      this.telemetry.emit({
        name: 'mfe.load.start',
        workflowId: context.workflowId,
        mfeId: descriptor.id,
        sourceType: 'mfe',
        metadata: {
          manifestUrl: descriptor.manifestUrl,
          remoteEntryUrl: descriptor.remoteEntryUrl,
          type: descriptor.type,
        },
        timestamp: new Date(),
      });

      // Create RemoteMFE instance
      const mfe = await this.createMFEInstance(descriptor);
      this.mfeInstances.set(descriptor.id, mfe);

      // Load MFE
      const loadResult = await mfe.load(context);

      // Emit MFE load completion
      this.telemetry.emit({
        name: 'mfe.load.completed',
        workflowId: context.workflowId,
        mfeId: descriptor.id,
        sourceType: 'mfe',
        metadata: {
          status: loadResult.status,
          duration: loadResult.duration,
          capabilities: loadResult.capabilities?.length || 0,
        },
        timestamp: new Date(),
      });

      return { id: descriptor.id, loadResult };
    } catch (error) {
      // Emit MFE load error
      this.telemetry.emit({
        name: 'mfe.load.error',
        workflowId: context.workflowId,
        mfeId: descriptor.id,
        sourceType: 'mfe',
        metadata: {
          error: (error as Error).message,
        },
        timestamp: new Date(),
      });

      return { id: descriptor.id, error: error as Error };
    }
  }

  /**
   * Create MFE instance from descriptor
   *
   * Integrates with Rust daemon to:
   * 1. Fetch manifest from daemon registry (if available)
   * 2. Parse manifest into DSLManifest
   * 3. Create RemoteMFE instance
   *
   * @param descriptor - MFE descriptor
   * @returns RemoteMFE instance
   */
  private async createMFEInstance(descriptor: MFEDescriptor): Promise<RemoteMFE> {
    try {
      let manifestData: unknown;

      // If registry client available, fetch from daemon
      if (this.registryClient) {
        logger.info('Fetching manifest from daemon registry', { mfeId: descriptor.id });
        // RegistryClient.getManifest() returns parsed JSON object
        manifestData = await this.registryClient.getManifest(descriptor.id);
      } else {
        // Fallback: fetch directly from manifestUrl
        logger.info('Fetching manifest directly', { url: descriptor.manifestUrl });
        const response = await fetch(descriptor.manifestUrl);

        if (!response.ok) {
          throw new Error(`Failed to fetch manifest: ${response.statusText}`);
        }

        // Determine content type and parse accordingly
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          manifestData = await response.json();
        } else {
          // Assume YAML
          const { parseYAML } = await import('@seans-mfe-tool/dsl');
          const yamlContent = await response.text();
          manifestData = parseYAML(yamlContent);
        }
      }

      // Validate manifest is an object
      if (!manifestData || typeof manifestData !== 'object') {
        throw new Error('Invalid manifest: expected an object');
      }

      // Import types and validate
      const { DSLManifestSchema } = await import('@seans-mfe-tool/dsl');
      const parseResult = DSLManifestSchema.safeParse(manifestData);

      if (!parseResult.success) {
        throw new Error(`Invalid manifest schema: ${parseResult.error.message}`);
      }

      const manifest = parseResult.data;

      // Create RemoteMFE instance
      const { RemoteMFE } = await import('@seans-mfe-tool/runtime');
      const mfe = new RemoteMFE(manifest, {
        telemetry: this.telemetry,
        platformHandlers: {},
      });

      logger.info('Created RemoteMFE instance', {
        mfeId: descriptor.id,
        name: manifest.name,
      });

      return mfe;
    } catch (error) {
      logger.error('Failed to create MFE instance', {
        mfeId: descriptor.id,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Update registry with successful load result
   *
   * @param context - Orchestration context
   * @param mfeId - MFE identifier
   * @param loadResult - Load result
   */
  private updateRegistry(
    context: OrchestrationContext,
    mfeId: string,
    loadResult: LoadResult
  ): void {
    const entry: MFERegistryEntry = {
      id: mfeId,
      status: loadResult.status === 'loaded' ? 'loaded' : 'error',
      loadResult,
      capabilities: loadResult.capabilities || [],
      loadedAt: new Date(),
      duration: loadResult.duration,
    };

    context.mfeRegistry.set(mfeId, entry);

    if (loadResult.status === 'loaded') {
      context.loadedMFEs++;
    } else {
      context.failedMFEs++;
    }
  }

  /**
   * Update registry with error
   *
   * @param context - Orchestration context
   * @param mfeId - MFE identifier
   * @param error - Error
   */
  private updateRegistryError(
    context: OrchestrationContext,
    mfeId: string,
    error: Error
  ): void {
    const entry: MFERegistryEntry = {
      id: mfeId,
      status: 'error',
      capabilities: [],
      error: {
        phase: 'load',
        message: error.message,
        retryable: false,
      },
    };

    context.mfeRegistry.set(mfeId, entry);
    context.failedMFEs++;
  }

  /**
   * Update orchestration state based on load results
   *
   * @param context - Orchestration context
   */
  private updateOrchestrationState(context: OrchestrationContext): void {
    if (context.failedMFEs === context.totalMFEs) {
      context.orchestrationState = 'failure';
    } else if (context.failedMFEs > 0) {
      context.orchestrationState = 'partial-failure';
    } else {
      context.orchestrationState = 'ready';
    }
  }
}
