/**
 * Migration safety net for ADR-083.
 *
 * Both reference fleets stopped hand-writing `rules.json` and now author a
 * `control-plane.yaml` that the compiler expands. That migration is only
 * trustworthy if the compiled payload is what the registry was already being
 * given — so this pins the compiler's output against the `rules.json` each
 * fleet ships.
 *
 * This is the characterization idiom ADR-061 used when the generator moved
 * packages: prove the new path reproduces the old output, then trust it.
 *
 * When a fleet's composition legitimately changes, `control-plane:build`
 * rewrites `rules.json` and this test moves with it. It is here to catch the
 * compiler changing meaning, not to freeze composition.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { compileControlPlane } from '../control-plane-compiler';
import { ControlPlaneDocumentSchema } from '../control-plane-schema';
import { DSLManifestSchema, type DSLManifest } from '../schema';

const EXAMPLES = path.join(__dirname, '../../../../examples');

interface Fleet {
  name: string;
  /** MFE directory names differ from MFE ids in abc-kids (`flappy` vs `abc-kids-flappy`). */
  directoryFor: (mfeId: string) => string;
}

const FLEETS: Fleet[] = [
  { name: 'meridian-station', directoryFor: (id) => id },
  { name: 'abc-kids', directoryFor: (id) => id.replace(/^abc-kids-/, '') },
];

function loadFleet(fleet: Fleet): {
  compiled: ReturnType<typeof compileControlPlane>;
  shipped: unknown[];
} {
  const root = path.join(EXAMPLES, fleet.name);

  const document = ControlPlaneDocumentSchema.parse(
    yaml.load(fs.readFileSync(path.join(root, 'control-plane/control-plane.yaml'), 'utf8'))
  );

  const manifests: DSLManifest[] = document.mfes.map((mfeId) => {
    const manifestPath = path.join(root, fleet.directoryFor(mfeId), 'mfe-manifest.yaml');
    return DSLManifestSchema.parse(yaml.load(fs.readFileSync(manifestPath, 'utf8')));
  });

  return {
    compiled: compileControlPlane({ document, manifests }),
    shipped: JSON.parse(fs.readFileSync(path.join(root, 'control-plane/rules.json'), 'utf8')),
  };
}

describe.each(FLEETS)('$name — compiled composition matches the shipped payload', (fleet) => {
  const { compiled, shipped } = loadFleet(fleet);

  it('compiles with no fatal findings', () => {
    expect(compiled.findings.filter((f) => f.fatal)).toEqual([]);
  });

  it('registers the same MFEs, in the same order', () => {
    expect(compiled.payload.map((d) => d.registration.name)).toEqual(
      (shipped as { registration: { name: string } }[]).map((d) => d.registration.name)
    );
  });

  it('derives byte-equal registrations (ADR-074)', () => {
    // The nine fields, per MFE. A mismatch here is the runtime
    // `Module "./App" does not exist in container` failure, caught at build.
    expect(compiled.payload.map((d) => d.registration)).toEqual(
      (shipped as { registration: unknown }[]).map((d) => d.registration)
    );
  });

  it('produces the same routes, per MFE, in the same order', () => {
    expect(compiled.payload.map((d) => d.routes)).toEqual(
      (shipped as { routes: unknown }[]).map((d) => d.routes ?? [])
    );
  });
});
