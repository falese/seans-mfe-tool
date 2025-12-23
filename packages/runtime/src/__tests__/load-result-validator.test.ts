/**
 * LoadResultValidator Tests
 * Tests for ADR-060 LoadResult validation utilities
 */

import { LoadResultValidator } from '../validators/load-result-validator';
import type { LoadResult } from '../base-mfe';
import type { CapabilityMetadata, PhaseError } from '../types';

describe('LoadResultValidator', () => {
  describe('validate', () => {
    it('should validate a complete, successful LoadResult', () => {
      const result: LoadResult = {
        status: 'loaded',
        container: { init: jest.fn() },
        manifest: {} as any,
        availableComponents: ['App', 'Widget'],
        capabilities: [
          { name: 'load', type: 'platform', available: true },
          { name: 'render', type: 'platform', available: true }
        ],
        timestamp: new Date(),
        duration: 1500,
        telemetry: {
          entry: { start: new Date(), duration: 500 },
          mount: { start: new Date(), duration: 600 },
          enableRender: { start: new Date(), duration: 400 }
        }
      };

      const validation = LoadResultValidator.validate(result);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const result = {
        status: 'loaded'
      } as LoadResult;

      const validation = LoadResultValidator.validate(result);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Missing required field: timestamp');
      expect(validation.errors).toContain('Missing required field: duration');
    });

    it('should detect invalid status values', () => {
      const result = {
        status: 'invalid' as any,
        timestamp: new Date(),
        duration: 100
      } as LoadResult;

      const validation = LoadResultValidator.validate(result);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("Invalid status: invalid. Must be 'loaded' or 'error'");
    });

    it('should warn about missing container on loaded status', () => {
      const result: LoadResult = {
        status: 'loaded',
        timestamp: new Date(),
        duration: 1000
      };

      const validation = LoadResultValidator.validate(result);

      expect(validation.warnings).toContain('Loaded status but no container present');
      expect(validation.warnings).toContain('Loaded status but no manifest present');
    });

    it('should validate error status with PhaseError', () => {
      const phaseError: PhaseError = {
        message: 'Network timeout',
        phase: 'entry',
        retryCount: 2,
        retryable: true,
        cause: new Error('Network timeout')
      };

      const result: LoadResult = {
        status: 'error',
        timestamp: new Date(),
        duration: 3000,
        error: phaseError,
        telemetry: {
          entry: { start: new Date(), duration: 0 },
          mount: { start: new Date(), duration: 0 },
          enableRender: { start: new Date(), duration: 0 }
        }
      };

      const validation = LoadResultValidator.validate(result);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect incomplete PhaseError structure', () => {
      const result: LoadResult = {
        status: 'error',
        timestamp: new Date(),
        duration: 1000,
        error: {
          message: 'Error'
        } as any
      };

      const validation = LoadResultValidator.validate(result);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Error object missing phase field');
      expect(validation.errors).toContain('Error object missing retryCount field');
      expect(validation.errors).toContain('Error object missing retryable field');
    });

    it('should validate telemetry structure', () => {
      const result: LoadResult = {
        status: 'loaded',
        timestamp: new Date(),
        duration: 1500,
        telemetry: {
          entry: { start: new Date(), duration: 500 },
          mount: { start: new Date(), duration: -100 },  // Invalid!
          enableRender: { start: new Date(), duration: 400 }
        }
      };

      const validation = LoadResultValidator.validate(result);

      expect(validation.warnings).toContain('Telemetry phase mount has invalid duration');
    });
  });

  describe('hasComponent', () => {
    it('should return true if component is available', () => {
      const result: LoadResult = {
        status: 'loaded',
        availableComponents: ['App', 'Widget', 'Header'],
        timestamp: new Date(),
        duration: 1000
      };

      expect(LoadResultValidator.hasComponent(result, 'App')).toBe(true);
      expect(LoadResultValidator.hasComponent(result, 'Widget')).toBe(true);
    });

    it('should return false if component is not available', () => {
      const result: LoadResult = {
        status: 'loaded',
        availableComponents: ['App'],
        timestamp: new Date(),
        duration: 1000
      };

      expect(LoadResultValidator.hasComponent(result, 'NonExistent')).toBe(false);
    });

    it('should return false if no components available', () => {
      const result: LoadResult = {
        status: 'loaded',
        timestamp: new Date(),
        duration: 1000
      };

      expect(LoadResultValidator.hasComponent(result, 'App')).toBe(false);
    });
  });

  describe('hasCapability', () => {
    it('should return true if capability is available', () => {
      const capabilities: CapabilityMetadata[] = [
        { name: 'load', type: 'platform', available: true },
        { name: 'render', type: 'platform', available: true },
        { name: 'refresh', type: 'platform', available: false }
      ];

      const result: LoadResult = {
        status: 'loaded',
        capabilities,
        timestamp: new Date(),
        duration: 1000
      };

      expect(LoadResultValidator.hasCapability(result, 'load')).toBe(true);
      expect(LoadResultValidator.hasCapability(result, 'render')).toBe(true);
    });

    it('should return false if capability is not available', () => {
      const capabilities: CapabilityMetadata[] = [
        { name: 'refresh', type: 'platform', available: false }
      ];

      const result: LoadResult = {
        status: 'loaded',
        capabilities,
        timestamp: new Date(),
        duration: 1000
      };

      expect(LoadResultValidator.hasCapability(result, 'refresh')).toBe(false);
    });
  });

  describe('getPerformanceMetrics', () => {
    it('should calculate performance metrics correctly', () => {
      const result: LoadResult = {
        status: 'loaded',
        timestamp: new Date(),
        duration: 1000,
        telemetry: {
          entry: { start: new Date(), duration: 400 },
          mount: { start: new Date(), duration: 300 },
          enableRender: { start: new Date(), duration: 300 }
        }
      };

      const metrics = LoadResultValidator.getPerformanceMetrics(result);

      expect(metrics).not.toBeNull();
      expect(metrics!.totalDuration).toBe(1000);
      expect(metrics!.entryDuration).toBe(400);
      expect(metrics!.mountDuration).toBe(300);
      expect(metrics!.enableRenderDuration).toBe(300);
      expect(metrics!.breakdown.entry).toBe(40);
      expect(metrics!.breakdown.mount).toBe(30);
      expect(metrics!.breakdown.enableRender).toBe(30);
    });

    it('should return null if telemetry is missing', () => {
      const result: LoadResult = {
        status: 'loaded',
        timestamp: new Date(),
        duration: 1000
      };

      const metrics = LoadResultValidator.getPerformanceMetrics(result);

      expect(metrics).toBeNull();
    });
  });

  describe('getAvailableCapabilities', () => {
    it('should return only available capabilities', () => {
      const capabilities: CapabilityMetadata[] = [
        { name: 'load', type: 'platform', available: true },
        { name: 'render', type: 'platform', available: true },
        { name: 'refresh', type: 'platform', available: false },
        { name: 'userProfile', type: 'domain', available: true }
      ];

      const result: LoadResult = {
        status: 'loaded',
        capabilities,
        timestamp: new Date(),
        duration: 1000
      };

      const available = LoadResultValidator.getAvailableCapabilities(result);

      expect(available).toHaveLength(3);
      expect(available.map(c => c.name)).toEqual(['load', 'render', 'userProfile']);
    });
  });

  describe('isRetryableError', () => {
    it('should return true for retryable errors', () => {
      const result: LoadResult = {
        status: 'error',
        timestamp: new Date(),
        duration: 1000,
        error: {
          message: 'Network timeout',
          phase: 'entry',
          retryCount: 1,
          retryable: true
        }
      };

      expect(LoadResultValidator.isRetryableError(result)).toBe(true);
    });

    it('should return false for non-retryable errors', () => {
      const result: LoadResult = {
        status: 'error',
        timestamp: new Date(),
        duration: 1000,
        error: {
          message: 'Validation failed',
          phase: 'mount',
          retryCount: 0,
          retryable: false
        }
      };

      expect(LoadResultValidator.isRetryableError(result)).toBe(false);
    });

    it('should return false for successful loads', () => {
      const result: LoadResult = {
        status: 'loaded',
        timestamp: new Date(),
        duration: 1000
      };

      expect(LoadResultValidator.isRetryableError(result)).toBe(false);
    });
  });

  describe('getErrorDetails', () => {
    it('should return error details for error status', () => {
      const result: LoadResult = {
        status: 'error',
        timestamp: new Date(),
        duration: 1000,
        error: {
          message: 'Connection refused',
          phase: 'entry',
          retryCount: 3,
          retryable: true,
          cause: new Error('ECONNREFUSED')
        }
      };

      const details = LoadResultValidator.getErrorDetails(result);

      expect(details).not.toBeNull();
      expect(details!.message).toBe('Connection refused');
      expect(details!.phase).toBe('entry');
      expect(details!.retryCount).toBe(3);
      expect(details!.retryable).toBe(true);
    });

    it('should return null for successful loads', () => {
      const result: LoadResult = {
        status: 'loaded',
        timestamp: new Date(),
        duration: 1000
      };

      const details = LoadResultValidator.getErrorDetails(result);

      expect(details).toBeNull();
    });
  });
});
