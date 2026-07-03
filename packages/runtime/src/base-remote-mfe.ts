/// <reference lib="dom" />
/**
 * BaseRemoteMFE — framework-neutral Module Federation remote lifecycle.
 *
 * Holds everything RemoteMFE (React/rspack) and AngularRemoteMFE (Angular/
 * webpack) share: the atomic load lifecycle (entry → mount → enable-render)
 * with its telemetry checkpoints, the component-aware render flow, manifest
 * introspection (extractAvailableComponents / extractCapabilities), and the
 * neutral capability handlers (health / describe / schema / emit /
 * updateControlPlaneState). Telemetry event names are identical across
 * frameworks so platform consumers stay framework-agnostic.
 *
 * Framework knowledge is quarantined behind three abstract members that each
 * concrete subclass provides — the ADR-036 framework-plugin model:
 *   • getSharedDependencies() — the Module Federation shared-scope map
 *   • mountComponent()        — mount a loaded component to the DOM
 *   • unmount()               — tear down a mounted component
 *
 * This file is deliberately framework-free (no React / Angular imports) and is
 * scanned by the ADR-056 boundary test.
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
  EmitResult,
  ControlPlaneStateResult,
  type CapabilityMetadata,
  type TelemetryEvent,
} from './base-mfe';
import { buildMessage } from '@seans-mfe/contracts';
import type { ActionRecord } from '@seans-mfe/contracts';

/**
 * Validate and narrow the inputs required by updateControlPlaneState.
 * Throws on malformed input (programming error, not a network condition).
 */
function validateStateUpdateInputs(inputs: Record<string, unknown> | undefined): {
  stateKey: string;
  stateData: Record<string, unknown>;
  correlationId?: string;
} {
  const rawStateKey = inputs?.stateKey;
  const rawStateData = inputs?.stateData;
  const rawCorrelationId = inputs?.correlationId;

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

  return {
    stateKey: rawStateKey.trim(),
    stateData: (rawStateData ?? {}) as Record<string, unknown>,
    correlationId: (rawCorrelationId as string | undefined)?.trim(),
  };
}

/**
 * Module Federation container interface
 */
export interface ModuleFederationContainer {
  init(shared: Record<string, unknown>): Promise<void>;
  get(module: string): Promise<() => unknown>;
}

/**
 * Framework-neutral base for Module Federation remotes.
 *
 * Concrete subclasses implement the load/render lifecycle for a specific UI
 * framework by overriding only the three abstract members below.
 */
export abstract class BaseRemoteMFE extends BaseMFE {
  protected container: ModuleFederationContainer | null = null;
  protected availableComponents: string[] = [];
  protected mountedComponent: {
    component: string;
    element: unknown;
    props: Record<string, unknown>;
  } | null = null;
  /** ID of the currently mounted component; used as actionRecord.componentId */
  protected currentComponentId: string | null = null;

  // ==========================================================================
  // Framework-specific surface (ADR-036) — implemented by each subclass
  // ==========================================================================

  /**
   * The Module Federation shared-scope map for this framework (e.g. React
   * singletons vs Angular singletons + zone.js). Wired into container.init().
   */
  protected abstract getSharedDependencies(): Record<string, unknown>;

  /**
   * Mount a loaded component into the DOM container and return the host element.
   * Called by doRender() after the component is resolved.
   */
  protected abstract mountComponent(
    Component: unknown,
    props: Record<string, unknown>,
    containerId: string
  ): Promise<unknown>;

  /**
   * Tear down a previously rendered component and release its mount handle.
   * Call from the shell's lifecycle cleanup to avoid memory leaks.
   */
  public abstract unmount(containerId: string): void;

  /**
   * Emit a telemetry event with the standard shape shared by every checkpoint
   * in doLoad()/doRender(): `metadata.mfe` is always set, extra metadata is
   * merged in, and `duration` is set at the top level only when provided.
   * No-ops when no telemetry service is injected.
   */
  protected emitTelemetry(
    name: string,
    capability: string,
    phase: string,
    status: TelemetryEvent['status'],
    extra?: { duration?: number; metadata?: Record<string, unknown> }
  ): void {
    this.deps?.telemetry?.emit({
      name,
      capability,
      phase,
      status,
      metadata: { mfe: this.manifest.name, ...(extra?.metadata ?? {}) },
      timestamp: new Date(),
      ...(extra?.duration !== undefined ? { duration: extra.duration } : {}),
    });
  }

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
    const telemetry: NonNullable<LoadResult['telemetry']> = {
      entry: { start: new Date(), duration: 0 },
      mount: { start: new Date(), duration: 0 },
      enableRender: { start: new Date(), duration: 0 },
    };

