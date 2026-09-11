/**
 * One classification of Mesh plugins and transforms (ADR-090).
 *
 * Before this module the same knowledge existed in four places with three
 * different spellings, and two of them ran on the same manifest field and
 * disagreed. These tests pin the canonical form, the alias behaviour that keeps
 * existing manifests working, and the genuinely-ambiguous names that must never
 * be reported as misclassified.
 */

import {
  MESH_PLUGINS,
  MESH_TRANSFORMS,
  MESH_AMBIGUOUS,
  canonicalMeshName,
  classifyMeshEntry,
} from '../mesh-catalog';

describe('canonicalMeshName', () => {
  it('leaves a canonical Mesh config key alone', () => {
    expect(canonicalMeshName('filterSchema')).toBe('filterSchema');
    expect(canonicalMeshName('responseCache')).toBe('responseCache');
  });

  it('maps the npm package spelling onto the config key', () => {
    // `@graphql-mesh/transform-filter-schema` is the package; `filterSchema` is
    // what .meshrc.yaml is keyed by. Both spellings reach a manifest, so both
    // resolve rather than one being an error.
    expect(canonicalMeshName('filter-schema')).toBe('filterSchema');
    expect(canonicalMeshName('rate-limit')).toBe('rateLimit');
    expect(canonicalMeshName('resolvers-composition')).toBe('resolversComposition');
    expect(canonicalMeshName('response-cache')).toBe('responseCache');
    expect(canonicalMeshName('type-merging')).toBe('typeMerging');
    expect(canonicalMeshName('live-query')).toBe('liveQuery');
  });

  it('returns an unrecognised name unchanged rather than guessing', () => {
    expect(canonicalMeshName('somethingCustom')).toBe('somethingCustom');
  });
});

describe('classifyMeshEntry', () => {
  it('classifies a transform under either spelling', () => {
    expect(classifyMeshEntry('filterSchema')).toBe('transform');
    expect(classifyMeshEntry('filter-schema')).toBe('transform');
  });

  it('classifies a plugin under either spelling', () => {
    expect(classifyMeshEntry('responseCache')).toBe('plugin');
    expect(classifyMeshEntry('response-cache')).toBe('plugin');
  });

  it('reports an unknown name as unknown, not as a misclassification', () => {
    expect(classifyMeshEntry('notAMeshThing')).toBe('unknown');
  });

  it('reports a name that is legitimately both as ambiguous', () => {
    // `mock` and `snapshot` ship as both a plugin and a transform in Mesh.
    // Every previous copy of this table listed them in both sets, which made
    // its own "X is a transform, not a plugin" check unable to fire correctly
    // for them. Naming the ambiguity is the fix; silently listing twice is not.
    for (const name of MESH_AMBIGUOUS) {
      expect(classifyMeshEntry(name)).toBe('ambiguous');
    }
    expect(MESH_AMBIGUOUS).toContain('mock');
    expect(MESH_AMBIGUOUS).toContain('snapshot');
  });
});

describe('the tables themselves', () => {
  it('never lists the same canonical name as both a plugin and a transform', () => {
    // The invariant every previous copy broke. If a name is genuinely both it
    // belongs in MESH_AMBIGUOUS and in neither set.
    const overlap = [...MESH_PLUGINS].filter((n) => (MESH_TRANSFORMS as readonly string[]).includes(n));
    expect(overlap).toEqual([]);
  });

  it('keeps the ambiguous names out of both sets', () => {
    for (const name of MESH_AMBIGUOUS) {
      expect(MESH_PLUGINS as readonly string[]).not.toContain(name);
      expect(MESH_TRANSFORMS as readonly string[]).not.toContain(name);
    }
  });

  it('holds every name the generator emits by default', () => {
    // The generator writes namingConvention, rateLimit, filterSchema and
    // resolversComposition into .meshrc.yaml from DEFAULT_MESH_TRANSFORMS, and
    // responseCache / prometheus / opentelemetry from DEFAULT_MESH_PLUGINS. A
    // table that does not recognise what the platform itself generates would
    // reject its own output.
    for (const t of ['namingConvention', 'rateLimit', 'filterSchema', 'resolversComposition']) {
      expect(classifyMeshEntry(t)).toBe('transform');
    }
    for (const p of ['responseCache', 'prometheus', 'opentelemetry']) {
      expect(classifyMeshEntry(p)).toBe('plugin');
    }
  });
});
