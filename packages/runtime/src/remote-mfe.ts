/**
 * RemoteMFE Implementation
 * Concrete implementation of BaseMFE for Module Federation remotes
 * 
 * Implements:
 * - REQ-RUNTIME-001: Load capability with atomic entry/mount/enable-render
 * - REQ-RUNTIME-004: Render capability with component awareness
 * - REQ-RUNTIME-012: Telemetry emission at all checkpoints
 */

import { BaseMFE, LoadResult, RenderResult, Context, HealthResult, DescribeResult, SchemaResult, QueryResult, EmitResult } from './base-mfe';
import type { DSLManifest } from '@seans-mfe-tool/dsl';
import { createLogger } from '@seans-mfe-tool/logger';

// Logger for remote MFE
const logger = createLogger({ context: 'runtime:remote-mfe', level: 'debug' });

/**
 * Module Federation container interface
 */
export interface ModuleFederationContainer {
  init(shared: Record<string, any>): Promise<void>;
  get(module: string): Promise<() => any>;
}

/**
 * RemoteMFE class for Module Federation remotes
 * 
 * This class implements the load/render lifecycle for federated modules,
 * following the atomic operation model with telemetry at each checkpoint.
 */
export class RemoteMFE extends BaseMFE {
  private container: ModuleFederationContainer | null = null;
  private availableComponents: string[] = [];
  private mountedComponent: any = null;

  /**
   * Implement load logic for Module Federation remote
   * 
   * REQ-RUNTIME-001: Atomic operation with three phases:
   * 1. Entry: Fetch remote entry + container
   * 2. Mount: Initialize container, wire shared deps
   * 3. Enable-render: Prepare MFE state for render phase
   */
  protected async doLoad(context: Context): Promise<LoadResult> {
    const startTime = Date.now();
    const telemetry: LoadResult['telemetry'] = {
      entry: { start: new Date(), duration: 0 },
      mount: { start: new Date(), duration: 0 },
      enableRender: { start: new Date(), duration: 0 }
    };

    try {
      // Phase 1: Entry - Fetch Module Federation remote entry
      const entryStart = Date.now();
      (telemetry as any).entry = { start: new Date() };
      
      if (this.deps?.telemetry) {
        this.deps.telemetry.emit({
          name: 'load-entry',
          capability: 'load',
          phase: 'entry',
          status: 'start',
          metadata: { mfe: this.manifest.name },
          timestamp: new Date()
        });
      }

      // Get remote entry URL from context or manifest
      const remoteEntry = context.inputs?.remoteEntry as string || this.manifest.remoteEntry;
      if (!remoteEntry) {
        throw new Error('Remote entry URL not provided in context.inputs or manifest');
      }

      // Fetch container (in real implementation, this would use Module Federation runtime)
      this.container = await this.fetchContainer(remoteEntry);
      
      (telemetry as any).entry.duration = Date.now() - entryStart;
      
      if (this.deps?.telemetry) {
        this.deps.telemetry.emit({
          name: 'load-entry-metric',
          capability: 'load',
          phase: 'entry',
          status: 'success',
          metadata: { 
            mfe: this.manifest.name,
            duration: (telemetry as any).entry.duration 
          },
          timestamp: new Date(),
          duration: (telemetry as any).entry.duration
        });
      }

      // Phase 2: Mount - Initialize container and wire shared dependencies
      const mountStart = Date.now();
      (telemetry as any).mount = { start: new Date() };
      
      if (this.deps?.telemetry) {
        this.deps.telemetry.emit({
          name: 'load-mount',
          capability: 'load',
          phase: 'mount',
          status: 'start',
          metadata: { mfe: this.manifest.name },
          timestamp: new Date()
        });
      }

      // Initialize container with shared dependencies
      const sharedDeps = this.getSharedDependencies();
      await this.container.init(sharedDeps);
      
      // Extract available components from manifest
      this.availableComponents = this.extractAvailableComponents();
      
      (telemetry as any).mount.duration = Date.now() - mountStart;
      
      if (this.deps?.telemetry) {
        this.deps.telemetry.emit({
          name: 'load-mount-metric',
          capability: 'load',
          phase: 'mount',
          status: 'success',
          metadata: { 
            mfe: this.manifest.name,
            duration: (telemetry as any).mount.duration,
            componentsCount: this.availableComponents.length
          },
          timestamp: new Date(),
          duration: (telemetry as any).mount.duration
        });
      }

      // Phase 3: Enable-render - Prepare MFE state for render phase
      const enableRenderStart = Date.now();
      (telemetry as any).enableRender = { start: new Date() };
      
      if (this.deps?.telemetry) {
        this.deps.telemetry.emit({
          name: 'load-enable-render',
          capability: 'load',
          phase: 'enable_render',
          status: 'start',
          metadata: { mfe: this.manifest.name },
          timestamp: new Date()
        });
      }

      // Prepare render state (validate components, prepare metadata)
      const capabilities = this.extractCapabilities();
      
      (telemetry as any).enableRender.duration = Date.now() - enableRenderStart;
      
      if (this.deps?.telemetry) {
        this.deps.telemetry.emit({
          name: 'load-enable-render-metric',
          capability: 'load',
          phase: 'enable_render',
          status: 'success',
          metadata: { 
            mfe: this.manifest.name,
            duration: (telemetry as any).enableRender.duration
          },
          timestamp: new Date(),
          duration: (telemetry as any).enableRender.duration
        });
      }

      // Emit completion telemetry
      const totalDuration = Date.now() - startTime;
      if (this.deps?.telemetry) {
        this.deps.telemetry.emit({
          name: 'load-completed',
          capability: 'load',
          phase: 'completed',
          status: 'success',
          metadata: { 
            mfe: this.manifest.name,
            success: true
          },
          timestamp: new Date(),
          duration: totalDuration
        });
      }

      // Populate context outputs
      context.outputs = {
        container: this.container,
        manifest: this.manifest,
        availableComponents: this.availableComponents,
        capabilities
      };

      return {
        status: 'loaded',
        container: this.container,
        manifest: this.manifest,
        availableComponents: this.availableComponents,
        capabilities,
        timestamp: new Date(),
        duration: totalDuration,
        telemetry
      };
    } catch (error) {
      const errorObj = error as Error;
      const failedPhase = this.determineFailedPhase(telemetry);
      const isRetryable = this.isRetryableError(errorObj);

      // Emit error telemetry
      if (this.deps?.telemetry) {
        this.deps.telemetry.emit({
          name: 'load-error',
          capability: 'load',
          phase: 'error',
          status: 'error',
          metadata: {
            mfe: this.manifest.name,
            error: errorObj.message,
            failedPhase,
            retryable: isRetryable
          },
          timestamp: new Date()
        });
      }

      // Construct PhaseError with phase context
      const phaseError: import('./types').PhaseError = {
        message: errorObj.message,
        phase: failedPhase,
        retryCount: 0,  // Will be incremented by retry wrapper
        retryable: isRetryable,
        cause: errorObj
      };

      return {
        status: 'error',
        timestamp: new Date(),
        duration: Date.now() - startTime,
        error: phaseError,
        telemetry
      };
    }
  }

