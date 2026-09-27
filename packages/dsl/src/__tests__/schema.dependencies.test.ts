/**
 * `dependencies:` is a closed block (#373).
 *
 * It used to be a plain Zod object, which STRIPS an unknown key rather than
 * rejecting it. So a manifest declaring `dependencies.devDependencies` passed
 * `mfe:validate`, lost the block silently, and failed the JSON Schema generated
 * from this same source (ADR-065), which emits `additionalProperties: false`.
 * The two representations of the manifest contract disagreed.
 *
 * Closing the object makes them agree, and turns an author's reasonable
 * expectation ("this reaches package.json") into an error that says where the
 * dependency actually goes.
 */
import { z } from 'zod';
import { DependenciesSchema } from '../schema';
import { validateFull } from '../validator';

const baseManifest = {
  name: 'test-mfe',
  version: '1.0.0',
  type: 'remote',
  language: 'typescript',
  capabilities: [{ Health: { type: 'platform', description: 'Health check' } }],
};

describe('DependenciesSchema (#373)', () => {
  it('accepts the three declared sections', () => {
    expect(() =>
      DependenciesSchema.parse({
        runtime: { react: '~18.2.0' },
        'design-system': { 'styled-components': '^6.1.0' },
        mfes: { 'other-mfe': '^1.0.0' },
      })
    ).not.toThrow();
  });

  it('rejects an undeclared key instead of stripping it', () => {
    const result = DependenciesSchema.safeParse({
      runtime: { react: '~18.2.0' },
      devDependencies: { '@types/styled-components': '^5.1.26' },
    });
    expect(result.success).toBe(false);
  });

  it('names the key and says where dev-only dependencies belong', () => {
    const result = DependenciesSchema.safeParse({ devDependencies: {} });
    expect(result.success).toBe(false);
    const message = result.success ? '' : result.error.issues[0].message;
    expect(message).toContain('devDependencies');
    expect(message).toContain('package.json');
  });

  it('agrees with its generated JSON Schema (ADR-065)', () => {
    const json = z.toJSONSchema(DependenciesSchema) as { additionalProperties?: unknown };
    expect(json.additionalProperties).toBe(false);
  });
});

describe('validateFull with dependencies.devDependencies (#373)', () => {
  it('fails, at the dependencies path', () => {
    const result = validateFull({
      ...baseManifest,
      dependencies: { devDependencies: { '@types/node': '^20.0.0' } },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.path)).toContain('dependencies');
  });

  it('still passes a manifest with only declared sections', () => {
    const result = validateFull({
      ...baseManifest,
      dependencies: { runtime: { react: '~18.2.0' } },
    });
    expect(result.errors).toEqual([]);
  });
});
