/**
 * One mapping from an HTTP outcome to an error type (ADR-106 §2).
 *
 * A BFF request fails in two places that must agree: the `query` capability
 * reports the failure inside its envelope, and the generated `bff.ts`
 * connector throws it. Both classify through here, so a 503 is retryable and a
 * 404 is not, whichever way a caller meets it.
 *
 * The `type` strings are the typed errors' own `type` values, and each row
 * names the class whose `retryable` it matches. That is why "any other 4xx" is
 * `business`, not `system`: `SystemError.retryable` is `true` (an environment
 * that may recover), and a misconfigured endpoint does not recover by retrying.
 *
 * Swift and Rust carry their own copy of this table; their pins compare against
 * the same rows as `__tests__/http-outcome.test.ts`.
 */

import { BusinessError } from './errors/BusinessError';
import { NetworkError } from './errors/NetworkError';
import { SecurityError } from './errors/SecurityError';
import { ValidationError } from './errors/ValidationError';

export type HttpOutcomeType = 'network' | 'security' | 'validation' | 'business';

export interface HttpOutcome {
  type: HttpOutcomeType;
  retryable: boolean;
}

/**
 * Classify a failed request by its status. `undefined` or `0` means no
 * response arrived at all (offline, DNS, refused, CORS).
 */
export function classifyHttpOutcome(status?: number): HttpOutcome {
  if (!status || status === 408 || status === 429 || status >= 500) {
    return { type: 'network', retryable: true };
  }
  if (status === 401 || status === 403) return { type: 'security', retryable: false };
  if (status === 400 || status === 422) return { type: 'validation', retryable: false };
  return { type: 'business', retryable: false };
}

/** The typed error a caller that throws should throw for this outcome. */
export function httpOutcomeError(
  message: string,
  status?: number,
): NetworkError | SecurityError | ValidationError | BusinessError {
  switch (classifyHttpOutcome(status).type) {
    case 'network':
      return new NetworkError(message, status ?? 0);
    case 'security':
      return new SecurityError(message, { status });
    case 'validation':
      return new ValidationError(message, 'document', 'accepted-by-bff');
    default:
      return new BusinessError(message, 'BFF_REQUEST_REJECTED', { status });
  }
}
