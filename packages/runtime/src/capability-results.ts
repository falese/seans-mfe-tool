/**
 * The return shapes of the ten platform capabilities.
 *
 * The output half of the platform contract (ADR-041): `@seans-mfe/contracts`
 * owns the capability NAMES and their lifecycle rules (ADR-080), and this
 * module owns what each one hands back. Generated MFEs import these types by
 * name to annotate their `do*()` overrides, so they reach developer-owned code
 * through the runtime barrel — renaming one is a breaking change that needs a
 * PLATFORM_MIGRATIONS entry (ADR-082).
 */

import type { Resolution } from '@seans-mfe/contracts';
import type { DSLManifest } from '@seans-mfe/dsl';

// =============================================================================
// Result Types
// =============================================================================

/** Metadata for a single capability declared in the manifest */
export interface CapabilityMetadata {
  name: string;
  type: 'platform' | 'domain';
  description?: string;
}

/** Result from load capability */
export interface LoadResult {
  status: 'loaded' | 'error';
  container?: unknown;
  mesh?: unknown;
  worker?: unknown;
  manifest?: import('@seans-mfe/dsl').DSLManifest;
  availableComponents?: string[];
  capabilities?: CapabilityMetadata[];
  timestamp: Date;
  duration?: number;
  telemetry?: {
    entry: { start: Date; duration: number };
    mount: { start: Date; duration: number };
    enableRender: { start: Date; duration: number };
  };
  error?: {
    message: string;
    /**
     * Which step failed. The subphase names are the atomic main operation
     * (ADR-026); `before` / `after` / `error` are the lifecycle phases around
     * it. A closed set, because the field exists to be branched on.
     */
    phase: 'entry' | 'mount' | 'enable-render' | 'before' | 'after' | 'error';
    retryCount: number;
    retryable: boolean;
  };
}

/** Result from render capability */
export interface RenderResult {
  status: 'rendered' | 'error';
  element?: unknown;    // DOM element or React component
  timestamp: Date;
  [key: string]: unknown;
}

/** Result from health capability */
export interface HealthResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Array<{
    name: string;
    status: 'pass' | 'fail';
    message?: string;
  }>;
  timestamp: Date;
}

/** Result from describe capability */
export interface DescribeResult {
  name: string;
  version: string;
  type: string;
  capabilities: string[];
  manifest: DSLManifest;
}

/** Result from schema capability */
export interface SchemaResult {
  schema: string;  // GraphQL schema or JSON schema
  format: 'graphql' | 'json' | 'openapi';
}

/** Result from query capability */
export interface QueryResult {
  data: unknown;
  errors?: Array<{ message: string; path?: string[] }>;
}

/** Result from emit capability */
export interface EmitResult {
  emitted: boolean;
  eventId?: string;
}

/**
 * Result from updateControlPlaneState capability.
 *
 * Mirrors ControlPlaneStateResult in @seans-mfe/contracts, with `error`
 * optional so implementors of doUpdateControlPlaneState may omit it (the wire
 * form always sets it). The `resolution` shape IS the contracts `Resolution`.
 */
export interface ControlPlaneStateResult {
  /** Whether the daemon acknowledged the state update */
  acknowledged: boolean;
  /** Correlation ID for tracing this update through the control plane */
  correlationId: string;
  /** Non-null when the update could not be delivered (not connected, timeout, etc.) */
  error?: string | null;
  /**
   * Populated when the registry immediately resolved a new component based
   * on the state update. In practice this may arrive asynchronously via the
   * daemon's Subscription.messages channel instead.
   */
  resolution?: Resolution | null;
}