  /**
   * Implement render logic for Module Federation remote
   * 
   * REQ-RUNTIME-004: Component-aware rendering with:
   * - Component selection from available components
   * - Props validation and passing
   * - Error boundary integration
   * - DOM mounting with React 18 createRoot
   */
  protected async doRender(context: Context): Promise<RenderResult> {
    const startTime = Date.now();
    
    try {
      // Extract render parameters from context
      const componentName = context.inputs?.component as string;
      const props = (context.inputs?.props as Record<string, any>) || {};
      const containerId = context.inputs?.containerId as string;

      if (!componentName) {
        throw new Error('Component name not provided in context.inputs.component');
      }

      if (!containerId) {
        throw new Error('Container ID not provided in context.inputs.containerId');
      }

      // Telemetry: Render start
      if (this.deps?.telemetry) {
        this.deps.telemetry.emit({
          name: 'render-start',
          capability: 'render',
          phase: 'render_start',
          status: 'start',
          metadata: { 
            mfe: this.manifest.name,
            component: componentName
          },
          timestamp: new Date()
        });
      }

      // Validate component exists in available components
      if (!this.availableComponents.includes(componentName)) {
        throw new Error(
          `Component "${componentName}" not found in availableComponents: [${this.availableComponents.join(', ')}]`
        );
      }

      // Validate container exists
      if (!this.container) {
        throw new Error('Container not loaded. Call load() before render()');
      }

      // Fetch component from container
      const renderStart = Date.now();
      const componentFactory = await this.container.get(`./${componentName}`);
      const Component = componentFactory();
      
      const renderDuration = Date.now() - renderStart;

      // Telemetry: Component fetch duration
      if (this.deps?.telemetry) {
        this.deps.telemetry.emit({
          name: 'render-component-fetch',
          capability: 'render',
          phase: 'component_fetch',
          status: 'success',
          metadata: { 
            mfe: this.manifest.name,
            component: componentName
          },
          timestamp: new Date(),
          duration: renderDuration
        });
      }

      // Mount component to DOM
      const mountStart = Date.now();
      const element = await this.mountComponent(Component, props, containerId);
      const mountDuration = Date.now() - mountStart;

      // Telemetry: Mount duration
      if (this.deps?.telemetry) {
        this.deps.telemetry.emit({
          name: 'render-mount',
          capability: 'render',
          phase: 'mount',
          status: 'success',
          metadata: { 
            mfe: this.manifest.name,
            component: componentName
          },
          timestamp: new Date(),
          duration: mountDuration
        });
      }

      const totalDuration = Date.now() - startTime;

      // Telemetry: Render completed
      if (this.deps?.telemetry) {
        this.deps.telemetry.emit({
          name: 'render-completed',
          capability: 'render',
          phase: 'completed',
          status: 'success',
          metadata: { 
            mfe: this.manifest.name,
            component: componentName,
            success: true
          },
          timestamp: new Date(),
          duration: totalDuration
        });
      }

      // Store mounted component reference
      this.mountedComponent = { component: componentName, element, props };

      // Populate context outputs
      context.outputs = {
        ...context.outputs,
        component: componentName,
        element,
        renderDuration,
        mountDuration
      };

      return {
        status: 'rendered',
        component: componentName,
        element,
        timestamp: new Date(),
        duration: totalDuration,
        renderDuration,
        mountDuration
      };
    } catch (error) {
      // Emit error telemetry
      if (this.deps?.telemetry) {
        this.deps.telemetry.emit({
          name: 'render-error',
          capability: 'render',
          phase: 'error',
          status: 'error',
          metadata: { 
            mfe: this.manifest.name,
            error: (error as Error).message
          },
          timestamp: new Date()
        });
      }

      return {
        status: 'error',
        timestamp: new Date(),
        duration: Date.now() - startTime,
        error: error as Error
      };
    }
  }

