/// <reference lib="dom" />
/**
 * RemoteMFE — React/rspack adapter over BaseRemoteMFE.
 *
 * All framework-neutral lifecycle (load / render / manifest introspection /
 * capability handlers / control-plane messaging) lives in BaseRemoteMFE. This
 * file supplies only what is React-specific (ADR-036):
 *   • getSharedDependencies() — React singletons for the MF shared scope
 *   • mountComponent()        — React 18 createRoot + error boundary
 *   • unmount()               — release the React root
 *
 * Implements:
 * - REQ-RUNTIME-001: Load capability with atomic entry/mount/enable-render
 * - REQ-RUNTIME-004: Render capability with component awareness
 * - REQ-RUNTIME-012: Telemetry emission at all checkpoints
 */

import { createErrorBoundary, type FallbackType } from './error-boundary';
import { BaseRemoteMFE } from './base-remote-mfe';
import { SystemError } from '@falese/smt-contracts';

// Re-exported for consumers that imported the container type from this module.
export type { ModuleFederationContainer } from './base-remote-mfe';

/**
 * RemoteMFE class for React Module Federation remotes.
 *
 * Mounts React components via React 18 createRoot. Tracks a root per
 * containerId so re-renders reuse the root and cleanup unmounts it.
 */
/** The subset of react-dom/client's Root surface this file uses. */
interface ReactRootLike {
  render(node: unknown): void;
  unmount(): void;
}

export class RemoteMFE extends BaseRemoteMFE {
  /** React roots keyed by containerId — reused on re-render, unmounted on cleanup */
  private reactRoots: Map<string, ReactRootLike> = new Map();

  /**
   * Get shared dependencies for Module Federation
   */
  protected getSharedDependencies(): Record<string, unknown> {
    // Return shared dependencies (React, ReactDOM, etc.)
    return {
      react: { version: '18.2.0', singleton: true },
      'react-dom': { version: '18.2.0', singleton: true },
    };
  }

  /**
   * Resolve an MFE-supplied fallback component from the federated container.
   *
   * `./ErrorBoundary` is an optional expose: most MFEs do not ship one, and a
   * container that has never heard of it throws or returns nothing. That is
   * the common case, not an error — a remote must not fail to mount because it
   * declined to customise its failure state. Hence the swallow (#247).
   */
  private async resolveMfeFallback(): Promise<unknown> {
    if (!this.container) return undefined;
    try {
      const factory = await this.container.get('./ErrorBoundary');
      if (typeof factory !== 'function') return undefined;
      const module = factory();
      const resolved = (module as { default?: unknown })?.default ?? module;
      return typeof resolved === 'function' ? resolved : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Mount React component to DOM using React 18 createRoot.
   * Reuses an existing root for the containerId when re-rendering.
   */
  protected async mountComponent(
    Component: unknown,
    props: Record<string, unknown>,
    containerId: string
  ): Promise<unknown> {
    if (typeof document === 'undefined') {
      throw new SystemError('[RemoteMFE] mountComponent called outside a browser environment');
    }

    const element = (document as Document).getElementById(containerId);
    if (!element) {
      throw new SystemError(`[RemoteMFE] DOM container #${containerId} not found`);
    }

    // Reuse root if one already exists for this container
    let root = this.reactRoots.get(containerId);
    if (!root) {
      // @ts-ignore — react-dom/client types not in root tsconfig; browser-only code
      const { createRoot } = await import('react-dom/client');
      // createRoot's module is @ts-ignore'd above, so its return type does not
      // narrow `root` out of the `| undefined` it inherits from Map.get().
      root = createRoot(element) as ReactRootLike;
      this.reactRoots.set(containerId, root);
    }

    // @ts-ignore — react types not in root tsconfig; browser-only code
    const React = await import('react');
    const { createElement } = React;

    // Contain render-time failures within the remote's own root so a crashing
    // remote shows a fallback instead of tearing down the mount (ADR-044).
    const mfeFallback = await this.resolveMfeFallback();
    const fallbackType: FallbackType = mfeFallback ? 'mfe-provided' : 'default';
    const ErrorBoundary = createErrorBoundary(
      React,
      (error, info) => {
        console.error('[RemoteMFE] render error in remote component', error, info);
        // The mount itself succeeded, so nothing in the load/render telemetry
        // records that the user is looking at a fallback. This event is the
        // only signal that a remote is up but broken (#247).
        this.emitTelemetry('render-fallback-applied', 'render', 'main', 'error', {
          metadata: {
            error: error instanceof Error ? error.message : String(error),
            fallbackType,
          },
        });
      },
      mfeFallback,
    );
    // Component arrives as `unknown` (the base class's framework-neutral
    // contract); by this point in the mount lifecycle it is guaranteed to be
    // a valid React component type, which is what this cast asserts.
    const ReactComponent = Component as Parameters<typeof createElement>[0];
    root.render(createElement(ErrorBoundary, null, createElement(ReactComponent, props)));

    return element;
  }

  /**
   * Unmount a previously rendered component and release the React root.
   * Call from the shell's useEffect cleanup to avoid memory leaks.
   */
  public unmount(containerId: string): void {
    const root = this.reactRoots.get(containerId);
    if (root) {
      root.unmount();
      this.reactRoots.delete(containerId);
    }
  }
}
