/**
 * Phase 1.2 integration test — BFF workflow.
 *
 * Exercises the bff:init → bff:validate → bff:build pipeline end-to-end
 * against a real temp dir:
 *
 *   bff:init         → scaffolds server.ts, Dockerfile, mfe-manifest.yaml,
 *                      specs/, etc. and (in standalone mode) runs npm install
 *   bff:validate     → reads the manifest, checks sources/transforms/plugins
 *   bff:build        → writes .meshrc.yaml and invokes `npx mesh build`
 *
 * External processes are stubbed (npm install + npx mesh build) but the
 * template-copy, EJS render, manifest-extract, and Mesh-config emission all
 * run against real fs-extra.
 */

jest.mock('child_process', () => ({
  ...jest.requireActual('child_process'),
  execSync: jest.fn(),
}));

import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'js-yaml';
import { execSync } from 'child_process';

import { bffInitCommand } from '../init';
import { bffValidateCommand } from '../validate';
import { bffBuildCommand } from '../build';

const execSyncMock = execSync as jest.MockedFunction<typeof execSync>;

const MINIMAL_PETS_SPEC = `openapi: 3.0.0
info:
  title: Pets
  version: 1.0.0
paths:
  /pets:
    get:
      operationId: listPets
      responses:
        '200':
          description: ok
`;

interface BffManifest {
  name: string;
  version?: string;
  type?: string;
  data?: {
    sources?: Array<{
      name: string;
      handler: { openapi: { source: string } };
    }>;
    transforms?: Array<Record<string, unknown>>;
    plugins?: Array<Record<string, unknown>>;
    mockSwitch?: { enabled: boolean };
    serve?: { endpoint: string; playground: boolean };
  };
  [key: string]: unknown;
}

async function writeYaml(filePath: string, value: unknown): Promise<void> {
  await fs.writeFile(filePath, yaml.dump(value), 'utf8');
}

