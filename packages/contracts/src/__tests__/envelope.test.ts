/**
 * envelope — isomorphic guarantees (ADR-054).
 *
 * The contracts barrel is consumed by browser shells, so envelope must not pull
 * Node's `crypto` builtin into the bundle. These tests pin both the behavior
 * (valid v4 correlation id) and the regression that broke the shell build:
 * a bare `import ... from 'crypto'` in the source.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { formatSuccess, formatError } from '../envelope';

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('envelope correlation id', () => {
  it('formatSuccess mints a valid v4 correlation id', () => {
    const result = formatSuccess({ value: 1 });
    expect(result.telemetry.correlationId).toMatch(UUID_V4);
  });

  it('uses a caller-supplied correlation id when given', () => {
    const result = formatSuccess({ value: 1 }, [], { correlationId: 'fixed-id' });
    expect(result.telemetry.correlationId).toBe('fixed-id');
  });

  it('formatError preserves the passed correlation id', () => {
    const result = formatError(new Error('boom'), 'corr-123');
    expect(result.ok).toBe(false);
    expect(result.telemetry.correlationId).toBe('corr-123');
  });
});

describe('envelope is browser-bundleable', () => {
  it('does not import the Node "crypto" module', () => {
    const src = readFileSync(join(__dirname, '..', 'envelope.ts'), 'utf8');
    expect(src).not.toMatch(/from\s+['"]crypto['"]/);
    expect(src).not.toMatch(/require\(\s*['"]crypto['"]\s*\)/);
  });
});
