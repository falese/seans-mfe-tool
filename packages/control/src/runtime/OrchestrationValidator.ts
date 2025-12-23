/**
 * Orchestration Validator
 *
 * Validation utilities for multi-MFE orchestration operations.
 * Provides health checks, dependency validation, and performance metrics.
 *
 * Part of Alpha Orchestration System (Phase 5)
 */

import type {
  OrchestrationContext,
  MFERegistryEntry,
} from './OrchestrationContext';

/**
 * Orchestration validation result
 */
export interface OrchestrationValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Aggregated performance metrics across all MFEs
 */
export interface AggregatedPerformanceMetrics {
  /** Total duration across all MFEs */
  totalDuration: number;

  /** Slowest MFE (bottleneck) */
  slowestMFE: { id: string; duration: number } | null;

  /** Average load duration */
  averageDuration: number;

  /** Critical path (slowest dependencies) */
  criticalPath: string[];

  /** Success rate percentage */
  successRate: number;
}

/**
 * Orchestration Validator
 *
 * Provides validation and analysis utilities for orchestration contexts.
 */
export class OrchestrationValidator {
  /**
   * Validate entire orchestration is ready
   *
   * @param context - Orchestration context
   * @returns Validation result with errors and warnings
   */
  static validate(context: OrchestrationContext): OrchestrationValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check orchestration state
    if (context.orchestrationState === 'failure') {
      errors.push('All MFEs failed to load');
    }

    if (context.orchestrationState === 'partial-failure') {
      warnings.push(
        `${context.failedMFEs} of ${context.totalMFEs} MFEs failed to load`
      );
    }

    // Check if any MFEs loaded
    if (context.loadedMFEs === 0) {
      errors.push('No MFEs successfully loaded');
    }

    // Check registry consistency
    const registrySize = context.mfeRegistry.size;
    if (registrySize !== context.totalMFEs) {
      warnings.push(
        `Registry size mismatch: expected ${context.totalMFEs}, found ${registrySize}`
      );
    }

    // Check for MFEs stuck in loading state
    const stuckMFEs: string[] = [];
    context.mfeRegistry.forEach((entry, id) => {
      if (entry.status === 'loading') {
        stuckMFEs.push(id);
      }
    });

    if (stuckMFEs.length > 0) {
      warnings.push(
        `${stuckMFEs.length} MFEs stuck in loading state: ${stuckMFEs.join(', ')}`
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Check if all required MFEs are loaded
   *
   * @param context - Orchestration context
   * @param requiredMFEIds - Required MFE identifiers
   * @returns True if all required MFEs are loaded
   */
  static allMFEsLoaded(
    context: OrchestrationContext,
    requiredMFEIds: string[]
  ): boolean {
    return requiredMFEIds.every(id => {
      const entry = context.mfeRegistry.get(id);
      return entry && (entry.status === 'loaded' || entry.status === 'ready');
    });
  }

  /**
   * Check if a specific MFE is loaded
   *
   * @param context - Orchestration context
   * @param mfeId - MFE identifier
   * @returns True if MFE is loaded
   */
  static isMFELoaded(context: OrchestrationContext, mfeId: string): boolean {
    const entry = context.mfeRegistry.get(mfeId);
    return entry !== undefined &&
           (entry.status === 'loaded' || entry.status === 'ready');
  }

  /**
   * Get aggregated performance metrics
   *
   * Analyzes load performance across all MFEs to identify bottlenecks
   * and calculate overall orchestration performance.
   *
   * @param context - Orchestration context
   * @returns Aggregated performance metrics
   */
  static getAggregatedPerformance(
    context: OrchestrationContext
  ): AggregatedPerformanceMetrics {
    let totalDuration = 0;
    let slowestMFE: { id: string; duration: number } | null = null;
    const durations: number[] = [];

    context.mfeRegistry.forEach((entry, id) => {
      if (entry.duration !== undefined) {
        durations.push(entry.duration);
        totalDuration += entry.duration;

        if (!slowestMFE || entry.duration > slowestMFE.duration) {
          slowestMFE = { id, duration: entry.duration };
        }
      }
    });

    const successRate =
      context.totalMFEs > 0
        ? (context.loadedMFEs / context.totalMFEs) * 100
        : 0;

    return {
      totalDuration,
      slowestMFE,
      averageDuration: durations.length > 0 ? totalDuration / durations.length : 0,
      criticalPath: slowestMFE ? [slowestMFE.id] : [],
      successRate,
    };
  }

  /**
   * Get MFEs by status
   *
   * @param context - Orchestration context
   * @param status - Status to filter by
   * @returns Array of MFE IDs with the given status
   */
  static getMFEsByStatus(
    context: OrchestrationContext,
    status: MFERegistryEntry['status']
  ): string[] {
    const mfeIds: string[] = [];

    context.mfeRegistry.forEach((entry, id) => {
      if (entry.status === status) {
        mfeIds.push(id);
      }
    });

    return mfeIds;
  }

  /**
   * Get failed MFEs with error details
   *
   * @param context - Orchestration context
   * @returns Map of MFE ID to error details
   */
  static getFailedMFEs(
    context: OrchestrationContext
  ): Map<string, { phase: string; message: string; retryable: boolean }> {
    const failedMFEs = new Map<
      string,
      { phase: string; message: string; retryable: boolean }
    >();

    context.mfeRegistry.forEach((entry, id) => {
      if (entry.status === 'error' && entry.error) {
        failedMFEs.set(id, entry.error);
      }
    });

    return failedMFEs;
  }

  /**
   * Check if orchestration can proceed with partial failure
   *
   * Determines if enough MFEs loaded successfully to continue,
   * based on a minimum threshold or critical MFE list.
   *
   * @param context - Orchestration context
   * @param options - Validation options
   * @returns True if can proceed
   */
  static canProceedWithPartialFailure(
    context: OrchestrationContext,
    options: {
      minSuccessRate?: number; // Minimum success rate (0-100)
      criticalMFEs?: string[]; // MFEs that must load
    } = {}
  ): boolean {
    const { minSuccessRate = 50, criticalMFEs = [] } = options;

    // Check minimum success rate
    const successRate =
      context.totalMFEs > 0
        ? (context.loadedMFEs / context.totalMFEs) * 100
        : 0;

    if (successRate < minSuccessRate) {
      return false;
    }

    // Check critical MFEs
    if (criticalMFEs.length > 0) {
      return this.allMFEsLoaded(context, criticalMFEs);
    }

    return true;
  }

  /**
   * Get orchestration summary
   *
   * @param context - Orchestration context
   * @returns Human-readable summary
   */
  static getSummary(context: OrchestrationContext): {
    state: string;
    loaded: number;
    failed: number;
    total: number;
    successRate: number;
    duration?: number;
  } {
    const performance = this.getAggregatedPerformance(context);

    return {
      state: context.orchestrationState,
      loaded: context.loadedMFEs,
      failed: context.failedMFEs,
      total: context.totalMFEs,
      successRate: performance.successRate,
      duration: performance.slowestMFE?.duration,
    };
  }
}
