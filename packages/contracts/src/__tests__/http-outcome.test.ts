/**
 * One mapping from an HTTP outcome to an error type (ADR-106 §2).
 *
 * The query capability puts the result in its envelope, and the generated
 * `bff.ts` connector throws the matching typed error. The table is frozen here
 * as a literal on purpose: the Swift and Rust lanes carry their own copy, and
 * their pins compare against these same rows.
 */
import {
  BusinessError,
  NetworkError,
  SecurityError,
  ValidationError,
  classifyHttpOutcome,
  httpOutcomeError,
} from '../index';

const TABLE: ReadonlyArray<[number | undefined, string, boolean]> = [
  [undefined, 'network', true], // no response at all
  [0, 'network', true],
  [408, 'network', true],
  [429, 'network', true],
  [500, 'network', true],
  [503, 'network', true],
  [599, 'network', true],
  [401, 'security', false],
  [403, 'security', false],
  [400, 'validation', false],
  [422, 'validation', false],
  [404, 'business', false],
  [405, 'business', false],
  [409, 'business', false],
];

describe('classifyHttpOutcome (ADR-106 §2)', () => {
  it.each(TABLE)('status %p is %s, retryable %p', (status, type, retryable) => {
    expect(classifyHttpOutcome(status)).toEqual({ type, retryable });
  });
});

describe('httpOutcomeError', () => {
  it.each(TABLE)('status %p throws an error whose type and retryable match the table', (status, type, retryable) => {
    const err = httpOutcomeError('BFF request failed', status);
    expect(err.message).toBe('BFF request failed');
    expect(err.type).toBe(type);
    expect(err.retryable).toBe(retryable);
  });

  it('uses the class the type names, so classifyError reads it the same way', () => {
    expect(httpOutcomeError('x', 503)).toBeInstanceOf(NetworkError);
    expect(httpOutcomeError('x', 403)).toBeInstanceOf(SecurityError);
    expect(httpOutcomeError('x', 422)).toBeInstanceOf(ValidationError);
    expect(httpOutcomeError('x', 404)).toBeInstanceOf(BusinessError);
  });

  it('keeps the status on a NetworkError, 0 when there was no response', () => {
    expect((httpOutcomeError('x', 503) as NetworkError).statusCode).toBe(503);
    expect((httpOutcomeError('x', undefined) as NetworkError).statusCode).toBe(0);
  });

  it('never calls a 404 retryable, which NetworkError-for-everything did', () => {
    expect(httpOutcomeError('x', 404).retryable).toBe(false);
  });
});
