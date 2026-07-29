/**
 * ADR-017 in the code the generator emits.
 *
 * The repo-wide guard (`src/__tests__/no-raw-error-throws.test.ts`) proves no
 * raw `throw new Error(` survives anywhere. These assertions are the other
 * half: that what replaced them is the *right* class, with the arguments that
 * make it useful.
 *
 * The BFF case is the reason the exercise happened. `classifyError` (ADR-030)
 * decides retryability from an error's `type`, so while the generated client
 * threw a raw Error, every BFF failure a generated MFE saw — including a 503 —
 * classified as `unknown` and non-retryable. The retry machinery could not help
 * the one case it exists for. A test that only checked "not a raw Error" would
 * pass on `new BusinessError(...)` here and miss that entirely, so this pins the
 * class *and* that the status code is carried.
 */

import path from 'path';
import { generateAllFiles } from '../unified-generator';

const BASE = path.join(__dirname, 'output-typed-errors');

/** A manifest with a `data:` block, so the BFF connector is emitted too. */
const manifest = {
  name: 'TypedErrorsMFE',
  version: '1.0.0',
  description: 'Fixture for ADR-017 assertions',
  endpoint: 'http://localhost:3001',
  capabilities: [{ DataAnalysis: { type: 'domain', description: 'Analyze data' } }],
  dependencies: { 'design-system': { '@mui/material': '^5.15.0' }, mfes: {} },
  data: {
    sources: [
      { name: 'DemoAPI', handler: { openapi: { source: './specs/demo.yaml' } } },
    ],
    serve: { endpoint: '/graphql', playground: true },
  },
};

describe('generated code throws typed errors (ADR-017)', () => {
  let files: Array<{ path: string; content: string }>;

  beforeAll(async () => {
    ({ files } = await generateAllFiles(manifest as never, BASE, { force: true }));
  });

  afterAll(async () => {
    const fs = await import('fs-extra');
    await fs.remove(BASE);
  });

  const emitted = (suffix: string): string => {
    const file = files.find((f) => f.path.endsWith(suffix));
    if (!file) throw new Error(`generator emitted no ${suffix}`);
    return file.content;
  };

  describe('the BFF connector', () => {
    it('throws NetworkError carrying the HTTP status, so a 5xx is retryable', () => {
      const bff = emitted('platform/bff/bff.ts');

      expect(bff).toContain('throw new NetworkError(');
      // The status is the whole point — without it the classifier has nothing
      // to distinguish a 503 from a 400.
      expect(bff).toContain('response.status');
      expect(bff).toMatch(/import \{[^}]*NetworkError[^}]*\} from '@seans-mfe-tool\/runtime'/);
    });

    it('throws BusinessError for GraphQL errors, which are not a transport fault', () => {
      const bff = emitted('platform/bff/bff.ts');

      expect(bff).toContain('throw new BusinessError(');
      expect(bff).toContain("'BFF_GRAPHQL_ERROR'");
    });

    it('emits no raw Error at all', () => {
      expect(emitted('platform/bff/bff.ts')).not.toMatch(/throw new Error\s*\(/);
    });
  });

  describe('the MFE class', () => {
    it('throws ValidationError naming the input that was wrong', () => {
      const mfe = emitted('platform/base-mfe/mfe.ts');

      expect(mfe).toContain('throw new ValidationError(');
      expect(mfe).toContain("'context.inputs.component'");
      expect(mfe).not.toMatch(/throw new Error\s*\(/);
    });

    it('imports the class from the runtime barrel, the only package it depends on', () => {
      expect(emitted('platform/base-mfe/mfe.ts')).toMatch(
        /import \{[\s\S]*?ValidationError[\s\S]*?\} from '@seans-mfe-tool\/runtime'/,
      );
    });
  });

  describe('the standalone dev entry', () => {
    it('throws SystemError when the root element is missing', () => {
      const index = emitted('src/index.tsx');

      expect(index).toContain('throw new SystemError(');
      expect(index).not.toMatch(/throw new Error\s*\(/);
    });
  });
});
