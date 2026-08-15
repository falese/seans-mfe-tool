/**
 * `.gitignore` is generator-owned (#341).
 *
 * It was seeded once and never touched again, so `check:mfe-drift` — which
 * only compares generator-owned files — did not cover it, and whether a given
 * MFE had one depended on whether anyone had happened to run `remote:generate`
 * in it. Across the fleet: 7 of 8 meridian MFEs had one committed, 0 of 13
 * abc-kids.
 *
 * The reason it belongs on the generator's side is not just uniformity: every
 * line of the template names a build artifact **the platform itself produces**
 * — `.mesh/`, `dist/`, `out-tsc/`, the compiled `server.js` (#274). The
 * platform knows what it emits; a developer should not have to track that list
 * by hand and re-discover it when the platform adds an output.
 *
 * The cost, accepted deliberately: regeneration now overwrites this file, so a
 * customised `.gitignore` in an MFE outside this repo loses its edits. That is
 * the behaviour ADR-082 exists to prevent, and it cannot warn here — its
 * registry is scoped to developer-owned files and this one no longer is.
 *
 * The other root templates must stay developer-owned. `package.json` is the
 * file an MFE author edits most, and sweeping it up alongside `.gitignore`
 * would be a far more destructive change than the one intended.
 */

import path from 'path';
import { generateAllFiles } from '../unified-generator';

const BASE = path.join(__dirname, 'output-gitignore-ownership');

const manifest = (framework: string) => ({
  name: `IgnoreMFE${framework}`,
  version: '1.0.0',
  description: 'Fixture for .gitignore ownership',
  endpoint: 'http://localhost:3001',
  framework,
  capabilities: [{ Dashboard: { type: 'domain', description: 'A dashboard' } }],
  dependencies: { 'design-system': {}, mfes: {} },
});

describe('.gitignore ownership (#341)', () => {
  afterAll(async () => {
    const fs = await import('fs-extra');
    await fs.remove(BASE);
  });

  const generate = async (framework: string) => {
    jest.spyOn(console, 'warn').mockImplementation();
    const { files } = await generateAllFiles(
      manifest(framework) as never,
      path.join(BASE, framework),
      { force: true } as never,
    );
    jest.restoreAllMocks();
    return files;
  };

  describe.each(['react', 'angular'])('the %s variant', (framework) => {
    let files: Array<{ path: string; overwrite: boolean }>;

    beforeAll(async () => {
      files = (await generate(framework)) as never;
    });

    const emitted = (name: string) => files.find((f) => f.path.endsWith(name));

    it('emits .gitignore as generator-owned, so the drift gate covers it', () => {
      const gitignore = emitted('.gitignore');

      expect(gitignore).toBeDefined();
      expect(gitignore!.overwrite).toBe(true);
    });

    it('leaves package.json developer-owned — the file authors edit most', () => {
      // The failure this guards is a careless `overwrite: true` on the whole
      // rootTemplates list, which would silently start stomping dependencies,
      // scripts and version on every regenerate.
      expect(emitted('package.json')!.overwrite).toBe(false);
    });
  });

  describe.each(['react', 'angular'])('.dockerignore for the %s variant', (framework) => {
    // A missing .dockerignore is not a cosmetic gap. Without it, `COPY . .`
    // drags the host's node_modules into the image on top of the runtime the
    // Dockerfile staged there, and the build dies on
    //   cannot replace to directory .../@falese/smt-runtime with file
    // — because npm leaves a symlink where the image has a real directory.
    // Exactly one MFE in the fleet lacked the file, and that is the one that
    // failed. Generating it removes the possibility.
    let files: Array<{ path: string; content: string; overwrite: boolean }>;

    beforeAll(async () => {
      files = (await generate(framework)) as never;
    });

    const dockerignore = () => files.find((f) => f.path.endsWith('.dockerignore'));

    it('is emitted at all', () => {
      expect(dockerignore()).toBeDefined();
    });

    it('is generator-owned, so check:mfe-drift notices it going missing', () => {
      expect(dockerignore()!.overwrite).toBe(true);
    });

    it('excludes node_modules — the entry that prevents the COPY clash', () => {
      expect(dockerignore()!.content).toMatch(/^node_modules$/m);
    });

    it('excludes the build artifacts the platform itself produces', () => {
      const content = dockerignore()!.content;
      for (const artifact of ['dist', '.mesh', 'server.js']) {
        expect(content).toMatch(new RegExp(`^${artifact.replace('.', '\\.')}$`, 'm'));
      }
    });
  });

  it('still ignores the build artifacts #274 added it for', async () => {
    const files = (await generate('react')) as never as Array<{
      path: string;
      content: string;
    }>;
    const content = files.find((f) => f.path.endsWith('.gitignore'))!.content;

    for (const artifact of ['.mesh/', 'dist/', '/server.js', 'node_modules/']) {
      expect(content).toContain(artifact);
    }
  });
});
