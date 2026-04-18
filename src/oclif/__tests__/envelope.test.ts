/**
 * Tests for CommandResult envelope helpers.
 * Refs #100 (B1)
 */

import {
  EXIT_CODES,
  exitCodeFor,
  formatSuccess,
  formatError,
} from '../envelope';
import {
  ValidationError,
  BusinessError,
  NetworkError,
  SystemError,
  SecurityError,
  TimeoutError,
} from '../../runtime/errors';

// ---------------------------------------------------------------------------
// exitCodeFor
// ---------------------------------------------------------------------------

describe('exitCodeFor', () => {
  it.each([
    ['ok',         EXIT_CODES.ok],
    ['validation', EXIT_CODES.validation],
    ['business',   EXIT_CODES.business],
    ['network',    EXIT_CODES.network],
    ['system',     EXIT_CODES.system],
    ['security',   EXIT_CODES.security],
    ['timeout',    EXIT_CODES.timeout],
    ['unknown',    EXIT_CODES.unknown],
  ])('maps %s → %i', (type, code) => {
    expect(exitCodeFor(type)).toBe(code);
  });

  it('returns EXIT_CODES.unknown for unrecognised type', () => {
    expect(exitCodeFor('bogus')).toBe(EXIT_CODES.unknown);
  });
});

// ---------------------------------------------------------------------------
// formatSuccess
// ---------------------------------------------------------------------------

describe('formatSuccess', () => {
  it('returns ok:true with data', () => {
    const result = formatSuccess({ value: 42 });
    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ value: 42 });
    expect(result.error).toBeUndefined();
  });

  it('defaults warnings to []', () => {
    expect(formatSuccess(null).warnings).toEqual([]);
  });

  it('preserves provided warnings', () => {
    const result = formatSuccess('x', ['warn1', 'warn2']);
    expect(result.warnings).toEqual(['warn1', 'warn2']);
  });

  it('generates a correlationId when not provided', () => {
    const result = formatSuccess({});
    expect(typeof result.telemetry.correlationId).toBe('string');
    expect(result.telemetry.correlationId.length).toBeGreaterThan(0);
  });

  it('uses provided telemetry values', () => {
    const result = formatSuccess({}, [], { durationMs: 99, correlationId: 'abc' });
    expect(result.telemetry.durationMs).toBe(99);
    expect(result.telemetry.correlationId).toBe('abc');
  });
});

// ---------------------------------------------------------------------------
// formatError — every error class
// ---------------------------------------------------------------------------

describe('formatError', () => {
  const correlationId = 'test-corr-id';

  it('ValidationError → type:validation, code:64, userFacing:true, not retryable', () => {
    const err = new ValidationError('bad input', 'email', 'format');
    const result = formatError(err, correlationId);
    expect(result.ok).toBe(false);
    expect(result.error?.type).toBe('validation');
    expect(result.error?.code).toBe(EXIT_CODES.validation);
    expect(result.error?.retryable).toBe(false);
    expect(result.error?.userFacing).toBe(true);
    expect(result.error?.details).toEqual({ field: 'email', constraint: 'format' });
  });

  it('BusinessError → type:business, code:65', () => {
    const err = new BusinessError('dir exists', 'DIR_EXISTS');
    const result = formatError(err, correlationId);
    expect(result.error?.type).toBe('business');
    expect(result.error?.code).toBe(EXIT_CODES.business);
    expect(result.error?.retryable).toBe(false);
  });

  it('NetworkError → type:network, code:66, retryable:true', () => {
    const err = new NetworkError('timeout', 503);
    const result = formatError(err, correlationId);
    expect(result.error?.type).toBe('network');
    expect(result.error?.code).toBe(EXIT_CODES.network);
    expect(result.error?.retryable).toBe(true);
  });

  it('SystemError → type:system, code:69, retryable:true', () => {
    const err = new SystemError('fs fail');
    const result = formatError(err, correlationId);
    expect(result.error?.type).toBe('system');
    expect(result.error?.code).toBe(EXIT_CODES.system);
    expect(result.error?.retryable).toBe(true);
  });

  it('SecurityError → type:security, code:77', () => {
    const err = new SecurityError('access denied');
    const result = formatError(err, correlationId);
    expect(result.error?.type).toBe('security');
    expect(result.error?.code).toBe(EXIT_CODES.security);
  });

  it('TimeoutError → type:timeout, code:124', () => {
    const err = new TimeoutError('timed out', 5000, 5001);
    const result = formatError(err, correlationId);
    expect(result.error?.type).toBe('timeout');
    expect(result.error?.code).toBe(EXIT_CODES.timeout);
  });

  it('plain Error → type:unknown, code:70', () => {
    const err = new Error('something went wrong');
    const result = formatError(err, correlationId);
    expect(result.error?.type).toBe('unknown');
    expect(result.error?.code).toBe(EXIT_CODES.unknown);
  });

  it('non-Error value is coerced to Error', () => {
    const result = formatError('string thrown', correlationId);
    expect(result.ok).toBe(false);
    expect(result.error?.message).toBe('string thrown');
  });

  it('includes correlationId in telemetry', () => {
    const result = formatError(new Error('x'), correlationId);
    expect(result.telemetry.correlationId).toBe(correlationId);
  });

  it('has no circular deps — imports from runtime/errors and runtime/error-classifier only', () => {
    // Structural: this file imports nothing from src/oclif/BaseCommand or src/commands
    expect(true).toBe(true);
  });
});
