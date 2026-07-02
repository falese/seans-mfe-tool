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

import { createErrorBoundary } from './error-boundary';
import { BaseRemoteMFE } from './base-remote-mfe';

// Re-exported for consumers that imported the container type from this module.
export type { ModuleFederationContainer } from './base-remote-mfe';

/**
 * RemoteMFE class for React Module Federation remotes.
 *
 * Mounts React components via React 18 createRoot. Tracks a root per
 * containerId so re-renders reuse the root and cleanup unmounts it.
 */
export class RemoteMFE extends BaseRemoteMFE {
  /** React roots keyed by containerId — reused on re-render, unmounted on cleanup */
  private reactRoots: Map<string, any> = new Map();

  /**
   * Get shared dependencies for Module Federation
   */
  protected getSharedDependencies(): Record<string, any> {
    // Return shared dependencies (React, ReactDOM, etc.)
    return {
      react: { version: '18.2.0', singleton: true },
      'react-dom': { version: '18.2.0', singleton: true },
    };
  }

  /**
   * Mount React component to DOM using React 18 createRoot.
   * Reuses an existing root for the containerId when re-rendering.
   */
  protected async mountComponent(
    Component: any,
    props: Record<string, any>,
    containerId: string
  ): Promise<any> {
    if (typeof document === 'undefined') {
      throw new Error('[RemoteMFE] mountComponent called outside a browser environment');
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const element = (document as Document).getElementById(containerId);
    if (!element) {
      throw new Error(`[RemoteMFE] DOM container #${containerId} not found`);
    }

    // Reuse root if one already exists for this container
    let root = this.reactRoots.get(containerId);
    if (!root) {
      // @ts-ignore — react-dom/client types not in root tsconfig; browser-only code
      const { createRoot } = await import('react-dom/client');
      root = createRoot(element);
      this.reactRoots.set(containerId, root);
    }

    // @ts-ignore — react types not in root tsconfig; browser-only code
    const React = await import('react');
    const { createElement } = React;

    // Contain render-time failures within the remote's own root so a crashing
    // remote shows a fallback instead of tearing down the mount (ADR-044).
    const ErrorBoundary = createErrorBoundary(React, (error, info) => {
      console.error('[RemoteMFE] render error in remote component', error, info);
    });
    root.render(createElement(ErrorBoundary, null, createElement(Component, props)));

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
