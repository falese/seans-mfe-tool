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
