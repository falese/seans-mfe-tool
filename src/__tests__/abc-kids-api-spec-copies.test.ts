/**
 * Every MFE's copy of the ABC Kids API spec matches the canonical one.
 *
 * The BFFs read the spec from inside their own directory rather than from
 * `examples/abc-kids/api/`, and not by preference: each MFE's Docker build
 * context IS its own directory (`context: ./flappy`), so `npx mesh build`
 * inside the image cannot reach a file one level up. Pointing a manifest at
 * `../api/abc-kids-api.yaml` produces a repo that looks right, passes the
 * drift gate, and fails at image build.
 *
 * Copies are therefore required — which makes them a drift source. This is the
 * gate that keeps them honest, in the absence of a build that could prove it
 * here (there is no Docker in the toolchain this runs in).
 */

import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const FLEET = path.join(REPO_ROOT, 'examples', 'abc-kids');
const CANONICAL = path.join(FLEET, 'api', 'abc-kids-api.yaml');

/** Every MFE whose manifest declares a `data:` section reads the spec. */
function mfesWithBff(): string[] {
  return fs
    .readdirSync(FLEET, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => {
      const manifest = path.join(FLEET, name, 'mfe-manifest.yaml');
      return fs.existsSync(manifest) && /^data:/m.test(fs.readFileSync(manifest, 'utf8'));
    })
    .sort();
}

describe('abc-kids API spec copies', () => {
  it('has a canonical spec', () => {
    expect(fs.existsSync(CANONICAL)).toBe(true);
  });

  it('finds the BFF-bearing MFEs', () => {
    expect(mfesWithBff()).toEqual(['flappy', 'multiplication-quiz']);
  });

  describe.each(mfesWithBff())('%s', (mfe) => {
    const copy = path.join(FLEET, mfe, 'specs', 'abc-kids-api.yaml');

    it('ships the spec inside its own build context', () => {
      expect(fs.existsSync(copy)).toBe(true);
    });

    it('is byte-identical to the canonical spec', () => {
      expect(fs.readFileSync(copy, 'utf8')).toBe(fs.readFileSync(CANONICAL, 'utf8'));
    });

    it('reads the spec by a context-relative path, never a parent path', () => {
      // `../api/...` resolves on a developer's disk and breaks in the image.
      const meshrc = fs.readFileSync(path.join(FLEET, mfe, '.meshrc.yaml'), 'utf8');
      expect(meshrc).toMatch(/source:\s*\.\/specs\/abc-kids-api\.yaml/);
      expect(meshrc).not.toMatch(/source:\s*\.\.\//);
    });

    it('no longer points at the sample Pet Store', () => {
      const manifest = fs.readFileSync(path.join(FLEET, mfe, 'mfe-manifest.yaml'), 'utf8');
      expect(manifest).not.toMatch(/petstore/i);
      expect(manifest).toMatch(/AbcKidsPlayAPI/);
    });
  });
});

/**
 * The prefix the generated Express app actually mounts its routes under, read
 * from the template rather than hardcoded — if the generator's mount point
 * moves, this test moves with it instead of silently passing.
 */
function generatedMountPrefix(): string {
  const indexJs = fs.readFileSync(
    path.join(REPO_ROOT, 'packages', 'plugin-api', 'templates', 'api', 'base', 'src', 'index.js'),
    'utf8',
  );
  const mount = /app\.use\(\s*'([^']+)'\s*,\s*require\('\.\/routes'\)\s*\)/.exec(indexJs);
  if (!mount) {
    throw new Error(
      'Could not find the routes mount in the API base template. If the template changed, ' +
        'update this matcher — the spec `servers:` URLs depend on the mount point.',
    );
  }
  return mount[1];
}

/**
 * `servers:` has to agree with where the service actually serves.
 *
 * A spec declaring `http://abc-kids-api:3101` while the app mounts its routes
 * at `/api` produces a fleet where every REST call works when curled directly
 * and every GraphQL query 404s — because Mesh builds upstream URLs from
 * `servers:`. Nothing else in the repo compares the two: the copy test above
 * checks the copies agree with each other, and consistency/drift never read
 * the spec's server list at all. Found by a reviewer running the fleet.
 */
describe('abc-kids API spec servers', () => {
  const specs = [CANONICAL, ...mfesWithBff().map((m) => path.join(FLEET, m, 'specs', 'abc-kids-api.yaml'))];

  it.each(specs.map((s) => [path.relative(REPO_ROOT, s), s]))(
    '%s declares servers that carry the generated mount prefix',
    (_label, spec) => {
      const prefix = generatedMountPrefix();
      const urls = [...fs.readFileSync(spec, 'utf8').matchAll(/^\s*-\s*url:\s*(\S+)/gm)].map(
        (m) => m[1],
      );

      expect(urls.length).toBeGreaterThan(0);
      for (const url of urls) {
        expect(url.endsWith(prefix)).toBe(true);
      }
    },
  );
});

/**
 * Demo mode has to actually differ from live (ADR-052).
 *
 * `mock-switch.js` looks a fixture up by GraphQL field name and calls `next()`
 * on a miss — so a `mocks.json` whose keys do not match the schema does not
 * fail, it silently serves live data under `x-bff-mode: mock`. Both fixtures
 * in this fleet were exactly that: one still held Pet Store keys, the other
 * held no fixtures at all, and every gate stayed green because a miss is a
 * legal state. This asserts the keys line up with the spec the BFF reads.
 *
 * GET operations become Query fields (which mock-switch wraps); POST becomes a
 * Mutation, which it does not — so only GETs are required to have a fixture.
 */
describe('abc-kids demo-mode fixtures', () => {
  /** operationIds of GET operations — the Query fields mock-switch can serve. */
  function queryFieldNames(specText: string): string[] {
    const names: string[] = [];
    let inGet = false;
    for (const line of specText.split('\n')) {
      const verb = /^\s{4}(get|post|put|patch|delete):\s*$/.exec(line);
      if (verb) inGet = verb[1] === 'get';
      const op = /^\s*operationId:\s*(\S+)/.exec(line);
      if (op && inGet) names.push(op[1]);
    }
    return names.sort();
  }

  describe.each(mfesWithBff())('%s', (mfe) => {
    const mocksPath = path.join(FLEET, mfe, 'src', 'platform', 'bff', 'mocks.json');

    it('has a fixture for every Query field the spec exposes', () => {
      const expected = queryFieldNames(fs.readFileSync(CANONICAL, 'utf8'));
      const fixtures = JSON.parse(fs.readFileSync(mocksPath, 'utf8')) as Record<string, unknown>;
      const keys = Object.keys(fixtures)
        .filter((k) => !k.startsWith('_'))
        .sort();

      expect(expected.length).toBeGreaterThan(0);
      expect(keys).toEqual(expected);
    });

    it('holds no leftover sample-spec fixtures', () => {
      // Names the sample spec's own identifiers rather than the substring
      // "pet": a word boundary does not survive inside `listPets`, and without
      // one the matcher fires on an innocent "competitor".
      const raw = fs.readFileSync(mocksPath, 'utf8');
      expect(raw).not.toMatch(/listPets|getPet\b|findPetsByStatus|petstore|pet store/i);
    });
  });
});
