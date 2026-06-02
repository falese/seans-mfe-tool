/// <reference lib="dom" />
/**
 * AngularRemoteMFE Implementation
 * Concrete implementation of BaseMFE for Angular 17+ standalone-component
 * Module Federation remotes that build with webpack 5.
 *
 * Sibling of RemoteMFE — same load lifecycle (atomic entry/mount/enable-render
 * with identical telemetry checkpoint names) but Angular-specific shared deps
 * and render/mount via bootstrapApplication().
 *
 * Implements:
 * - REQ-RUNTIME-001: Load capability with atomic entry/mount/enable-render
 * - REQ-RUNTIME-004: Render capability with component awareness
 * - REQ-RUNTIME-012: Telemetry emission at all checkpoints
 */

import { uuidv4 } from './util/uuid';
import {
  BaseMFE,
  LoadResult,
  RenderResult,
  Context,
  HealthResult,
  DescribeResult,
  SchemaResult,
  QueryResult,
  EmitResult,
  ControlPlaneStateResult,
  type CapabilityMetadata,
} from './base-mfe';
import type { Message, ActionRecord, MessageMetadata } from './contracts';
import type { ModuleFederationContainer } from './remote-mfe';

/**
 * Minimal Angular ApplicationRef surface the runtime depends on.
 *
 * We avoid importing from '@angular/core' at module scope to keep this file
 * loadable in non-Angular contexts (the contract tests, BFF runtime, etc.).
 * The real @angular/core ApplicationRef is structurally compatible.
 */
export interface AngularApplicationRef {
  destroy(): void;
  tick(): void;
  components: ReadonlyArray<{ instance: Record<string, unknown> }>;
}

/**
 * AngularRemoteMFE class for Angular Module Federation remotes
 *
 * Mounts standalone components via bootstrapApplication() from
 * @angular/platform-browser. Tracks an ApplicationRef per containerId so
 * re-renders destroy and re-bootstrap cleanly.
 */
export class AngularRemoteMFE extends BaseMFE {
  private container: ModuleFederationContainer | null = null;
  private availableComponents: string[] = [];
  private mountedComponent: any = null;
  /** ID of the currently mounted component; used as actionRecord.componentId */
  private currentComponentId: string | null = null;
  /** ApplicationRefs keyed by containerId — destroyed on re-render or unmount */
  private applicationRefs: Map<string, AngularApplicationRef> = new Map();

