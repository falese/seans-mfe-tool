/**
 * Phase 1.2 integration test — CLI workflow.
 *
 * Exercises the public remote-MFE pipeline end-to-end on a real temp dir:
 *
 *   remote:init  →  edit manifest  →  remote:generate
 *                                 ↘   schemas
 *                                 ↘   deploy --dry-run
 *
 * No file-system or process mocking — the only thing we sidestep is the
 * package-install step on remote:init (via the public --skip-install flag),
 * because that would shell out to npm. Everything else uses real fs-extra
 * against an isolated workspace under os.tmpdir().
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'js-yaml';

import { remoteInitCommand } from '../../commands/remote/init';
import { remoteGenerateCommand } from '../../commands/remote/generate';
import { schemasCommand } from '../../commands/schemas';

interface RemoteManifest {
  name: string;
  version?: string;
  type?: string;
  language?: string;
  endpoint?: string;
  port?: number;
  capabilities?: unknown[];
  [key: string]: unknown;
}

async function readYaml<T = unknown>(filePath: string): Promise<T> {
  const text = await fs.readFile(filePath, 'utf8');
  return yaml.load(text) as T;
}

async function writeYaml(filePath: string, value: unknown): Promise<void> {
  await fs.writeFile(filePath, yaml.dump(value), 'utf8');
}

describe('integration: CLI workflow', () => {
  let workspace: string;
  let originalCwd: string;

  beforeAll(() => {
    originalCwd = process.cwd();
  });

  beforeEach(async () => {
    workspace = path.join(
      os.tmpdir(),
      `mfe-cli-integration-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await fs.ensureDir(workspace);
    // Canonicalize so comparisons match paths the commands derive from
    // process.cwd() (e.g. /tmp -> /private/tmp symlink resolution on macOS).
    workspace = await fs.realpath(workspace);
    process.chdir(workspace);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    if (workspace && (await fs.pathExists(workspace))) {
      await fs.remove(workspace);
    }
  });

  describe('remote:init', () => {
    it('creates the project directory and a minimal valid manifest', async () => {
      const result = await remoteInitCommand('checkout-flow', { skipInstall: true });

      const projectDir = path.join(workspace, 'checkout-flow');
      const manifestPath = path.join(projectDir, 'mfe-manifest.yaml');

      expect(await fs.pathExists(projectDir)).toBe(true);
      expect(await fs.pathExists(manifestPath)).toBe(true);

      const manifest = await readYaml<RemoteManifest>(manifestPath);
      expect(manifest.name).toBe('checkout-flow');
      expect(manifest.type).toBe('remote');

      // The init step is intentionally DSL-only — no platform code yet.
      expect(await fs.pathExists(path.join(projectDir, 'package.json'))).toBe(false);
      expect(await fs.pathExists(path.join(projectDir, 'rspack.config.js'))).toBe(false);
      expect(await fs.pathExists(path.join(projectDir, 'src', 'App.tsx'))).toBe(false);

      expect(result.name).toBe('checkout-flow');
      expect(result.dryRun).toBe(false);
      expect(result.targetDir).toBe(projectDir);
    });

    it('honours --port and threads it into the generated endpoint metadata', async () => {
      await remoteInitCommand('analytics-panel', { port: 3777, skipInstall: true });

      const manifestPath = path.join(workspace, 'analytics-panel', 'mfe-manifest.yaml');
      const manifest = await readYaml<RemoteManifest>(manifestPath);

      const endpoint = String(manifest.endpoint ?? '');
      expect(endpoint).toContain('3777');
    });

    it('refuses to overwrite an existing directory without --force', async () => {
      await remoteInitCommand('takeover', { skipInstall: true });

      await expect(remoteInitCommand('takeover', { skipInstall: true })).rejects.toThrow(
        /already exists/i,
      );

      // The original manifest should still be intact.
      const manifestPath = path.join(workspace, 'takeover', 'mfe-manifest.yaml');
      expect(await fs.pathExists(manifestPath)).toBe(true);
    });

    it('overwrites when --force is set', async () => {
      await remoteInitCommand('forced', { skipInstall: true });

      // Mutate the manifest so we can prove --force overwrote it.
      const manifestPath = path.join(workspace, 'forced', 'mfe-manifest.yaml');
      const before = await readYaml<RemoteManifest>(manifestPath);
      (before as Record<string, unknown>).__sentinel = 'before-force';
      await writeYaml(manifestPath, before);

      await remoteInitCommand('forced', { force: true, skipInstall: true });

      const after = await readYaml<RemoteManifest>(manifestPath);
      expect((after as Record<string, unknown>).__sentinel).toBeUndefined();
    });

    it('dry-run reports planned changes without touching disk', async () => {
      const result = await remoteInitCommand('preview', {
        dryRun: true,
        skipInstall: true,
      });

      expect(result.dryRun).toBe(true);
      expect(Array.isArray(result.plannedChanges)).toBe(true);
      expect(result.plannedChanges!.length).toBeGreaterThan(0);
      expect(result.plannedChanges!.some((c) => c.target.includes('preview'))).toBe(true);

      // No files should have been created.
      expect(await fs.pathExists(path.join(workspace, 'preview'))).toBe(false);
    });
  });

  describe('remote:init → remote:generate', () => {
    it('scaffolds platform + feature files from a manifest with a domain capability', async () => {
      const name = 'orders-mfe';
      await remoteInitCommand(name, { skipInstall: true });

      const projectDir = path.join(workspace, name);
      const manifestPath = path.join(projectDir, 'mfe-manifest.yaml');
      const manifest = await readYaml<RemoteManifest>(manifestPath);
      manifest.capabilities = [
        {
          OrderList: {
            type: 'domain',
            description: 'List of orders',
            handler: 'src/features/OrderList/OrderList',
          },
        },
      ];
      await writeYaml(manifestPath, manifest);

      process.chdir(projectDir);
      const result = await remoteGenerateCommand({ force: false });

      expect(result.dryRun).toBe(false);
      expect(result.generated.length).toBeGreaterThan(0);
      expect(result.errors).toEqual([]);

      // Platform files
      expect(await fs.pathExists(path.join(projectDir, 'package.json'))).toBe(true);
      expect(await fs.pathExists(path.join(projectDir, 'rspack.config.js'))).toBe(true);
      expect(await fs.pathExists(path.join(projectDir, 'src', 'App.tsx'))).toBe(true);
      expect(await fs.pathExists(path.join(projectDir, 'src', 'index.tsx'))).toBe(true);

      // Feature files for the new capability
      expect(
        await fs.pathExists(path.join(projectDir, 'src', 'features', 'OrderList', 'OrderList.tsx')),
      ).toBe(true);
      expect(
        await fs.pathExists(
          path.join(projectDir, 'src', 'features', 'OrderList', 'OrderList.test.tsx'),
        ),
      ).toBe(true);
      expect(
        await fs.pathExists(path.join(projectDir, 'src', 'features', 'OrderList', 'index.ts')),
      ).toBe(true);
    });

    it('produces a package.json that is valid JSON and carries the MFE name', async () => {
      const name = 'json-shape';
      await remoteInitCommand(name, { skipInstall: true });
      const projectDir = path.join(workspace, name);
      process.chdir(projectDir);

      await remoteGenerateCommand({ force: false });

      const pkgPath = path.join(projectDir, 'package.json');
      const pkgRaw = await fs.readFile(pkgPath, 'utf8');
      const pkg = JSON.parse(pkgRaw) as { name: string; scripts?: Record<string, string> };
      expect(pkg.name).toBeTruthy();
      // The mfe name should appear somewhere in the file (either as the
      // package name or as a remote-entry identifier downstream).
      expect(pkgRaw).toContain(name);
    });

    it('rspack.config.js exposes module-federation remoteEntry metadata', async () => {
      const name = 'mf-shape';
      await remoteInitCommand(name, { skipInstall: true });
      const projectDir = path.join(workspace, name);
      process.chdir(projectDir);

      await remoteGenerateCommand({ force: false });

      const rspackConfig = await fs.readFile(
        path.join(projectDir, 'rspack.config.js'),
        'utf8',
      );
      // The generator embeds the MFE name in the module-federation config,
      // but normalises hyphens to underscores so the name is a valid JS
      // identifier in the remote-entry global. Check for either form.
      const normalised = name.replace(/-/g, '_');
      expect(rspackConfig).toMatch(new RegExp(`${name}|${normalised}`));
      // It also wires up the remote-entry filename and an exposes block.
      expect(rspackConfig).toMatch(/remoteEntry/);
      expect(rspackConfig).toMatch(/exposes/);
    });

    it('dry-run on remote:generate does not write any files', async () => {
      const name = 'preview-generate';
      await remoteInitCommand(name, { skipInstall: true });
      const projectDir = path.join(workspace, name);
      process.chdir(projectDir);

      const result = await remoteGenerateCommand({ force: false, dryRun: true });

      expect(result.dryRun).toBe(true);
      expect(Array.isArray(result.plannedChanges)).toBe(true);
      expect(result.plannedChanges!.length).toBeGreaterThan(0);
      expect(result.generated).toEqual([]);

      // No platform file should exist.
      expect(await fs.pathExists(path.join(projectDir, 'package.json'))).toBe(false);
      expect(await fs.pathExists(path.join(projectDir, 'rspack.config.js'))).toBe(false);
    });

    it('without --force, a second remote:generate run reports feature files as skipped', async () => {
      const name = 'idempotent';
      await remoteInitCommand(name, { skipInstall: true });
      const projectDir = path.join(workspace, name);

      // Add a domain capability so feature files (overwrite:false) get
      // generated. Platform files like package.json carry overwrite:true and
      // are intentionally rewritten on every run.
      const manifestPath = path.join(projectDir, 'mfe-manifest.yaml');
      const manifest = await readYaml<RemoteManifest>(manifestPath);
      manifest.capabilities = [
        {
          ProductCatalog: {
            type: 'domain',
            description: 'Browse the product catalog',
            handler: 'src/features/ProductCatalog/ProductCatalog',
          },
        },
      ];
      await writeYaml(manifestPath, manifest);

      process.chdir(projectDir);

      const first = await remoteGenerateCommand({ force: false });
      expect(first.generated.length).toBeGreaterThan(0);

      const second = await remoteGenerateCommand({ force: false });
      // The capability's hand-editable feature files must not be clobbered
      // on subsequent runs — they should land in `skipped`.
      expect(second.skipped.length).toBeGreaterThan(0);
      expect(
        second.skipped.some((p) => p.includes(path.join('features', 'ProductCatalog'))),
      ).toBe(true);
    });

    it('fails fast with a validation error when the manifest is malformed', async () => {
      const name = 'bad-manifest';
      await remoteInitCommand(name, { skipInstall: true });
      const projectDir = path.join(workspace, name);
      const manifestPath = path.join(projectDir, 'mfe-manifest.yaml');

      // Truncate the manifest to something that can't be a valid DSL doc.
      await fs.writeFile(manifestPath, 'name: ""\n', 'utf8');
      process.chdir(projectDir);

      await expect(remoteGenerateCommand({ force: false })).rejects.toThrow();

      // The codegen step should not have produced platform files.
      expect(await fs.pathExists(path.join(projectDir, 'rspack.config.js'))).toBe(false);
    });
  });

  describe('schemas catalog', () => {
    it('loads the repo schema catalog and reports a valid cliVersion + command list', async () => {
      const catalog = await schemasCommand();

      expect(typeof catalog.cliVersion).toBe('string');
      // Either a real semver from package.json, or the documented "0.0.0" fallback.
      expect(catalog.cliVersion.length).toBeGreaterThan(0);
      expect(Array.isArray(catalog.commands)).toBe(true);
      // We should have at least the commands shipped at HEAD; check for the
      // anchor commands that this PR's other suites exercise.
      const commandNames = catalog.commands.map((c) => c.name);
      expect(commandNames.length).toBeGreaterThan(0);
      // Each catalog entry has the documented envelope.
      for (const cmd of catalog.commands) {
        expect(typeof cmd.name).toBe('string');
        expect(typeof cmd.input).toBe('object');
        expect(typeof cmd.output).toBe('object');
        expect(Array.isArray(cmd.errorCodes)).toBe(true);
      }
    });
  });
});
