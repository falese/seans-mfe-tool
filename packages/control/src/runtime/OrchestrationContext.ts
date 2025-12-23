/**
 * Orchestration Context for Multi-MFE Coordination
 *
 * Extends base Context with orchestration-level state for managing
 * multiple MFE instances, workflow tracking, and dependency resolution.
 *
 * Part of Alpha Orchestration System (Phase 1)
 */

import { Context, ContextFactory } from '@seans-mfe-tool/runtime';
import type { LoadResult, CapabilityMetadata } from '@seans-mfe-tool/runtime';

/**
 * Registry entry for a single MFE instance
 */
export interface MFERegistryEntry {
  /** Unique MFE identifier */
  id: string;

  /** Current load/execution state */
  status: 'loading' | 'loaded' | 'error' | 'ready';

  /** Load result if successfully loaded */
  loadResult?: LoadResult;

  /** Available capabilities from this MFE */
  capabilities: CapabilityMetadata[];

  /** Error information if load failed */
  error?: {
    phase: string;
    message: string;
    retryable: boolean;
  };

  /** Timestamp when MFE was loaded */
  loadedAt?: Date;

  /** Time taken to load (milliseconds) */
  duration?: number;
}

/**
 * Dependency requirement for an MFE
 */
export interface MFEDependency {
  /** MFE that has dependencies */
  mfeId: string;

  /** Required capability names */
  requiredCapabilities: string[];

  /** Required MFE IDs (must be loaded first) */
  requiredMFEs: string[];
}

/**
 * Orchestration Context - extends base Context with multi-MFE state
 *
 * This context flows through orchestration operations and maintains
 * the runtime registry of all MFE instances.
 */
export interface OrchestrationContext extends Context {
  /** Workflow ID spanning multiple MFE operations */
  workflowId: string;

  /** Runtime registry of all MFE instances */
  mfeRegistry: Map<string, MFERegistryEntry>;

  /** Overall orchestration state */
  orchestrationState: 'initial' | 'loading' | 'ready' | 'partial-failure' | 'failure';

  /** Total number of MFEs to load */
  totalMFEs: number;

  /** Number of successfully loaded MFEs */
  loadedMFEs: number;

  /** Number of failed MFE loads */
  failedMFEs: number;

  /** Optional dependency graph */
  dependencies?: MFEDependency[];
}

/**
 * Generate a unique workflow ID for cross-MFE tracing
 */
function generateWorkflowId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `wf_${timestamp}_${random}`;
}

/**
 * Create an OrchestrationContext instance
 *
 * Factory function that creates a new orchestration context by extending
 * the base Context with orchestration-specific fields.
 *
 * @param user - Optional user context
 * @param jwt - Optional JWT token
 * @returns New OrchestrationContext instance
 */
export function createOrchestrationContext(
  user?: any,
  jwt?: string
): OrchestrationContext {
  const baseContext = ContextFactory.create({ user, jwt });

  return {
    ...baseContext,
    workflowId: generateWorkflowId(),
    mfeRegistry: new Map<string, MFERegistryEntry>(),
    orchestrationState: 'initial',
    totalMFEs: 0,
    loadedMFEs: 0,
    failedMFEs: 0,
  };
}
