/**
 * BaseControlPlane — abstract base for all control-plane implementations.
 *
 * The control plane bundles daemon + registry + LayoutManager + DaemonChannels
 * into a single unit. The host provides a container and session context; the
 * control plane drives everything else.
 *
 * Host usage:
 *
 *   const cp = new NodeControlPlane({
 *     container: document.getElementById('app'),
 *     session:   { sessionId, user, jwt },
 *     daemonUrl: 'ws://localhost:3004/graphql', // 3001-3003 belong to MFEs (ADR-055)
 *   });
 *   await cp.start();
 *   await cp.stop();
 *
 * Refs ADR-059.
 */

import { LayoutManager } from './layout-manager';
import type {
  LayoutHostLike,
  ExperienceAdaptor,
  DaemonTransport,
  TransportStatus,
} from './layout-manager';
import type {
  MfeRegistration,
  Resolution,
  ActionRecord,
  SessionContext,
} from '@seans-mfe/contracts';

// ── Supporting types ────────────────────────────────────────────────────────

export type ControlPlaneStatus =
  | 'idle'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'error';

export interface ControlPlaneHealth {
  status: ControlPlaneStatus;
  /** Names of registered MFEs. */
  registered: string[];
  /** Milliseconds since start() completed. Absent when not running. */
  uptime?: number;
}

/**
 * Constructor configuration accepted by every control-plane implementation.
 *
 * Concrete implementations extend this with their own daemon-connection fields
 * (e.g. `daemonUrl` for a remote Node daemon, `binaryPath` for a spawned Rust
 * binary).
 */
export interface ControlPlaneConfig {
  /** Host element (or structural equivalent) LayoutManager mounts into. */
  container: LayoutHostLike;
  /** Session context threaded into every action (user, jwt, locale). */
  session?: SessionContext;
  /**
   * The host shell's framework (e.g. `'react'`).
   * When set, LayoutManager uses ADR-056 handle negotiation: MFEs that expose a
   * matching native handle (e.g. a React component) are composed in-tree with
   * shared context (providers, router, store). Omit for a framework-free host —
   * every MFE then composes via its guaranteed imperative handle (isolation).
   */
  hostFramework?: string;
  /**
   * Host-injected provider values (theme, locale, auth claims, router state, …)
   * delivered to every composed MFE as `props.hostContext` (ADR-060
   * value-injection). The island re-provides its own framework context from
   * these — context reaches the MFE without a shared reconciler.
   */
  providerValues?: Record<string, unknown>;
  /**
   * Custom content-type adaptors merged with the built-in set.
   * Use sparingly — prefer the built-in adaptors (module-federation,
   * text/html, application/json).
   */
  adaptors?: Record<string, ExperienceAdaptor>;
  /** Called when the daemon transport status changes. */
  onStatus?: (status: TransportStatus) => void;
  /** Called when LayoutManager encounters a mounting error. */
  onError?: (message: string) => void;
}

// ── Abstract base ───────────────────────────────────────────────────────────

/**
 * Abstract base every control-plane implementation must extend.
 *
 * Mirrors BaseMFE / BaseCommand / BaseFrameworkPlugin: the base owns the shape
 * (lifecycle, registry surface, LayoutManager wiring); the concrete class owns
 * the how (spawn vs connect, Node vs Rust vs mock).
 */
export abstract class BaseControlPlane {
  /**
   * Brand tag for cross-module instanceof checks.
   * Concrete repos import BaseControlPlane from the runtime package; if the
   * same class appears at two different physical paths (e.g. npm link), a
   * string brand lets us duck-type safely.
   */
  readonly __controlPlaneBrand = '__BaseControlPlane__' as const;

  private _layoutManager: LayoutManager | null = null;
  private _status: ControlPlaneStatus = 'idle';
  private _startedAt: number | null = null;

  constructor(protected readonly config: ControlPlaneConfig) {}

  // ── Identity ─────────────────────────────────────────────────────────────

  /** Unique id, e.g. `'node-daemon'`, `'rust-daemon'`, `'mock'`. */
  abstract readonly id: string;

  /** Human-readable name for CLI / observability output. */
  abstract readonly displayName: string;

  /** Runtime type tag, e.g. `'node'`, `'rust'`. */
  abstract readonly implementation: string;

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  get status(): ControlPlaneStatus {
    return this._status;
  }

  /**
   * Start the daemon + registry, wire LayoutManager to the configured
   * container, and begin receiving experiences from the control plane.
   *
   * Calls `doStart()` first (concrete implementation starts the daemon),
   * then creates and starts LayoutManager using `createTransport()`.
   */
  async start(): Promise<void> {
    this._status = 'starting';
    try {
      await this.doStart();

      this._layoutManager = new LayoutManager({
        container:      this.config.container,
        transport:      this.createTransport(),
        session:        this.config.session,
        hostFramework:  this.config.hostFramework,
        providerValues: this.config.providerValues,
        adaptors:       this.config.adaptors,
        onStatus:       this.config.onStatus,
        onError:        this.config.onError,
      });
      this._layoutManager.start();

      this._startedAt = Date.now();
      this._status = 'running';
    } catch (err) {
      this._status = 'error';
      throw err;
    }
  }

  /**
   * Tear down LayoutManager then shut down the daemon + registry.
   *
   * Safe to call from any status; no-ops if already stopped.
   */
  async stop(): Promise<void> {
    if (this._status === 'stopped' || this._status === 'idle') return;

    this._status = 'stopping';
    if (this._layoutManager) {
      await this._layoutManager.stop();
      this._layoutManager = null;
    }
    await this.doStop();
    this._startedAt = null;
    this._status = 'stopped';
  }

  // ── Registry ──────────────────────────────────────────────────────────────

  /** Register an MFE with the control plane's registry. */
  abstract register(mfe: MfeRegistration): Promise<void>;

  /** Remove an MFE from the registry. */
  abstract unregister(name: string): Promise<void>;

  /**
   * Ask the registry to resolve an action to an experience.
   * Exposed for testing and tooling; in production the daemon calls this
   * internally as part of the action → resolution → render flow.
   */
  abstract resolve(action: ActionRecord): Promise<Resolution>;

  /** Return current health of the daemon, registry, and registered MFEs. */
  abstract health(): Promise<ControlPlaneHealth>;

  // ── Transport ─────────────────────────────────────────────────────────────

  /**
   * Return a DaemonTransport that LayoutManager uses to receive experiences
   * and send actions. Called once inside start(); not intended for host use.
   */
  abstract createTransport(): DaemonTransport;

  // ── Implementation hooks ──────────────────────────────────────────────────

  /**
   * Start the underlying daemon and registry.
   * Called by start() before LayoutManager is wired.
   * Concrete implementations may either spawn a subprocess or connect to
   * an already-running service — the abstract interface does not prescribe which.
   */
  protected abstract doStart(): Promise<void>;

  /**
   * Shut down the underlying daemon and registry.
   * Called by stop() after LayoutManager has been torn down.
   */
  protected abstract doStop(): Promise<void>;

  // ── Introspection ─────────────────────────────────────────────────────────

  /** Names of currently active layout slots. Empty when not running. */
  get activeSlots(): string[] {
    return this._layoutManager?.activeSlots ?? [];
  }

  /** Milliseconds since start() completed. Undefined when not running. */
  get uptime(): number | undefined {
    return this._startedAt != null ? Date.now() - this._startedAt : undefined;
  }
}

// ── Guard ────────────────────────────────────────────────────────────────────

export function isBaseControlPlane(value: unknown): value is BaseControlPlane {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<string, unknown>).__controlPlaneBrand === '__BaseControlPlane__'
  );
}
