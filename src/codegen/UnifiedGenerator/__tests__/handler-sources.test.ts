/**
 * Codegen tests for ADR-040 — manifest-declared handler sources.
 *
 * When a lifecycle hook entry declares `source`, codegen must:
 *   1. Emit `src/platform/base-mfe/handler-registry.ts` with a static import.
 *   2. Wire the registry into the generated MFE's `super()` call as
 *      `customHandlers`.
 *   3. Suppress the stub method for that hook in the generated `mfe.ts`
 *      (because the implementation lives in the imported module).
 *
 * Hooks WITHOUT `source` keep the existing stub-generation behaviour — full
 * backwards compatibility for every existing manifest.
 */

import { generateAllFiles } from '../unified-generator';
import * as fs from 'fs-extra';
import path from 'path';

describe('codegen: manifest-declared handler sources (ADR-040)', () => {
  const basePath = path.join(__dirname, 'output-handler-sources');

  const manifestWithSources = {
    name: 'SourcedMFE',
    version: '1.0.0',
    type: 'remote',
    language: 'typescript',
    description: 'MFE with sourced handlers',
    endpoint: 'http://localhost:3001',
    capabilities: [
      {
        Load: {
          type: 'platform',
          description: 'Load capability',
          lifecycle: {
            before: [
              {
                validateInput: {
                  handler: 'validateInput',
                  source: './handlers/validation',
                  description: 'Validate inputs from external module',
                },
              },
              {
                logBegin: {
                  handler: 'logBegin',
                  description: 'Inline stub — no source declared',
                },
              },
            ],
            after: [
              {
                checkEmail: {
                  handler: 'checkEmail',
                  source: '@my-org/shared-handlers#validateEmail',
                  description: 'Module + named export',
                },
              },
            ],
          },
        },
      },
      { DataAnalysis: { type: 'domain', description: 'Domain capability' } },
    ],
    dependencies: { 'design-system': { '@mui/material': '^5.15.0' } },
  };

  const manifestNoSources = {
    name: 'PlainMFE',
    version: '1.0.0',
    type: 'remote',
    language: 'typescript',
    description: 'MFE with no sourced handlers',
    endpoint: 'http://localhost:3001',
    capabilities: [
      {
        Load: {
          type: 'platform',
          description: 'Load capability',
          lifecycle: {
            before: [
              { logBegin: { handler: 'logBegin', description: 'Inline stub' } },
            ],
          },
        },
      },
    ],
    dependencies: { 'design-system': { '@mui/material': '^5.15.0' } },
  };

  beforeAll(async () => {
    await fs.remove(basePath);
  });

  afterAll(async () => {
    await fs.remove(basePath);
  });

  describe('React (rspack) variant', () => {
    it('emits handler-registry.ts when at least one hook declares a source', async () => {
      const { files } = await generateAllFiles(manifestWithSources as any, basePath, { force: true });
      const registry = files.find(
        (f) => f.path === path.join(basePath, 'src', 'platform', 'base-mfe', 'handler-registry.ts'),
      );
      expect(registry).toBeDefined();
    });

    it('static-imports a relative-path source as a named export matching the handler name', async () => {
      const { files } = await generateAllFiles(manifestWithSources as any, basePath, { force: true });
      const registry = files.find(
        (f) => f.path === path.join(basePath, 'src', 'platform', 'base-mfe', 'handler-registry.ts'),
      );
      expect(registry!.content).toContain(
        `import { validateInput } from './handlers/validation';`,
      );
      // `validateInput` must appear as a key inside the registry map. The
      // map signature contains `=>` in the type, so this assertion only
      // looks for the key after the `= {` opening brace.
      expect(registry!.content).toMatch(
        /export const handlerRegistry[\s\S]*?=\s*\{[\s\S]*?validateInput\s*:/,
      );
    });

    it('static-imports a module#export source as an aliased named import', async () => {
      const { files } = await generateAllFiles(manifestWithSources as any, basePath, { force: true });
      const registry = files.find(
        (f) => f.path === path.join(basePath, 'src', 'platform', 'base-mfe', 'handler-registry.ts'),
      );
      expect(registry!.content).toContain(
        `import { validateEmail as checkEmail } from '@my-org/shared-handlers';`,
      );
      expect(registry!.content).toMatch(/checkEmail/);
    });

    it('wires the registry into the generated MFE constructor', async () => {
      const { files } = await generateAllFiles(manifestWithSources as any, basePath, { force: true });
      const mfe = files.find(
        (f) => f.path === path.join(basePath, 'src', 'platform', 'base-mfe', 'mfe.ts'),
      );
      expect(mfe!.content).toContain(`import { handlerRegistry } from './handler-registry';`);
      expect(mfe!.content).toMatch(/super\(manifest,\s*\{\s*customHandlers:\s*handlerRegistry\s*\}\)/);
    });

    it('suppresses the stub method for hooks with a source', async () => {
      const { files } = await generateAllFiles(manifestWithSources as any, basePath, { force: true });
      const mfe = files.find(
        (f) => f.path === path.join(basePath, 'src', 'platform', 'base-mfe', 'mfe.ts'),
      );
      // `validateInput` and `checkEmail` have `source`, so no stub is emitted.
      expect(mfe!.content).not.toMatch(/protected async validateInput\s*\(/);
      expect(mfe!.content).not.toMatch(/protected async checkEmail\s*\(/);
      // `logBegin` has no source — the stub MUST still be emitted.
      expect(mfe!.content).toMatch(/protected async logBegin\s*\(/);
    });

    it('does NOT emit handler-registry.ts when no hook declares a source (back-compat)', async () => {
      const { files } = await generateAllFiles(manifestNoSources as any, basePath, { force: true });
      const registry = files.find(
        (f) => f.path === path.join(basePath, 'src', 'platform', 'base-mfe', 'handler-registry.ts'),
      );
      expect(registry).toBeUndefined();
      const mfe = files.find(
        (f) => f.path === path.join(basePath, 'src', 'platform', 'base-mfe', 'mfe.ts'),
      );
      expect(mfe!.content).not.toContain(`import { handlerRegistry }`);
      // The plain constructor — no customHandlers argument — must remain.
      expect(mfe!.content).toMatch(/super\(manifest\);/);
    });
  });

  describe('Angular (webpack) variant', () => {
    const angularManifestWithSources = {
      ...manifestWithSources,
      name: 'NgSourcedMFE',
      framework: 'angular' as const,
      bundler: 'webpack' as const,
      dependencies: {
        runtime: {
          '@angular/core': '^17.0.0',
          '@angular/platform-browser': '^17.0.0',
          'zone.js': '~0.14.0',
        },
      },
    };

    it('emits handler-registry.ts for Angular MFEs that declare sources', async () => {
      const { files } = await generateAllFiles(angularManifestWithSources as any, basePath, {
        force: true,
      });
      const registry = files.find(
        (f) => f.path === path.join(basePath, 'src', 'platform', 'base-mfe', 'handler-registry.ts'),
      );
      expect(registry).toBeDefined();
      expect(registry!.content).toContain(`from '@my-org/shared-handlers'`);
    });

    it('wires the registry into the generated Angular MFE constructor', async () => {
      const { files } = await generateAllFiles(angularManifestWithSources as any, basePath, {
        force: true,
      });
      const mfe = files.find(
        (f) => f.path === path.join(basePath, 'src', 'platform', 'base-mfe', 'mfe.ts'),
      );
      expect(mfe!.content).toContain(`import { handlerRegistry } from './handler-registry';`);
      expect(mfe!.content).toMatch(/super\(manifest,\s*\{\s*customHandlers:\s*handlerRegistry\s*\}\)/);
    });

    it('suppresses the stub method for Angular hooks with a source', async () => {
      const { files } = await generateAllFiles(angularManifestWithSources as any, basePath, {
        force: true,
      });
      const mfe = files.find(
        (f) => f.path === path.join(basePath, 'src', 'platform', 'base-mfe', 'mfe.ts'),
      );
      expect(mfe!.content).not.toMatch(/protected async validateInput\s*\(/);
      expect(mfe!.content).not.toMatch(/protected async checkEmail\s*\(/);
      expect(mfe!.content).toMatch(/protected async logBegin\s*\(/);
    });
  });
});
