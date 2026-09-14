/**
 * A capability name is manifest data, so it must never be read as a key on
 * Object.prototype.
 *
 * `planRenderModel` builds its platform-capability table with
 * `Object.fromEntries`, which produces an ordinary object — one that answers
 * for `toString`, `constructor`, `valueOf` and every other inherited key as
 * readily as for `Health`. The lookup was `platformCapabilities[method]`
 * followed by a truthiness check, so a capability named `toString` took the
 * PLATFORM branch (the inherited function is truthy) and was pushed into the
 * render model with `method: undefined`.
 *
 * The symptom is not a crash. It is a generated file containing `undefined`
 * where a method name belongs, from a manifest that passed Zod validation.
 *
 * Same class as the `ALIASES` table in `@seans-mfe/contracts` — see
 * `mesh-catalog.test.ts`. Both are "index a table with untrusted text".
 */

import { generateAllFiles } from '../unified-generator';

const manifestWith = (capabilityName: string) =>
  ({
    name: 'proto-probe',
    version: '1.0.0',
    type: 'remote',
    endpoint: 'http://localhost:3001',
    capabilities: [{ [capabilityName]: { type: 'domain', description: 'probe' } }],
  }) as never;

// Names that exist on Object.prototype. Not adversarial: `constructor` and
// `toString` are plausible capability names in a domain about objects or
// rendering, and a manifest author has no reason to expect them to be special.
const INHERITED = ['toString', 'constructor', 'valueOf', 'hasOwnProperty'];

describe('capability names inherited from Object.prototype', () => {
  it.each(INHERITED)('treats %p as a domain capability, not a platform one', async (name) => {
    const { files } = await generateAllFiles(manifestWith(name), '/tmp/proto-probe-unused', {
      dryRun: true,
    });

    // The platform branch would emit the capability with `method: undefined`.
    // The domain branch names it. Reading the rendered mfe.ts is the honest
    // check: it is what a developer would actually receive.
    const mfe = files.find((f) => f.path.endsWith('src/platform/base-mfe/mfe.ts'));
    expect(mfe).toBeDefined();
    expect(mfe!.content).not.toMatch(/\bundefined\s*\(/);
    expect(mfe!.content).toContain(name);
  });

  it('still routes a real platform capability through the platform branch', async () => {
    const { files } = await generateAllFiles(
      {
        name: 'platform-probe',
        version: '1.0.0',
        type: 'remote',
        endpoint: 'http://localhost:3001',
        capabilities: [{ Health: { type: 'platform', description: 'health' } }],
      } as never,
      '/tmp/platform-probe-unused',
      { dryRun: true },
    );

    const mfe = files.find((f) => f.path.endsWith('src/platform/base-mfe/mfe.ts'));
    expect(mfe!.content).not.toMatch(/\bundefined\s*\(/);
  });
});

describe('a capability named for a prototype key keeps its own description', () => {
  // `featureSpecs` found its manifest entry with `capability in e`, and
  // `'constructor' in e` is true of every object — so the find matched the
  // FIRST entry whatever the capability was, `[capability]` on it was
  // undefined, and the author's description was replaced by the generic
  // default. The single-capability probe above cannot see this: it needs a
  // second entry for the wrong one to be matched.
  const twoCapabilities = (name: string) =>
    ({
      name: 'desc-probe',
      version: '1.0.0',
      type: 'remote',
      endpoint: 'http://localhost:3001',
      capabilities: [
        { Dashboard: { type: 'domain', description: 'the first entry' } },
        { [name]: { type: 'domain', description: 'MY OWN DESCRIPTION' } },
      ],
    }) as never;

  it.each(['toString', 'constructor', 'valueOf'])(
    'uses the description declared for %p, not the first entry it finds',
    async (name) => {
      const { files } = await generateAllFiles(twoCapabilities(name), '/tmp/desc-probe-unused', {
        dryRun: true,
      });
      const component = files.find((f) => f.path.includes(`src/features/${name}/`));
      expect(component).toBeDefined();
      expect(component!.content).toContain('MY OWN DESCRIPTION');
      expect(component!.content).not.toContain('the first entry');
    },
  );
});