  // =========================================================================
  // Helper Methods
  // =========================================================================

  /**
   * Fetch Module Federation container from remote entry
   */
  private async fetchContainer(remoteEntry: string): Promise<ModuleFederationContainer> {
    // In a real implementation, this would:
    // 1. Load the remoteEntry.js script
    // 2. Access the global container variable
    // 3. Return the container interface
    
    // For now, return a mock container for testing
    return {
      init: async (shared: Record<string, any>) => {
        // Initialize with shared dependencies
        logger.debug('[RemoteMFE] Container initialized with shared deps', { deps: Object.keys(shared) });
      },
      get: async (module: string) => {
        // Return a factory function for the requested module
        logger.debug('[RemoteMFE] Fetching module', { module });
        return () => ({
          default: class MockComponent {}
        });
      }
    };
  }

  /**
   * Get shared dependencies for Module Federation
   */
  private getSharedDependencies(): Record<string, any> {
    // Return shared dependencies (React, ReactDOM, etc.)
    return {
      react: { version: '18.2.0', singleton: true },
      'react-dom': { version: '18.2.0', singleton: true }
    };
  }

  /**
   * Extract available components from manifest
   */
  private extractAvailableComponents(): string[] {
    // Extract from manifest.capabilities
    if (!this.manifest.capabilities) {
      return [];
    }
    
    // Find render capability and extract components
    for (const capEntry of this.manifest.capabilities) {
      if (capEntry.render) {
        const components = (capEntry.render as any).components;
        if (Array.isArray(components)) {
          return components;
        }
      }
    }
    
    return [];
  }