describe('integration: BFF workflow', () => {
  let workspace: string;
  let originalCwd: string;

  beforeAll(() => {
    originalCwd = process.cwd();
  });

  beforeEach(async () => {
    workspace = path.join(
      os.tmpdir(),
      `mfe-bff-integration-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await fs.ensureDir(workspace);
    process.chdir(workspace);
    execSyncMock.mockReset();
    execSyncMock.mockReturnValue(Buffer.from(''));
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    if (workspace && (await fs.pathExists(workspace))) {
      await fs.remove(workspace);
    }
  });

  describe('bff:init', () => {
    it('rejects "add to existing" mode when there is no manifest in cwd', async () => {
      // workspace is empty — no mfe-manifest.yaml present.
      await expect(bffInitCommand(undefined, { port: 4400 })).rejects.toThrow(
        /mfe-manifest\.yaml/i,
      );

      // Nothing about npm should have been touched on a failed run.
      expect(execSyncMock).not.toHaveBeenCalled();
    });

    it('scaffolds a standalone BFF project and invokes npm install', async () => {
      const result = await bffInitCommand('my_bff', { port: 4401 });

      expect(result.name).toBe('my_bff');
      expect(result.port).toBe(4401);
      expect(result.dryRun).toBe(false);
      expect(result.generatedFiles.length).toBeGreaterThan(0);

      // npm install must be invoked exactly once after scaffolding.
      const installCalls = execSyncMock.mock.calls.filter(([cmd]) =>
        String(cmd).includes('npm install'),
      );
      expect(installCalls).toHaveLength(1);
    });

    it('dry-run returns planned changes without writing files or invoking npm', async () => {
      const result = await bffInitCommand('dry_bff', { port: 4402, dryRun: true });

      expect(result.dryRun).toBe(true);
      expect(result.generatedFiles).toEqual([]);
      expect(result.plannedChanges).toBeDefined();
      expect(result.plannedChanges!.length).toBeGreaterThan(0);
      expect(execSyncMock).not.toHaveBeenCalled();
    });
  });

  describe('bff:validate', () => {
    async function makeManifest(
      override: Partial<BffManifest['data']> = {},
    ): Promise<string> {
      const manifest: BffManifest = {
        name: 'validate_target',
        version: '1.0.0',
        type: 'bff',
        data: {
          sources: [
            {
              name: 'PetsAPI',
              handler: { openapi: { source: './specs/pets.yaml' } },
            },
          ],
          ...override,
        },
      };
      const manifestPath = path.join(workspace, 'mfe-manifest.yaml');
      await writeYaml(manifestPath, manifest);
      await fs.ensureDir(path.join(workspace, 'specs'));
      await fs.writeFile(path.join(workspace, 'specs', 'pets.yaml'), MINIMAL_PETS_SPEC, 'utf8');
      return manifestPath;
    }

    it('passes when every source spec resolves on disk', async () => {
      const manifestPath = await makeManifest();

      const result = await bffValidateCommand({ manifest: manifestPath });

      expect(result.valid).toBe(true);
      expect(result.issues).toEqual([]);
      expect(result.meshConfig.sources).toHaveLength(1);
      expect(result.meshConfig.sources[0].name).toBe('PetsAPI');
    });

    it('warns (but stays valid) when an OpenAPI spec is missing on disk', async () => {
      const manifestPath = await makeManifest({
        sources: [
          {
            name: 'GhostAPI',
            handler: { openapi: { source: './specs/does-not-exist.yaml' } },
          },
        ],
      });

      const result = await bffValidateCommand({ manifest: manifestPath });

      expect(result.valid).toBe(true); // warnings don't fail validation
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            severity: 'warning',
            message: expect.stringMatching(/spec not found/i),
          }),
        ]),
      );
    });

    it('emits warnings for unknown transform + plugin types', async () => {
      const manifestPath = await makeManifest({
        transforms: [{ unknownTransform: { something: true } } as Record<string, unknown>],
        plugins: [{ unknownPlugin: { ttl: 5 } } as Record<string, unknown>],
      });

      const result = await bffValidateCommand({ manifest: manifestPath });

      const messages = result.issues.map((i) => i.message);
      expect(messages.some((m) => /unknown transform/i.test(m))).toBe(true);
      expect(messages.some((m) => /unknown plugin/i.test(m))).toBe(true);
    });

    it('throws ValidationError when a source is missing required handler config', async () => {
      const manifestPath = path.join(workspace, 'mfe-manifest.yaml');
      await writeYaml(manifestPath, {
        name: 'broken_bff',
        version: '1.0.0',
        type: 'bff',
        data: {
          sources: [{ name: 'PetsAPI' } as Record<string, unknown>],
        },
      });

      await expect(bffValidateCommand({ manifest: manifestPath })).rejects.toThrow(
        /handler\.openapi\.source/i,
      );
    });

    it('throws when the data: section is entirely missing', async () => {
      const manifestPath = path.join(workspace, 'mfe-manifest.yaml');
      await writeYaml(manifestPath, {
        name: 'no_data',
        version: '1.0.0',
        type: 'bff',
      });

      await expect(bffValidateCommand({ manifest: manifestPath })).rejects.toThrow(
        /no "data:" section/i,
      );
    });

    it('throws when the manifest itself does not exist', async () => {
      await expect(
        bffValidateCommand({ manifest: 'no-such-manifest.yaml' }),
      ).rejects.toThrow(/manifest not found/i);
    });
  });

  describe('bff:build', () => {
    async function makeManifest(): Promise<string> {
      const manifest: BffManifest = {
        name: 'buildable_bff',
        version: '1.0.0',
        type: 'bff',
        data: {
          sources: [
            {
              name: 'PetsAPI',
              handler: { openapi: { source: './specs/pets.yaml' } },
            },
          ],
          serve: { endpoint: '/graphql', playground: true },
        },
      };
      const manifestPath = path.join(workspace, 'mfe-manifest.yaml');
      await writeYaml(manifestPath, manifest);
      await fs.ensureDir(path.join(workspace, 'specs'));
      await fs.writeFile(path.join(workspace, 'specs', 'pets.yaml'), MINIMAL_PETS_SPEC, 'utf8');
      return manifestPath;
    }

    it('writes .meshrc.yaml and invokes `npx mesh build`', async () => {
      const manifestPath = await makeManifest();

      const result = await bffBuildCommand({ manifest: manifestPath, cwd: workspace });

      expect(result.dryRun).toBe(false);
      expect(result.meshConfigPath).toBe(path.join(workspace, '.meshrc.yaml'));

      // .meshrc.yaml exists and contains the source we declared.
      const meshrcText = await fs.readFile(path.join(workspace, '.meshrc.yaml'), 'utf8');
      expect(meshrcText).toContain('PetsAPI');
      expect(meshrcText).toContain('./specs/pets.yaml');
      const meshrc = yaml.load(meshrcText) as { sources: unknown[]; serve: unknown };
      expect(Array.isArray(meshrc.sources)).toBe(true);
      expect(meshrc.serve).toEqual({ endpoint: '/graphql', playground: true });

      // mesh build was invoked exactly once on the target dir.
      const meshCalls = execSyncMock.mock.calls.filter(([cmd]) => String(cmd).includes('mesh'));
      expect(meshCalls).toHaveLength(1);
      expect(String(meshCalls[0][0])).toBe('npx mesh build');
    });

    it('dry-run reports planned changes and does NOT write .meshrc.yaml or call mesh', async () => {
      const manifestPath = await makeManifest();

      const result = await bffBuildCommand({
        manifest: manifestPath,
        cwd: workspace,
        dryRun: true,
      });

      expect(result.dryRun).toBe(true);
      expect(result.plannedChanges).toBeDefined();
      expect(result.plannedChanges!.length).toBeGreaterThan(0);
      expect(result.generatedFiles).toEqual([]);

      // No .meshrc.yaml on disk, no mesh build call.
      expect(await fs.pathExists(path.join(workspace, '.meshrc.yaml'))).toBe(false);
      expect(
        execSyncMock.mock.calls.some(([cmd]) => String(cmd).includes('mesh')),
      ).toBe(false);
    });

    it('propagates the validation failure when the manifest is broken', async () => {
      const manifestPath = path.join(workspace, 'mfe-manifest.yaml');
      await writeYaml(manifestPath, {
        name: 'broken',
        version: '1.0.0',
        type: 'bff',
        // no data: → validate must throw, build inherits the failure.
      });

      await expect(
        bffBuildCommand({ manifest: manifestPath, cwd: workspace }),
      ).rejects.toThrow(/no "data:" section/i);

      // Nothing should have been written or shelled out.
      expect(await fs.pathExists(path.join(workspace, '.meshrc.yaml'))).toBe(false);
      expect(execSyncMock).not.toHaveBeenCalled();
    });
  });

  /**
   * ADR-052 demo mode on the standalone path (#199).
   *
   * The `remote:generate` path renders `.meshrc.yaml` from `meshrc.yaml.ejs`,
   * which emits the `resolversComposition` over `Query.*` and the cache guard.
   * The standalone path does not use that template at all: `.meshrc.yaml` comes
   * from `extractMeshConfig` yaml-dumping the manifest's `data:` block. So the
   * switch has to be honoured there too, and the two files the composer resolves
   * to have to exist beside it.
   */
  describe('demo-mode mock switch on the standalone path (ADR-052)', () => {
    interface MeshrcShape {
      transforms?: Array<Record<string, unknown>>;
      plugins?: Array<Record<string, unknown>>;
      mockSwitch?: unknown;
    }

    async function makeMockSwitchManifest(
      extra: Partial<BffManifest['data']> = {},
    ): Promise<string> {
      const manifest: BffManifest = {
        name: 'demo_bff',
        version: '1.0.0',
        type: 'bff',
        data: {
          sources: [
            { name: 'PetsAPI', handler: { openapi: { source: './specs/pets.yaml' } } },
          ],
          mockSwitch: { enabled: true },
          serve: { endpoint: '/graphql', playground: true },
          ...extra,
        },
      };
      const manifestPath = path.join(workspace, 'mfe-manifest.yaml');
      await writeYaml(manifestPath, manifest);
      await fs.ensureDir(path.join(workspace, 'specs'));
      await fs.writeFile(path.join(workspace, 'specs', 'pets.yaml'), MINIMAL_PETS_SPEC, 'utf8');
      return manifestPath;
    }

    it('synthesises the resolversComposition transform into .meshrc.yaml', async () => {
      const manifestPath = await makeMockSwitchManifest();

      await bffBuildCommand({ manifest: manifestPath, cwd: workspace });

      const meshrc = yaml.load(
        await fs.readFile(path.join(workspace, '.meshrc.yaml'), 'utf8'),
      ) as MeshrcShape;

      const composition = meshrc.transforms?.find((t) => 'resolversComposition' in t) as
        | { resolversComposition: { mode: string; compositions: Array<Record<string, string>> } }
        | undefined;

      expect(composition).toBeDefined();
      expect(composition!.resolversComposition.mode).toBe('bare');
      expect(composition!.resolversComposition.compositions).toEqual([
        { resolver: 'Query.*', composer: './mock-switch#mockSwitch' },
      ]);

      // `mockSwitch` is our DSL field, not a Mesh one — it must not leak through.
      expect(meshrc.mockSwitch).toBeUndefined();
    });

    it('emits mock-switch.js and mocks.json beside .meshrc.yaml', async () => {
      const manifestPath = await makeMockSwitchManifest();

      await bffBuildCommand({ manifest: manifestPath, cwd: workspace });

      const composerPath = path.join(workspace, 'mock-switch.js');
      const fixturesPath = path.join(workspace, 'mocks.json');

      expect(await fs.pathExists(composerPath)).toBe(true);
      expect(await fs.pathExists(fixturesPath)).toBe(true);

      // The composer must export the symbol the meshrc reference names.
      const composer = await fs.readFile(composerPath, 'utf8');
      expect(composer).toContain('module.exports = { mockSwitch }');
      expect(composer).toContain("require('./mocks.json')");

      // Fixtures must be valid JSON so `require` cannot fail at Mesh build time.
      const fixturesText = await fs.readFile(fixturesPath, 'utf8');
      expect(() => JSON.parse(fixturesText)).not.toThrow();
    });

    it('never overwrites developer-owned fixtures, but does refresh the composer', async () => {
      const manifestPath = await makeMockSwitchManifest();
      const fixturesPath = path.join(workspace, 'mocks.json');
      const composerPath = path.join(workspace, 'mock-switch.js');

      await fs.writeFile(fixturesPath, '{"listPets":[{"id":7,"name":"Rex"}]}', 'utf8');
      await fs.writeFile(composerPath, '// stale hand-edit\n', 'utf8');

      await bffBuildCommand({ manifest: manifestPath, cwd: workspace });

      // mocks.json is developer-owned — preserved verbatim.
      expect(await fs.readFile(fixturesPath, 'utf8')).toBe(
        '{"listPets":[{"id":7,"name":"Rex"}]}',
      );
      // mock-switch.js is generated — regenerated over the stale edit.
      expect(await fs.readFile(composerPath, 'utf8')).toContain('module.exports = { mockSwitch }');
    });

    it('guards the response cache so mock and live are never cross-served', async () => {
      const manifestPath = await makeMockSwitchManifest({
        plugins: [{ responseCache: { ttl: 5000 } }],
      });

      await bffBuildCommand({ manifest: manifestPath, cwd: workspace });

      const meshrc = yaml.load(
        await fs.readFile(path.join(workspace, '.meshrc.yaml'), 'utf8'),
      ) as MeshrcShape;

      const cache = meshrc.plugins?.find((p) => 'responseCache' in p) as
        | { responseCache: Record<string, unknown> }
        | undefined;

      expect(cache).toBeDefined();
      expect(cache!.responseCache.ttl).toBe(5000);
      expect(cache!.responseCache.if).toBe("context.headers?.get?.('x-bff-mode') == null");
    });

    it('leaves a manifest without the switch completely untouched', async () => {
      const manifest: BffManifest = {
        name: 'plain_bff',
        version: '1.0.0',
        type: 'bff',
        data: {
          sources: [
            { name: 'PetsAPI', handler: { openapi: { source: './specs/pets.yaml' } } },
          ],
          plugins: [{ responseCache: { ttl: 5000 } }],
          serve: { endpoint: '/graphql', playground: true },
        },
      };
      const manifestPath = path.join(workspace, 'mfe-manifest.yaml');
      await writeYaml(manifestPath, manifest);
      await fs.ensureDir(path.join(workspace, 'specs'));
      await fs.writeFile(path.join(workspace, 'specs', 'pets.yaml'), MINIMAL_PETS_SPEC, 'utf8');

      await bffBuildCommand({ manifest: manifestPath, cwd: workspace });

      const meshrc = yaml.load(
        await fs.readFile(path.join(workspace, '.meshrc.yaml'), 'utf8'),
      ) as MeshrcShape;

      expect(meshrc.transforms).toBeUndefined();
      const cache = meshrc.plugins?.find((p) => 'responseCache' in p) as
        | { responseCache: Record<string, unknown> }
        | undefined;
      expect(cache!.responseCache.if).toBeUndefined();

      expect(await fs.pathExists(path.join(workspace, 'mock-switch.js'))).toBe(false);
      expect(await fs.pathExists(path.join(workspace, 'mocks.json'))).toBe(false);
    });

    it('scaffolds the demo-mode files when bff:init adds a BFF to an MFE that wants them', async () => {
      // `bff:init` in add-to-existing mode derives the template name from the
      // directory, and the name check rejects hyphens — so the project dir has
      // to be underscore-named, unlike the hyphenated temp workspace.
      const projectDir = path.join(workspace, 'demo_host_mfe');
      await fs.ensureDir(path.join(projectDir, 'specs'));
      await writeYaml(path.join(projectDir, 'mfe-manifest.yaml'), {
        name: 'demo_host_mfe',
        version: '1.0.0',
        type: 'remote',
        data: {
          sources: [
            { name: 'PetsAPI', handler: { openapi: { source: './specs/pets.yaml' } } },
          ],
          mockSwitch: { enabled: true },
          serve: { endpoint: '/graphql', playground: true },
        },
      } satisfies BffManifest);
      await fs.writeFile(path.join(projectDir, 'specs', 'pets.yaml'), MINIMAL_PETS_SPEC, 'utf8');
      process.chdir(projectDir);

      const result = await bffInitCommand(undefined, { port: 4403 });

      expect(await fs.pathExists(path.join(projectDir, 'mock-switch.js'))).toBe(true);
      expect(await fs.pathExists(path.join(projectDir, 'mocks.json'))).toBe(true);
      expect(result.generatedFiles).toEqual(
        expect.arrayContaining(['mock-switch.js', 'mocks.json']),
      );
    });

    it('does not scaffold demo-mode files for an MFE that has not asked for them', async () => {
      const projectDir = path.join(workspace, 'plain_host_mfe');
      await fs.ensureDir(path.join(projectDir, 'specs'));
      await writeYaml(path.join(projectDir, 'mfe-manifest.yaml'), {
        name: 'plain_host_mfe',
        version: '1.0.0',
        type: 'remote',
        data: {
          sources: [
            { name: 'PetsAPI', handler: { openapi: { source: './specs/pets.yaml' } } },
          ],
          serve: { endpoint: '/graphql', playground: true },
        },
      } satisfies BffManifest);
      await fs.writeFile(path.join(projectDir, 'specs', 'pets.yaml'), MINIMAL_PETS_SPEC, 'utf8');
      process.chdir(projectDir);

      await bffInitCommand(undefined, { port: 4404 });

      expect(await fs.pathExists(path.join(projectDir, 'mock-switch.js'))).toBe(false);
      expect(await fs.pathExists(path.join(projectDir, 'mocks.json'))).toBe(false);
    });
  });

  describe('bff:validate → bff:build end-to-end', () => {
    it('runs validate → build against a hand-rolled BFF project tree', async () => {
      // Build a BFF project tree manually (bypassing the broken bff:init template
      // path) so we can exercise validate + build end-to-end against real fs.
      const projectDir = path.join(workspace, 'e2e_bff');
      await fs.ensureDir(path.join(projectDir, 'specs'));
      const manifestPath = path.join(projectDir, 'mfe-manifest.yaml');
      const manifest: BffManifest = {
        name: 'e2e_bff',
        version: '1.0.0',
        type: 'bff',
        data: {
          sources: [
            {
              name: 'PetsAPI',
              handler: { openapi: { source: './specs/pets.yaml' } },
            },
          ],
          serve: { endpoint: '/graphql', playground: true },
        },
      };
      await writeYaml(manifestPath, manifest);
      await fs.writeFile(
        path.join(projectDir, 'specs', 'pets.yaml'),
        MINIMAL_PETS_SPEC,
        'utf8',
      );

      process.chdir(projectDir);

      // Step 1: validate must succeed cleanly.
      const validateResult = await bffValidateCommand({ manifest: manifestPath });
      expect(validateResult.valid).toBe(true);
      expect(validateResult.issues).toEqual([]);

      // Step 2: build writes .meshrc.yaml and triggers mesh build.
      execSyncMock.mockClear();
      const buildResult = await bffBuildCommand({
        manifest: manifestPath,
        cwd: projectDir,
      });
      expect(buildResult.dryRun).toBe(false);
      expect(buildResult.meshConfigPath).toBe(path.join(projectDir, '.meshrc.yaml'));
      expect(await fs.pathExists(path.join(projectDir, '.meshrc.yaml'))).toBe(true);
      expect(
        execSyncMock.mock.calls.some(([cmd]) => String(cmd).includes('npx mesh build')),
      ).toBe(true);
    });
  });
});
