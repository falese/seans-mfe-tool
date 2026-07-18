/// <reference lib="dom" />
/**
 * AngularRemoteMFE — Angular 17+/webpack adapter over BaseRemoteMFE.
 *
 * All framework-neutral lifecycle (load / render / manifest introspection /
 * capability handlers / control-plane messaging) lives in BaseRemoteMFE, with
 * telemetry checkpoint names identical to RemoteMFE so platform consumers stay
 * framework-agnostic. This file supplies only what is Angular-specific
 * (ADR-036):
 *   • getSharedDependencies() — Angular singletons + zone.js for the MF scope
 *   • mountComponent()        — bootstrapApplication() of a standalone component
 *   • unmount()               — destroy the ApplicationRef
 *   • doQuery()               — Angular remotes do not support query
 *
 * Implements:
 * - REQ-RUNTIME-001: Load capability with atomic entry/mount/enable-render
 * - REQ-RUNTIME-004: Render capability with component awareness
 * - REQ-RUNTIME-012: Telemetry emission at all checkpoints
 */

import { BaseRemoteMFE } from './base-remote-mfe';
import type { Context, QueryResult } from './base-mfe';

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
  /** ApplicationRef.bootstrap(componentType, rootElement) — binds to the given node. */
  bootstrap(component: unknown, rootElement?: Element): unknown;
  /** The app's injector — used to fetch its NgZone. */
  injector: { get(token: unknown): { run<T>(fn: () => T): T } };
  components: ReadonlyArray<{
    instance: Record<string, unknown>;
    /** Angular ≥14.1 ComponentRef.setInput — fires ngOnChanges for declared inputs. */
    setInput?(name: string, value: unknown): void;
  }>;
}

/**
 * AngularRemoteMFE class for Angular Module Federation remotes
 *
 * Mounts standalone components via bootstrapApplication() from
 * @angular/platform-browser. Tracks an ApplicationRef per containerId so
 * re-renders destroy and re-bootstrap cleanly.
 */
export class AngularRemoteMFE extends BaseRemoteMFE {
  /** ApplicationRefs keyed by containerId — destroyed on re-render or unmount */
  private applicationRefs: Map<string, AngularApplicationRef> = new Map();

  /**
   * Get shared dependencies for Module Federation (Angular singletons).
   *
   * Angular requires singleton + strictVersion across host + remotes — two
   * @angular/core instances cause "Two copies of Angular" runtime errors.
   * zone.js loads eagerly because Angular bootstrap is zone-dependent and
   * must be available synchronously.
   */
  protected getSharedDependencies(): Record<string, any> {
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

    // Bootstrap bound to THIS container's host element. bootstrapApplication
    // is selector-driven — it binds to the FIRST matching selector in the
    // whole document, which collapses multi-instance composition (six keyed
    // BerthTiles would all bootstrap onto slot one's element). createApplication
    // + ApplicationRef.bootstrap(Component, hostElement) targets the exact node.
    element.innerHTML = '';
    const host = (document as Document).createElement(selector);
    element.appendChild(host);

    // @ts-ignore — @angular/platform-browser types not in root tsconfig; browser-only code
    const { createApplication } = await import('@angular/platform-browser');
    // @ts-ignore — @angular/core types not in root tsconfig; browser-only code
    const { NgZone } = await import('@angular/core');
    const appRef: AngularApplicationRef = await createApplication({ providers: [] });

    // Everything the component does must happen INSIDE the app's NgZone:
    // manual bootstrap() runs from host code (outside any zone), and a
    // component initialized out-of-zone never gets change detection when
    // its async work (fetches in ngOnInit/ngOnChanges) settles.
    const zone = appRef.injector.get(NgZone);
    zone.run(() => appRef.bootstrap(Component, host as unknown as Element));

    // Apply props to the bootstrapped instance. bootstrap() has already run
    // the first change-detection pass (ngOnInit saw defaults), so declared
    // inputs must go through ComponentRef.setInput — it fires ngOnChanges,
    // letting components react to registry-injected props (e.g. BerthTile's
    // berthId). Props that are not @Input()s — helper callbacks like
    // provideSlot — make setInput throw; those fall back to plain assignment,
    // matching the previous behavior.
    const root = appRef.components[0];
    if (root && root.instance && props) {
      zone.run(() => {
        for (const [key, value] of Object.entries(props)) {
          if (typeof root.setInput === 'function') {
            try {
              root.setInput(key, value);
              continue;
            } catch {
              // Not a declared input — assign directly below.
            }
          }
          (root.instance as Record<string, unknown>)[key] = value;
        }
        appRef.tick();
      });
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

  protected override async doQuery(context: Context): Promise<QueryResult> {
    void context;
    throw new Error('Query not supported for remote MFE type');
  }
}
