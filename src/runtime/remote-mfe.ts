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
import type { DSLManifest } from '../dsl/schema';

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
      telemetry.entry.start = new Date();
      
      if (this.deps?.telemetry) {
        this.deps.telemetry.emit({
          eventType: 'info',
          eventData: { phase: 'entry', capability: 'load', mfe: this.manifest.name },
          severity: 'info',
          tags: ['load', 'entry', 'start'],
          timestamp: new Date(),
          mfe: this.manifest.name
        });
      }

      // Get remote entry URL from context or manifest
      const remoteEntry = context.inputs?.remoteEntry as string || this.manifest.remoteEntry;
      if (!remoteEntry) {
        throw new Error('Remote entry URL not provided in context.inputs or manifest');
      }

      // Fetch container (in real implementation, this would use Module Federation runtime)
      this.container = await this.fetchContainer(remoteEntry);
      
      telemetry.entry.duration = Date.now() - entryStart;
      
      if (this.deps?.telemetry) {
        this.deps.telemetry.emit({
          eventType: 'metric',
          eventData: { 
            phase: 'entry', 
            capability: 'load', 
            mfe: this.manifest.name,
            duration: telemetry.entry.duration 
          },
          severity: 'info',
          tags: ['load', 'entry', 'duration'],
          timestamp: new Date(),
          mfe: this.manifest.name
        });
      }

      // Phase 2: Mount - Initialize container and wire shared dependencies
      const mountStart = Date.now();
      telemetry.mount.start = new Date();
      
      if (this.deps?.telemetry) {
        this.deps.telemetry.emit({
          eventType: 'info',
          eventData: { phase: 'mount', capability: 'load', mfe: this.manifest.name },
          severity: 'info',
          tags: ['load', 'mount', 'start'],
          timestamp: new Date(),
          mfe: this.manifest.name
        });
      }

      // Initialize container with shared dependencies
      const sharedDeps = this.getSharedDependencies();
      await this.container.init(sharedDeps);
      
      // Extract available components from manifest
      this.availableComponents = this.extractAvailableComponents();
      
      telemetry.mount.duration = Date.now() - mountStart;
      
      if (this.deps?.telemetry) {
        this.deps.telemetry.emit({
          eventType: 'metric',
          eventData: { 
            phase: 'mount', 
            capability: 'load', 
            mfe: this.manifest.name,
            duration: telemetry.mount.duration,
            componentsCount: this.availableComponents.length
          },
          severity: 'info',
          tags: ['load', 'mount', 'duration'],
          timestamp: new Date(),
          mfe: this.manifest.name
        });
      }

      // Phase 3: Enable-render - Prepare MFE state for render phase
      const enableRenderStart = Date.now();
      telemetry.enableRender.start = new Date();
      
      if (this.deps?.telemetry) {
        this.deps.telemetry.emit({
          eventType: 'info',
          eventData: { phase: 'enable_render', capability: 'load', mfe: this.manifest.name },
          severity: 'info',
          tags: ['load', 'enable_render', 'start'],
          timestamp: new Date(),
          mfe: this.manifest.name
        });
      }

      // Prepare render state (validate components, prepare metadata)
      const capabilities = this.extractCapabilities();
      
      telemetry.enableRender.duration = Date.now() - enableRenderStart;
      
      if (this.deps?.telemetry) {
        this.deps.telemetry.emit({
          eventType: 'metric',
          eventData: { 
            phase: 'enable_render', 
            capability: 'load', 
            mfe: this.manifest.name,
            duration: telemetry.enableRender.duration
          },
          severity: 'info',
          tags: ['load', 'enable_render', 'duration'],
          timestamp: new Date(),
          mfe: this.manifest.name
        });
      }

      // Emit completion telemetry
      const totalDuration = Date.now() - startTime;
      if (this.deps?.telemetry) {
        this.deps.telemetry.emit({
          eventType: 'metric',
          eventData: { 
            phase: 'completed', 
            capability: 'load', 
            mfe: this.manifest.name,
            duration: totalDuration,
            success: true
          },
          severity: 'info',
          tags: ['load', 'completed'],
          timestamp: new Date(),
          mfe: this.manifest.name
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
      // Emit error telemetry
      if (this.deps?.telemetry) {
        this.deps.telemetry.emit({
          eventType: 'error',
          eventData: { 
            phase: 'error', 
            capability: 'load', 
            mfe: this.manifest.name,
            error: (error as Error).message
          },
          severity: 'error',
          tags: ['load', 'error'],
          timestamp: new Date(),
          mfe: this.manifest.name
        });
      }

      return {
        status: 'error',
        timestamp: new Date(),
        duration: Date.now() - startTime,
        error: error as Error,
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
          eventType: 'info',
          eventData: { 
            phase: 'render_start', 
            capability: 'render', 
            mfe: this.manifest.name,
            component: componentName
          },
          severity: 'info',
          tags: ['render', 'start'],
          timestamp: new Date(),
          mfe: this.manifest.name
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
          eventType: 'metric',
          eventData: { 
            phase: 'component_fetch', 
            capability: 'render', 
            mfe: this.manifest.name,
            component: componentName,
            duration: renderDuration
          },
          severity: 'info',
          tags: ['render', 'component_fetch', 'duration'],
          timestamp: new Date(),
          mfe: this.manifest.name
        });
      }

      // Mount component to DOM
      const mountStart = Date.now();
      const element = await this.mountComponent(Component, props, containerId);
      const mountDuration = Date.now() - mountStart;

      // Telemetry: Mount duration
      if (this.deps?.telemetry) {
        this.deps.telemetry.emit({
          eventType: 'metric',
          eventData: { 
            phase: 'mount', 
            capability: 'render', 
            mfe: this.manifest.name,
            component: componentName,
            duration: mountDuration
          },
          severity: 'info',
          tags: ['render', 'mount', 'duration'],
          timestamp: new Date(),
          mfe: this.manifest.name
        });
      }

      const totalDuration = Date.now() - startTime;

      // Telemetry: Render completed
      if (this.deps?.telemetry) {
        this.deps.telemetry.emit({
          eventType: 'metric',
          eventData: { 
            phase: 'completed', 
            capability: 'render', 
            mfe: this.manifest.name,
            component: componentName,
            duration: totalDuration,
            success: true
          },
          severity: 'info',
          tags: ['render', 'completed'],
          timestamp: new Date(),
          mfe: this.manifest.name
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
          eventType: 'error',
          eventData: { 
            phase: 'error', 
            capability: 'render', 
            mfe: this.manifest.name,
            error: (error as Error).message
          },
          severity: 'error',
          tags: ['render', 'error'],
          timestamp: new Date(),
          mfe: this.manifest.name
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
        console.log('[RemoteMFE] Container initialized with shared deps:', Object.keys(shared));
      },
      get: async (module: string) => {
        // Return a factory function for the requested module
        console.log('[RemoteMFE] Fetching module:', module);
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
    // Extract from manifest.exposes or manifest.capabilities
    if (this.manifest.exposes) {
      return Object.keys(this.manifest.exposes);
    }
    
    // Fallback: extract from capabilities
    const renderCapability = this.manifest.capabilities?.find(
      (cap: any) => cap.name === 'render'
    );
    
    if (renderCapability?.components) {
      return renderCapability.components;
    }
    
    return [];
  }

  /**
   * Extract capability metadata from manifest
   */
  private extractCapabilities(): Array<{ name: string; available: boolean; requiresAuth?: boolean; requiresValidation?: boolean }> {
    if (!this.manifest.capabilities) {
      return [];
    }

    return this.manifest.capabilities.map((cap: any) => ({
      name: cap.name,
      available: true,
      requiresAuth: cap.requiresAuth,
      requiresValidation: cap.requiresValidation
    }));
  }

  /**
   * Mount React component to DOM using React 18 createRoot
   */
  private async mountComponent(Component: any, props: Record<string, any>, containerId: string): Promise<HTMLElement> {
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
    
    console.log('[RemoteMFE] Component mounted:', { Component, props, containerId });
    
    return element;
  }

  // =========================================================================
  // Other Required Abstract Methods
  // =========================================================================

  protected async doRefresh(context: Context): Promise<void> {
    // Refresh MFE data/state
    console.log('[RemoteMFE] Refresh called');
  }

  protected async doAuthorizeAccess(context: Context): Promise<boolean> {
    // Check authorization
    return true;
  }

  protected async doHealth(context: Context): Promise<HealthResult> {
    return {
      status: 'healthy',
      checks: {
        container: this.container !== null,
        componentsAvailable: this.availableComponents.length > 0
      },
      timestamp: new Date()
    };
  }

  protected async doDescribe(context: Context): Promise<DescribeResult> {
    return {
      name: this.manifest.name,
      version: this.manifest.version,
      type: this.manifest.type,
      capabilities: this.extractCapabilities(),
      timestamp: new Date()
    };
  }

  protected async doSchema(context: Context): Promise<SchemaResult> {
    return {
      schema: this.manifest,
      timestamp: new Date()
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
      }
    }
    return {
      emitted: true,
      timestamp: new Date()
    };
  }
}
