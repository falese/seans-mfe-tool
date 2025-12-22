/**
 * Core type definitions for ADR-060 Load Capability
 *
 * These types provide structured, telemetry-rich interfaces for the three-phase
 * load operation (entry → mount → enable-render).
 */

/**
 * Metadata describing an MFE capability (platform or domain)
 */
export interface CapabilityMetadata {
  /** Capability name (e.g., 'auth', 'telemetry', 'userProfile') */
  name: string;

  /** Capability type */
  type: 'platform' | 'domain';

  /** Whether the capability is currently available */
  available: boolean;

  /** Whether the capability requires authentication */
  requiresAuth?: boolean;

  /** Input parameters the capability accepts */
  inputs?: string[];

  /** Output values the capability provides */
  outputs?: string[];

  /** Human-readable description */
  description?: string;
}

/**
 * Structured error with phase context and retry metadata
 */
export interface PhaseError {
  /** Error message */
  message: string;

  /** Phase where the error occurred */
  phase: 'entry' | 'mount' | 'enable-render' | 'before' | 'after' | 'error';

  /** Number of retry attempts made */
  retryCount: number;

  /** Whether the error is retryable (network, timeout, etc.) */
  retryable: boolean;

  /** Original error cause */
  cause?: Error;
}

/**
 * Telemetry data for a single phase
 */
export interface PhaseTelemetry {
  /** Phase start timestamp */
  start: Date;

  /** Phase duration in milliseconds */
  duration: number;
}
