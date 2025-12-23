/**
 * LoadResult Validator
 * Shell validation utilities for LoadResult (ADR-060)
 *
 * Enables the shell to validate LoadResult before making render decisions.
 */

import type { LoadResult } from '../base-mfe';
import type { CapabilityMetadata } from '../types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface PerformanceMetrics {
  totalDuration: number;
  entryDuration: number;
  mountDuration: number;
  enableRenderDuration: number;
  breakdown: {
    entry: number;    // Percentage
    mount: number;    // Percentage
    enableRender: number;  // Percentage
  };
}

/**
 * Validator for LoadResult objects
 */
export class LoadResultValidator {
  /**
   * Comprehensive validation of LoadResult
   */
  static validate(result: LoadResult): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!result.status) {
      errors.push('Missing required field: status');
    } else if (result.status !== 'loaded' && result.status !== 'error') {
      errors.push(`Invalid status: ${result.status}. Must be 'loaded' or 'error'`);
    }

    if (!result.timestamp) {
      errors.push('Missing required field: timestamp');
    }

    if (result.duration === undefined || result.duration === null) {
      errors.push('Missing required field: duration');
    } else if (result.duration < 0) {
      errors.push(`Invalid duration: ${result.duration}. Must be non-negative`);
    }

    // Status-specific validation
    if (result.status === 'loaded') {
      if (!result.container) {
        warnings.push('Loaded status but no container present');
      }
      if (!result.manifest) {
        warnings.push('Loaded status but no manifest present');
      }
      if (!result.telemetry) {
        warnings.push('Loaded status but no telemetry data');
      }
    }

    if (result.status === 'error') {
      if (!result.error) {
        errors.push('Error status but no error object present');
      } else {
        // Validate PhaseError structure
        if (!result.error.message) {
          errors.push('Error object missing message field');
        }
        if (!result.error.phase) {
          errors.push('Error object missing phase field');
        }
        if (result.error.retryCount === undefined) {
          errors.push('Error object missing retryCount field');
        }
        if (result.error.retryable === undefined) {
          errors.push('Error object missing retryable field');
        }
      }
    }

    // Telemetry validation
    if (result.telemetry) {
      if (!result.telemetry.entry || !result.telemetry.mount || !result.telemetry.enableRender) {
        warnings.push('Incomplete telemetry: missing phase data');
      } else {
        // Validate each phase has required fields
        for (const [phase, data] of Object.entries(result.telemetry)) {
          if (!data.start) {
            warnings.push(`Telemetry phase ${phase} missing start timestamp`);
          }
          if (data.duration === undefined || data.duration < 0) {
            warnings.push(`Telemetry phase ${phase} has invalid duration`);
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Check if a specific component is available
   */
  static hasComponent(result: LoadResult, componentName: string): boolean {
    if (!result.availableComponents) {
      return false;
    }
    return result.availableComponents.includes(componentName);
  }

  /**
   * Check if a specific capability is available
   */
  static hasCapability(result: LoadResult, capabilityName: string): boolean {
    if (!result.capabilities) {
      return false;
    }
    return result.capabilities.some((cap: CapabilityMetadata) => cap.name === capabilityName && cap.available);
  }

  /**
   * Extract performance metrics from LoadResult
   */
  static getPerformanceMetrics(result: LoadResult): PerformanceMetrics | null {
    if (!result.telemetry || !result.duration) {
      return null;
    }

    const { entry, mount, enableRender } = result.telemetry;
    const totalDuration = result.duration;

    // Calculate percentages
    const entryPct = (entry.duration / totalDuration) * 100;
    const mountPct = (mount.duration / totalDuration) * 100;
    const enableRenderPct = (enableRender.duration / totalDuration) * 100;

    return {
      totalDuration,
      entryDuration: entry.duration,
      mountDuration: mount.duration,
      enableRenderDuration: enableRender.duration,
      breakdown: {
        entry: Math.round(entryPct * 100) / 100,
        mount: Math.round(mountPct * 100) / 100,
        enableRender: Math.round(enableRenderPct * 100) / 100
      }
    };
  }

  /**
   * Get list of available capabilities with metadata
   */
  static getAvailableCapabilities(result: LoadResult): CapabilityMetadata[] {
    if (!result.capabilities) {
      return [];
    }
    return result.capabilities.filter((cap: CapabilityMetadata) => cap.available);
  }

  /**
   * Check if LoadResult indicates a retryable error
   */
  static isRetryableError(result: LoadResult): boolean {
    return result.status === 'error' && result.error?.retryable === true;
  }

  /**
   * Get error details from LoadResult
   */
  static getErrorDetails(result: LoadResult): {
    message: string;
    phase: string;
    retryCount: number;
    retryable: boolean;
  } | null {
    if (result.status !== 'error' || !result.error) {
      return null;
    }

    return {
      message: result.error.message,
      phase: result.error.phase,
      retryCount: result.error.retryCount,
      retryable: result.error.retryable
    };
  }
}