  /**
   * Implement load logic for Module Federation remote
   *
   * REQ-RUNTIME-001: Atomic operation with three phases:
   * 1. Entry: Fetch remote entry + container
   * 2. Mount: Initialize container, wire shared deps
   * 3. Enable-render: Prepare MFE state for render phase
   *
   * Telemetry event names match RemoteMFE so platform consumers stay framework-agnostic.
   */
  protected async doLoad(context: Context): Promise<LoadResult> {
    const startTime = Date.now();
    const telemetry: LoadResult['telemetry'] = {
      entry: { start: new Date(), duration: 0 },
      mount: { start: new Date(), duration: 0 },
      enableRender: { start: new Date(), duration: 0 },
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
          timestamp: new Date(),
        });
      }

      const remoteEntry = (context.inputs?.remoteEntry as string) || this.manifest.remoteEntry;
      if (!remoteEntry) {
        throw new Error('Remote entry URL not provided in context.inputs or manifest');
      }

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
            duration: (telemetry as any).entry.duration,
          },
          timestamp: new Date(),
          duration: (telemetry as any).entry.duration,
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
          timestamp: new Date(),
        });
      }

      const sharedDeps = this.getSharedDependencies();
      await this.container.init(sharedDeps);

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
            componentsCount: this.availableComponents.length,
          },
          timestamp: new Date(),
          duration: (telemetry as any).mount.duration,
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
          timestamp: new Date(),
        });
      }

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
            duration: (telemetry as any).enableRender.duration,
          },
          timestamp: new Date(),
          duration: (telemetry as any).enableRender.duration,
        });
      }

      const totalDuration = Date.now() - startTime;
      if (this.deps?.telemetry) {
        this.deps.telemetry.emit({
          name: 'load-completed',
          capability: 'load',
          phase: 'completed',
          status: 'success',
          metadata: {
            mfe: this.manifest.name,
            success: true,
          },
          timestamp: new Date(),
          duration: totalDuration,
        });
      }

      context.outputs = {
        container: this.container,
        manifest: this.manifest,
        availableComponents: this.availableComponents,
        capabilities,
      };

      return {
        status: 'loaded',
        container: this.container,
        manifest: this.manifest,
        availableComponents: this.availableComponents,
        capabilities,
        timestamp: new Date(),
        duration: totalDuration,
        telemetry,
      };
    } catch (error) {
      if (this.deps?.telemetry) {
        this.deps.telemetry.emit({
          name: 'load-error',
          capability: 'load',
          phase: 'error',
          status: 'error',
          metadata: {
            mfe: this.manifest.name,
            error: (error as Error).message,
          },
          timestamp: new Date(),
        });
      }

      const err = error as Error;
      return {
        status: 'error',
        timestamp: new Date(),
        duration: Date.now() - startTime,
        error: {
          message: err.message ?? String(err),
          phase: 'entry',
          retryCount: 0,
          retryable: true,
        },
        telemetry,
      };
    }
  }

  /**
   * Implement render logic for Angular Module Federation remote
   *
   * REQ-RUNTIME-004: Component-aware rendering with:
   * - Component selection from available components
   * - Props applied as @Input() fields on the bootstrapped instance
   * - Error boundary integration
   * - DOM mounting with Angular bootstrapApplication()
   */
  protected async doRender(context: Context): Promise<RenderResult> {
    const startTime = Date.now();

    try {
      const componentName = context.inputs?.component as string;
      const props = (context.inputs?.props as Record<string, any>) || {};
      const containerId = context.inputs?.containerId as string;

      if (!componentName) {
        throw new Error('Component name not provided in context.inputs.component');
      }

      if (!containerId) {
        throw new Error('Container ID not provided in context.inputs.containerId');
      }

      if (this.deps?.telemetry) {
        this.deps.telemetry.emit({
          name: 'render-start',
          capability: 'render',
          phase: 'render_start',
          status: 'start',
          metadata: {
            mfe: this.manifest.name,
            component: componentName,
          },
          timestamp: new Date(),
        });
      }

      if (!this.availableComponents.includes(componentName)) {
        throw new Error(
          `Component "${componentName}" not found in availableComponents: [${this.availableComponents.join(', ')}]`
        );
      }

      if (!this.container) {
        throw new Error('Container not loaded. Call load() before render()');
      }

      const renderStart = Date.now();
      const Component = await this.loadDomainComponent(componentName);

      const renderDuration = Date.now() - renderStart;

      if (this.deps?.telemetry) {
        this.deps.telemetry.emit({
          name: 'render-component-fetch',
          capability: 'render',
          phase: 'component_fetch',
          status: 'success',
          metadata: {
            mfe: this.manifest.name,
            component: componentName,
          },
          timestamp: new Date(),
          duration: renderDuration,
        });
      }

      const mountStart = Date.now();
      const element = await this.mountComponent(Component, props, containerId);
      const mountDuration = Date.now() - mountStart;

      if (this.deps?.telemetry) {
        this.deps.telemetry.emit({
          name: 'render-mount',
          capability: 'render',
          phase: 'mount',
          status: 'success',
          metadata: {
            mfe: this.manifest.name,
            component: componentName,
          },
          timestamp: new Date(),
          duration: mountDuration,
        });
      }

      const totalDuration = Date.now() - startTime;

      if (this.deps?.telemetry) {
        this.deps.telemetry.emit({
          name: 'render-completed',
          capability: 'render',
          phase: 'completed',
          status: 'success',
          metadata: {
            mfe: this.manifest.name,
            component: componentName,
            success: true,
          },
          timestamp: new Date(),
          duration: totalDuration,
        });
      }

      this.mountedComponent = { component: componentName, element, props };
      this.currentComponentId = componentName;

      context.outputs = {
        ...context.outputs,
        component: componentName,
        element,
        renderDuration,
        mountDuration,
      };

      return {
        status: 'rendered',
        component: componentName,
        element,
        timestamp: new Date(),
        duration: totalDuration,
        renderDuration,
        mountDuration,
      };
    } catch (error) {
      if (this.deps?.telemetry) {
        this.deps.telemetry.emit({
          name: 'render-error',
          capability: 'render',
          phase: 'error',
          status: 'error',
          metadata: {
            mfe: this.manifest.name,
            error: (error as Error).message,
          },
          timestamp: new Date(),
        });
      }

      return {
        status: 'error',
        timestamp: new Date(),
        duration: Date.now() - startTime,
        error: error as Error,
      };
    }
  }

  // =========================================================================
  // Helper Methods
  // =========================================================================

  /**
   * Fetch Module Federation container from remote entry.
   *
   * Stubbed identically to RemoteMFE — real impl wires up the webpack federation
   * runtime via __webpack_init_sharing__ / get(name) on window.
   */
  private async fetchContainer(remoteEntry: string): Promise<ModuleFederationContainer> {
    void remoteEntry;
    return {
      init: async (shared: Record<string, any>) => {
        void shared;
      },
      get: async (module: string) => {
        void module;
        return () => ({
          default: class MockComponent {},
        });
      },
    };
  }

  /**
   * Get shared dependencies for Module Federation (Angular singletons).
   *
   * Angular requires singleton + strictVersion across host + remotes — two
   * @angular/core instances cause "Two copies of Angular" runtime errors.
   * zone.js loads eagerly because Angular bootstrap is zone-dependent and
   * must be available synchronously.
   */
  private getSharedDependencies(): Record<string, any> {
    return {
      '@angular/core': { singleton: true, strictVersion: true, requiredVersion: '^19.2.16' },
      '@angular/common': { singleton: true, strictVersion: true, requiredVersion: '^19.2.16' },
      '@angular/platform-browser': {
        singleton: true,
        strictVersion: true,
        requiredVersion: '^19.2.16',
      },
      rxjs: { singleton: true, requiredVersion: '^7.8.0' },
      'zone.js': { singleton: true, eager: true, requiredVersion: '~0.14.0' },
    };
  }

  /**
   * Extract available components from manifest.
   *
   * Primary:  render.components array when explicitly declared.
   * Fallback: all non-platform capability names (domain capabilities).
   */
  private extractAvailableComponents(): string[] {
    if (!this.manifest.capabilities) {
      return [];
    }

    for (const capEntry of this.manifest.capabilities) {
      if (capEntry.render) {
        const components = (capEntry.render as any).components;
        if (Array.isArray(components) && components.length > 0) {
          return components;
        }
      }
    }

    const PLATFORM_CAPABILITY_NAMES = new Set([
      'load',
      'render',
      'refresh',
      'authorizeAccess',
      'health',
      'describe',
      'schema',
      'query',
      'emit',
      'updateControlPlaneState',
      'Load',
      'Render',
      'Refresh',
      'AuthorizeAccess',
      'Health',
      'Describe',
      'Schema',
      'Query',
      'Emit',
      'UpdateControlPlaneState',
    ]);
    const domainComponents: string[] = [];
    for (const capEntry of this.manifest.capabilities) {
      for (const name of Object.keys(capEntry)) {
        if (!PLATFORM_CAPABILITY_NAMES.has(name)) {
          domainComponents.push(name);
        }
      }
    }
    return domainComponents;
  }

  /**
   * Extract capability metadata from manifest (REQ-RUNTIME-003)
   */
  private extractCapabilities(): CapabilityMetadata[] {
    if (!this.manifest.capabilities) {
      return [];
    }

    const result: CapabilityMetadata[] = [];
    for (const capEntry of this.manifest.capabilities) {
      for (const [name, def] of Object.entries(capEntry)) {
        const d = def as { type?: string; description?: string } | undefined;
        result.push({
          name,
          type: d?.type === 'domain' ? 'domain' : 'platform',
          description: d?.description,
        });
      }
    }
    return result;
  }

  /**
   * Mount an Angular standalone component to the DOM via bootstrapApplication().
   *
   * Angular's standalone bootstrap is selector-driven: the platform looks up
   * the component's selector in the DOM and replaces it. We inject the
   * selector tag into the containerId element, then bootstrap.
   *
   * Re-renders destroy the prior ApplicationRef before re-bootstrapping —
   * Angular doesn't expose a simple "update inputs on existing app" idiom
   * for standalone bootstrap. Props are applied to the bootstrapped instance
   * after the initial component is created.
   */
  protected async mountComponent(
    Component: any,
    props: Record<string, any>,
    containerId: string
  ): Promise<any> {
    if (typeof document === 'undefined') {
      throw new Error('[AngularRemoteMFE] mountComponent called outside a browser environment');
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const element = (document as Document).getElementById(containerId);
    if (!element) {
      throw new Error(`[AngularRemoteMFE] DOM container #${containerId} not found`);
    }

    // Destroy any prior bootstrap for this container before re-bootstrapping.
    const existing = this.applicationRefs.get(containerId);
    if (existing) {
      existing.destroy();
      this.applicationRefs.delete(containerId);
    }

    // Resolve the component's selector for the host markup.
    // Angular Component metadata is attached via the ɵcmp static field; fall
    // back to a generic 'app-mfe-root' if the component wasn't decorated.
    const selector = this.resolveSelector(Component) || 'app-mfe-root';
    element.innerHTML = `<${selector}></${selector}>`;

    // @ts-ignore — @angular/platform-browser types not in root tsconfig; browser-only code
    const { bootstrapApplication } = await import('@angular/platform-browser');
    const appRef: AngularApplicationRef = await bootstrapApplication(Component, {
      providers: [],
    });

    // Apply props as @Input() fields on the bootstrapped instance.
    const root = appRef.components[0];
    if (root && root.instance && props) {
      for (const [key, value] of Object.entries(props)) {
        (root.instance as Record<string, unknown>)[key] = value;
      }
      appRef.tick();
    }

    this.applicationRefs.set(containerId, appRef);
    return element;
  }

  /**
   * Resolve an Angular standalone component's selector from its ɵcmp metadata.
   * Returns null if the component wasn't decorated with @Component.
   */
  private resolveSelector(Component: any): string | null {
    const cmp = Component?.ɵcmp;
    if (!cmp) return null;
    // ɵcmp.selectors is an array of selector arrays, e.g. [['app-root']].
    const selectors = cmp.selectors;
    if (Array.isArray(selectors) && Array.isArray(selectors[0]) && selectors[0].length > 0) {
      return String(selectors[0][0]);
    }
    return null;
  }

  /**
   * Override in subclass to load the named domain component.
   * Called by doRender() instead of going through the Module Federation container API.
   */
  protected async loadDomainComponent(_name: string): Promise<any> {
    throw new Error(
      '[AngularRemoteMFE] loadDomainComponent() not implemented — subclass must override this method'
    );
  }

  /**
   * Unmount a previously bootstrapped Angular application for the given container
   * and release the ApplicationRef. Call from the shell's lifecycle cleanup.
   */
  public unmount(containerId: string): void {
    const appRef = this.applicationRefs.get(containerId);
    if (appRef) {
      appRef.destroy();
      this.applicationRefs.delete(containerId);
    }
  }

  // =========================================================================
  // Other Required Abstract Methods
  // =========================================================================

  protected async doRefresh(_context: Context): Promise<void> {
    // TODO: implement refresh — fetch updated data and re-render
  }

  protected async doAuthorizeAccess(context: Context): Promise<boolean> {
    void context;
    return true;
  }

  protected async doHealth(context: Context): Promise<HealthResult> {
    void context;
    return {
      status: 'healthy',
      checks: [
        {
          name: 'container',
          status: this.container !== null ? 'pass' : 'fail',
          message: this.container !== null ? 'Container loaded' : 'Container not loaded',
        },
        {
          name: 'components',
          status: this.availableComponents.length > 0 ? 'pass' : 'fail',
          message: `${this.availableComponents.length} components available`,
        },
      ],
      timestamp: new Date(),
    };
  }

  protected async doDescribe(context: Context): Promise<DescribeResult> {
    void context;
    return {
      name: this.manifest.name,
      version: this.manifest.version,
      type: this.manifest.type,
      capabilities: this.extractCapabilities().map((c) => c.name),
      manifest: this.manifest,
    };
  }

  protected async doSchema(context: Context): Promise<SchemaResult> {
    void context;
    return {
      schema: JSON.stringify(this.manifest, null, 2),
      format: 'json',
    };
  }

  protected override async doQuery(context: Context): Promise<QueryResult> {
    void context;
    throw new Error('Query not supported for remote MFE type');
  }

  protected async doEmit(context: Context): Promise<EmitResult> {
    if (this.deps?.telemetry) {
      const event = context.inputs?.event;
      if (event) {
        this.deps.telemetry.emit(event as any);
        return {
          emitted: true,
          eventId: 'generated-event-id',
        };
      }
    }
    return {
      emitted: false,
    };
  }

  /**
   * Push domain state to the daemon control plane for registry re-evaluation.
   *
   * Framework-agnostic — copied from RemoteMFE. Sends a GraphQL mutation
   * over the existing WebSocket connection to the daemon.
   */
  protected async doUpdateControlPlaneState(context: Context): Promise<ControlPlaneStateResult> {
    const rawStateKey = context.inputs?.stateKey;
    const rawStateData = context.inputs?.stateData;
    const rawCorrelationId = context.inputs?.correlationId;

    if (typeof rawStateKey !== 'string' || rawStateKey.trim().length === 0) {
      throw new Error(
        'updateControlPlaneState requires context.inputs.stateKey to be a non-empty string'
      );
    }

    if (
      rawStateData !== undefined &&
      (typeof rawStateData !== 'object' || rawStateData === null || Array.isArray(rawStateData))
    ) {
      throw new Error(
        'updateControlPlaneState requires context.inputs.stateData to be an object when provided'
      );
    }

    if (
      rawCorrelationId !== undefined &&
      (typeof rawCorrelationId !== 'string' || rawCorrelationId.trim().length === 0)
    ) {
      throw new Error(
        'updateControlPlaneState requires context.inputs.correlationId to be a non-empty string when provided'
      );
    }

    const stateKey = rawStateKey.trim();
    const stateData = (rawStateData ?? {}) as Record<string, unknown>;
    const correlationId = (rawCorrelationId as string | undefined)?.trim() ?? context.requestId;

    const wsClient = this.deps?.wsClient;
    if (!wsClient || !wsClient.connected) {
      return { acknowledged: false, correlationId, error: 'Daemon WebSocket not connected' };
    }

    const metadata: MessageMetadata = {
      correlationId,
      acknowledged: false,
      error: null,
    };

    const payload: ActionRecord = {
      id: uuidv4(),
      componentId: this.currentComponentId ?? this.manifest.name,
      actionType: stateKey,
      data: stateData,
      timestamp: new Date().toISOString(),
    };

    const envelope: Message = {
      direction: 'ACTION',
      kind: 'ACTION',
      payload,
      metadata,
    };

    let success: boolean;
    try {
      success = await wsClient.mutation(
        'mutation sendMessage($m: String!) { sendMessage(message: $m) }',
        { m: JSON.stringify(envelope) },
        4_000
      );
    } catch (err) {
      const message = (err as Error).message ?? 'sendMessage mutation failed';
      const error = message.includes('timed out') ? 'sendMessage timed out' : message;
      return { acknowledged: false, correlationId, error };
    }

    if (this.deps?.telemetry) {
      this.deps.telemetry.emit({
        name: 'control-plane-state-update',
        capability: 'updateControlPlaneState',
        phase: 'main',
        status: success ? 'success' : 'error',
        metadata: { mfe: this.manifest.name, stateKey, correlationId, acknowledged: success },
        timestamp: new Date(),
      });
    }

    return {
      acknowledged: success,
      correlationId,
      error: success ? null : 'sendMessage mutation failed',
    };
  }
}