  /**
   * Extract capability metadata from manifest (ADR-060 compliant)
   */
  private extractCapabilities(): import('./types').CapabilityMetadata[] {
    if (!this.manifest.capabilities) {
      return [];
    }

    const capabilities: import('./types').CapabilityMetadata[] = [];

    // Platform capabilities (standard MFE capabilities)
    const platformCapabilities = ['load', 'render', 'refresh', 'health', 'unmount'];

    for (const capEntry of this.manifest.capabilities) {
      const entries = Object.entries(capEntry);
      for (const [name, config] of entries) {
        const capConfig = config as any;

        const metadata: import('./types').CapabilityMetadata = {
          name,
          type: platformCapabilities.includes(name) ? 'platform' : 'domain',
          available: true,  // If it's in the manifest, it's available
          requiresAuth: capConfig.authorization ? true : false,
          inputs: capConfig.inputs?.map((input: any) => input.name) || [],
          outputs: capConfig.outputs?.map((output: any) => output.name) || [],
          description: capConfig.description || undefined
        };

        capabilities.push(metadata);
      }
    }

    return capabilities;
  }

  /**
   * Mount React component to DOM using React 18 createRoot
   */
  private async mountComponent(Component: any, props: Record<string, any>, containerId: string): Promise<any> {
    // In a real implementation, this would:
    // 1. Get DOM element by containerId
    // 2. Use React 18 createRoot API
    // 3. Wrap with error boundary
    // 4. Apply theme provider if configured
    // 5. Render component with props
    
    // For now, return a mock element
    const element = {
      id: containerId,
      component: Component,
      props
    } as any;
    
    logger.debug('[RemoteMFE] Component mounted:', { Component, props, containerId });
    
    return element;
  }

  // =========================================================================
  // Load Helper Methods (ADR-060)
  // =========================================================================

  /**
   * Determine which phase failed based on telemetry data
   */
  private determineFailedPhase(telemetry?: LoadResult['telemetry']): 'entry' | 'mount' | 'enable-render' {
    if (!telemetry) {
      return 'entry';  // If no telemetry, assume failed at entry
    }

    // Check which phase has duration = 0 (didn't complete)
    if (telemetry.entry.duration === 0) {
      return 'entry';
    }
    if (telemetry.mount.duration === 0) {
      return 'mount';
    }
    return 'enable-render';
  }

  /**
   * Check if an error is retryable (network, timeout, etc.)
   */
  private isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();

    // Network-related errors are retryable
    if (message.includes('network') ||
        message.includes('fetch') ||
        message.includes('timeout') ||
        message.includes('connection') ||
        message.includes('econnrefused') ||
        message.includes('enotfound')) {
      return true;
    }

    // 5xx server errors are retryable
    if (message.includes('500') ||
        message.includes('502') ||
        message.includes('503') ||
        message.includes('504')) {
      return true;
    }

    // Rate limiting is retryable
    if (message.includes('429') || message.includes('rate limit')) {
      return true;
    }

    // Everything else is not retryable (4xx client errors, validation errors, etc.)
    return false;
  }

  // =========================================================================
  // Other Required Abstract Methods
  // =========================================================================

  protected async doRefresh(context: Context): Promise<void> {
    // Refresh MFE data/state
    logger.debug('[RemoteMFE] Refresh called');
  }

  protected async doAuthorizeAccess(context: Context): Promise<boolean> {
    // Check authorization
    return true;
  }

  protected async doHealth(context: Context): Promise<HealthResult> {
    return {
      status: 'healthy',
      checks: [
        {
          name: 'container',
          status: this.container !== null ? 'pass' : 'fail',
          message: this.container !== null ? 'Container loaded' : 'Container not loaded'
        },
        {
          name: 'components',
          status: this.availableComponents.length > 0 ? 'pass' : 'fail',
          message: `${this.availableComponents.length} components available`
        }
      ],
      timestamp: new Date()
    };
  }

  protected async doDescribe(context: Context): Promise<DescribeResult> {
    return {
      name: this.manifest.name,
      version: this.manifest.version,
      type: this.manifest.type,
      capabilities: this.extractCapabilities(),
      manifest: this.manifest
    };
  }

  protected async doSchema(context: Context): Promise<SchemaResult> {
    return {
      schema: JSON.stringify(this.manifest, null, 2),
      format: 'json'
    };
  }

  protected async doQuery(context: Context): Promise<QueryResult> {
    throw new Error('Query not supported for remote MFE type');
  }

  protected async doEmit(context: Context): Promise<EmitResult> {
    if (this.deps?.telemetry) {
      const event = context.inputs?.event;
      if (event) {
        this.deps.telemetry.emit(event as any);
        return {
          emitted: true,
          eventId: 'generated-event-id'
        };
      }
    }
    return {
      emitted: false
    };
  }
}