    try {
      // Phase 1: Entry - Fetch Module Federation remote entry
      const entryStart = Date.now();
      telemetry.entry = { start: new Date(), duration: 0 };
      this.emitTelemetry('load-entry', 'load', 'entry', 'start');

      // Get remote entry URL from context or manifest
      const remoteEntry = (context.inputs?.remoteEntry as string) || this.manifest.remoteEntry;
      if (!remoteEntry) {
        throw new Error('Remote entry URL not provided in context.inputs or manifest');
      }

      // Fetch container (in real implementation, this would use Module Federation runtime)
      this.container = await this.fetchContainer(remoteEntry);

      telemetry.entry.duration = Date.now() - entryStart;
      this.emitTelemetry('load-entry-metric', 'load', 'entry', 'success', {
        duration: telemetry.entry.duration,
        metadata: { duration: telemetry.entry.duration },
      });

      // Phase 2: Mount - Initialize container and wire shared dependencies
      const mountStart = Date.now();
      telemetry.mount = { start: new Date(), duration: 0 };
      this.emitTelemetry('load-mount', 'load', 'mount', 'start');

      // Initialize container with shared dependencies
      const sharedDeps = this.getSharedDependencies();
      await this.container.init(sharedDeps);

      // Extract available components from manifest
      this.availableComponents = this.extractAvailableComponents();

      telemetry.mount.duration = Date.now() - mountStart;
      this.emitTelemetry('load-mount-metric', 'load', 'mount', 'success', {
        duration: telemetry.mount.duration,
        metadata: {
          duration: telemetry.mount.duration,
          componentsCount: this.availableComponents.length,
        },
      });

      // Phase 3: Enable-render - Prepare MFE state for render phase
      const enableRenderStart = Date.now();
      telemetry.enableRender = { start: new Date(), duration: 0 };
      this.emitTelemetry('load-enable-render', 'load', 'enable_render', 'start');

      // Prepare render state (validate components, prepare metadata)
      const capabilities = this.extractCapabilities();

      telemetry.enableRender.duration = Date.now() - enableRenderStart;
      this.emitTelemetry('load-enable-render-metric', 'load', 'enable_render', 'success', {
        duration: telemetry.enableRender.duration,
        metadata: { duration: telemetry.enableRender.duration },
      });

      const totalDuration = Date.now() - startTime;
      this.emitTelemetry('load-completed', 'load', 'completed', 'success', {
        duration: totalDuration,
        metadata: { success: true },
      });

      // Populate context outputs
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
      const err = error as Error;
      this.emitTelemetry('load-error', 'load', 'error', 'error', {
        metadata: { error: err.message },
      });

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
   * Implement render logic for Module Federation remote
   *
   * REQ-RUNTIME-004: Component-aware rendering with:
   * - Component selection from available components
   * - Props validation and passing
   * - Error boundary integration
   * - DOM mounting delegated to the framework-specific mountComponent()
   */
  protected async doRender(context: Context): Promise<RenderResult> {
    const startTime = Date.now();

    try {
      // Extract render parameters from context
      const componentName = context.inputs?.component as string;
      const props = (context.inputs?.props as Record<string, unknown>) || {};
      const containerId = context.inputs?.containerId as string;

      if (!componentName) {
        throw new Error('Component name not provided in context.inputs.component');
      }

      if (!containerId) {
        throw new Error('Container ID not provided in context.inputs.containerId');
      }

      this.emitTelemetry('render-start', 'render', 'render_start', 'start', {
        metadata: { component: componentName },
      });

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

      // Load component directly via loadDomainComponent (implemented by subclass)
      const renderStart = Date.now();
      const Component = await this.loadDomainComponent(componentName);

      const renderDuration = Date.now() - renderStart;
      this.emitTelemetry('render-component-fetch', 'render', 'component_fetch', 'success', {
        duration: renderDuration,
        metadata: { component: componentName },
      });

      // Mount component to DOM
      const mountStart = Date.now();
      const element = await this.mountComponent(Component, props, containerId);
      const mountDuration = Date.now() - mountStart;
      this.emitTelemetry('render-mount', 'render', 'mount', 'success', {
        duration: mountDuration,
        metadata: { component: componentName },
      });

      const totalDuration = Date.now() - startTime;
      this.emitTelemetry('render-completed', 'render', 'completed', 'success', {
        duration: totalDuration,
        metadata: { component: componentName, success: true },
      });

      // Store mounted component reference
      this.mountedComponent = { component: componentName, element, props };
      this.currentComponentId = componentName;

      // Populate context outputs
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
      this.emitTelemetry('render-error', 'render', 'error', 'error', {
        metadata: { error: (error as Error).message },
      });

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
   * Stubbed for now — a real implementation loads remoteEntry.js, initializes
   * the federation shared scope, and returns the container interface. The
   * webpack/rspack federation runtimes are structurally compatible here.
   */
  protected async fetchContainer(remoteEntry: string): Promise<ModuleFederationContainer> {
    void remoteEntry;
    return {
      init: async (shared: Record<string, unknown>) => {
        // Initialize with shared dependencies
        void shared; // Module Federation shared scope
      },
      get: async (module: string) => {
        // Return a factory function for the requested module
        void module;
        return () => ({
          default: class MockComponent {},
        });
      },
    };
  }

  /**
   * Extract available components from manifest.
   *
   * Primary:  render.components array when explicitly declared.
   * Fallback: all non-platform capability names (domain capabilities).
   *           This allows MFEs to work without a render capability block
   *           while still exposing their domain features as mountable components.
   */
  protected extractAvailableComponents(): string[] {
    if (!this.manifest.capabilities) {
      return [];
    }

    // Primary: explicit render.components list
    for (const capEntry of this.manifest.capabilities) {
      if (capEntry.render) {
        const components = (capEntry.render as unknown as { components?: string[] }).components;
        if (Array.isArray(components) && components.length > 0) {
          return components;
        }
      }
    }

    // Fallback: collect domain capability names (everything that is not a platform capability)
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
      // Also handle the PascalCase variants used as capability entry keys in YAML
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
  protected extractCapabilities(): CapabilityMetadata[] {
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
   * Override in subclass to load the named domain component.
   * Called by doRender() instead of going through the Module Federation container API.
   */
  protected async loadDomainComponent(_name: string): Promise<unknown> {
    throw new Error(
      '[BaseRemoteMFE] loadDomainComponent() not implemented — subclass must override this method'
    );
  }

  // =========================================================================
  // Other Required Abstract Methods (framework-neutral)
  // =========================================================================

  protected async doRefresh(_context: Context): Promise<void> {
    // TODO: implement refresh — fetch updated data and re-render
  }

  protected async doAuthorizeAccess(_context: Context): Promise<boolean> {
    // Check authorization
    return true;
  }

  protected async doHealth(_context: Context): Promise<HealthResult> {
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

  protected async doDescribe(_context: Context): Promise<DescribeResult> {
    return {
      name: this.manifest.name,
      version: this.manifest.version,
      type: this.manifest.type,
      capabilities: this.extractCapabilities().map((c) => c.name),
      manifest: this.manifest,
    };
  }

  protected async doSchema(_context: Context): Promise<SchemaResult> {
    return {
      schema: JSON.stringify(this.manifest, null, 2),
      format: 'json',
    };
  }

  protected async doEmit(context: Context): Promise<EmitResult> {
    if (this.deps?.telemetry) {
      const event = context.inputs?.event as TelemetryEvent | undefined;
      if (event) {
        this.deps.telemetry.emit(event);
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
   * Module Federation MFEs run in the browser, so this sends a GraphQL mutation
   * over the existing WebSocket connection to the daemon:
   *
   *   mutation SendAction($input: ActionInput!) {
   *     sendAction(input: $input) { correlationId acknowledged }
   *   }
   *
   * The daemon forwards to Registry handleMessage → rules engine re-evaluation.
   * The registry may resolve a new MFE + capability, which arrives via the
   * Subscription.messages channel the Renderer is already subscribed to.
   */
  protected async doUpdateControlPlaneState(context: Context): Promise<ControlPlaneStateResult> {
    // 1. Extract and validate inputs
    const inputs = validateStateUpdateInputs(context.inputs);
    const { stateKey, stateData } = inputs;
    const correlationId = inputs.correlationId ?? context.requestId;

    // 2. Guard: daemon WebSocket must be connected
    const wsClient = this.deps?.wsClient;
    if (!wsClient || !wsClient.connected) {
      return { acknowledged: false, correlationId, error: 'Daemon WebSocket not connected' };
    }

    // 3. Build the Message envelope via the contracts builder.
    //
    // Emit what the registry actually routes on (ADR-057): a canonical
    // STATE_UPDATE actionType plus the stateKey. The registry matches rules on
    // `when.stateKey`; setting actionType: stateKey (and no stateKey field)
    // meant those routes never fired.
    const payload: ActionRecord = {
      id: uuidv4(),
      componentId: this.currentComponentId ?? this.manifest.name,
      actionType: 'STATE_UPDATE',
      stateKey,
      data: stateData,
      timestamp: new Date().toISOString(),
    };
    const envelope = buildMessage({ direction: 'ACTION', kind: 'ACTION', payload, correlationId });

    // 4. Send via the daemon's sendMessage GraphQL mutation (WS subscribe/next)
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

    // 5. Telemetry
    this.emitTelemetry(
      'control-plane-state-update',
      'updateControlPlaneState',
      'main',
      success ? 'success' : 'error',
      { metadata: { stateKey, correlationId, acknowledged: success } }
    );

    // 6. Return ControlPlaneStateResult
    return {
      acknowledged: success,
      correlationId,
      error: success ? null : 'sendMessage mutation failed',
    };
  }
}
