/**
 * Control-plane composition compiler (ADR-083).
 *
 * Two things are under test and they fail differently:
 *
 *   - **Derivation** (ADR-074) — the nine registration fields must come out of
 *     the manifest exactly. A wrong `moduleFederation.scope` here is the
 *     `Module "./App" does not exist in container` runtime error ADR-074 named,
 *     which reports neither the MFE nor the rule, so it has to be pinned here.
 *   - **Placement** — the routes an author wrote, expanded and resolved. The
 *     interesting cases are the ones that used to fail silently at runtime:
 *     a capability nobody declares, a state key outside its namespace, and an
 *     unexpanded placeholder in a slot address.
 */

import type { DSLManifest } from '../schema';
import {
  compileControlPlane,
  deriveRegistration,
  type ControlPlaneFinding,
} from '../control-plane-compiler';
import type { ControlPlaneDocument } from '../control-plane-schema';

// ── fixtures ────────────────────────────────────────────────────────────────

function manifest(overrides: Partial<DSLManifest> = {}): DSLManifest {
  return {
    name: 'meridian-docking-control',
    version: '1.0.0',
    type: 'remote',
    language: 'typescript',
    framework: 'angular',
    bundler: 'webpack',
    endpoint: 'http://localhost:5002',
    remoteEntry: 'http://localhost:5002/remoteEntry.js',
    capabilities: [
      { DockingBoard: { type: 'domain' } },
      { BerthTile: { type: 'domain' } },
      { Load: { type: 'platform' } },
      { Render: { type: 'platform' } },
    ],
    ...overrides,
  } as DSLManifest;
}

const consoleManifest = manifest({
  name: 'meridian-console',
  framework: 'react',
  bundler: 'rspack',
  endpoint: 'http://localhost:5001',
  remoteEntry: 'http://localhost:5001/remoteEntry.js',
  capabilities: [
    { StationConsole: { type: 'domain' } },
    { Load: { type: 'platform' } },
    { Render: { type: 'platform' } },
  ],
  providesSlots: [{ id: 'main' }, { id: 'status' }, { id: 'berth.{id}' }],
} as Partial<DSLManifest>);

function doc(overrides: Partial<ControlPlaneDocument> = {}): ControlPlaneDocument {
  return {
    project: 'meridian-station',
    namespace: 'meridian',
    mfes: ['meridian-console', 'meridian-docking-control'],
    routes: [],
    ...overrides,
  };
}

const fatal = (findings: ControlPlaneFinding[]): ControlPlaneFinding[] =>
  findings.filter((f) => f.fatal);

// ── derivation (ADR-074) ────────────────────────────────────────────────────

describe('deriveRegistration — the nine fields (ADR-074)', () => {
  it('derives every field from the manifest', () => {
    expect(deriveRegistration(manifest())).toEqual({
      name: 'meridian-docking-control',
      version: '1.0.0',
      type: 'remote',
      baseUrl: 'http://localhost:5002',
      capabilities: ['load', 'render'],
      contentType: 'module-federation',
      remoteEntryUrl: 'http://localhost:5002/remoteEntry.js',
      moduleFederation: { scope: 'meridian_docking_control', module: './App' },
    });
  });

  it('lowercases platform capabilities and drops domain ones', () => {
    // The registry's `capabilities` list is the platform contract, not the
    // domain surface — domain capabilities are addressed by route instead.
    expect(deriveRegistration(manifest()).capabilities).toEqual(['load', 'render']);
  });

  it('converts hyphens to underscores for the federation scope', () => {
    expect(deriveRegistration(manifest()).moduleFederation.scope).toBe(
      'meridian_docking_control'
    );
  });

  it('fixes the exposed module at ./App (#272)', () => {
    expect(deriveRegistration(manifest()).moduleFederation.module).toBe('./App');
  });

  it('carries providesSlots through when the manifest declares them', () => {
    expect(deriveRegistration(consoleManifest).providesSlots).toEqual([
      { id: 'main' },
      { id: 'status' },
      { id: 'berth.{id}' },
    ]);
  });

  it('omits providesSlots entirely when the manifest declares none', () => {
    expect(deriveRegistration(manifest())).not.toHaveProperty('providesSlots');
  });
});

// ── placement ───────────────────────────────────────────────────────────────

describe('compileControlPlane — placement', () => {
  it('resolves a capability to its owning MFE through the manifests', () => {
    const { payload, findings } = compileControlPlane({
      document: doc({
        routes: [
          {
            when: 'meridian.open.docking',
            place: [{ capability: 'DockingBoard', into: 'meridian-console/main' }],
          },
        ],
      }),
      manifests: [consoleManifest, manifest()],
    });

    expect(fatal(findings)).toEqual([]);
    const docking = payload.find((d) => d.registration.name === 'meridian-docking-control');
    expect(docking?.routes).toEqual([
      {
        when: { stateKey: 'meridian.open.docking' },
        resolve: { capability: 'DockingBoard', props: { slot: 'meridian-console/main' } },
      },
    ]);
  });

  it('places several capabilities from one state key', () => {
    const { payload } = compileControlPlane({
      document: doc({
        routes: [
          {
            when: 'meridian.open.docking',
            place: [
              { capability: 'DockingBoard', into: 'meridian-console/main' },
              { capability: 'StationConsole', into: 'meridian-console/status' },
            ],
          },
        ],
      }),
      manifests: [consoleManifest, manifest()],
    });

    // One click, two MFEs — the routes land under their own registrations.
    expect(payload.find((d) => d.registration.name === 'meridian-console')?.routes).toHaveLength(1);
    expect(
      payload.find((d) => d.registration.name === 'meridian-docking-control')?.routes
    ).toHaveLength(1);
  });

  it('passes extra props through beside the slot', () => {
    const { payload } = compileControlPlane({
      document: doc({
        routes: [
          {
            when: 'meridian.berth.b1',
            place: [
              {
                capability: 'BerthTile',
                into: 'meridian-console/berth.b1',
                props: { berthId: 'b1' },
              },
            ],
          },
        ],
      }),
      manifests: [consoleManifest, manifest()],
    });

    expect(payload[1].routes[0].resolve.props).toEqual({
      slot: 'meridian-console/berth.b1',
      berthId: 'b1',
    });
  });

  it('omits props entirely when there is no slot and no extras', () => {
    const { payload } = compileControlPlane({
      document: doc({
        routes: [{ when: 'meridian.root', place: [{ capability: 'StationConsole' }] }],
      }),
      manifests: [consoleManifest, manifest()],
    });

    expect(payload[0].routes[0].resolve).not.toHaveProperty('props');
  });

  it('emits a registration for every declared MFE, even one with no routes', () => {
    const { payload } = compileControlPlane({
      document: doc(),
      manifests: [consoleManifest, manifest()],
    });

    // The fleet still has to be registered so the shell can load it.
    expect(payload.map((d) => d.registration.name)).toEqual([
      'meridian-console',
      'meridian-docking-control',
    ]);
    expect(payload.every((d) => d.routes.length === 0)).toBe(true);
  });
});

// ── forEach expansion (ADR-083 §4) ──────────────────────────────────────────

describe('compileControlPlane — forEach expansion', () => {
  it('expands one route per binding', () => {
    const { payload, findings } = compileControlPlane({
      document: doc({
        routes: [
          {
            when: 'meridian.berth.{id}',
            forEach: { id: ['b1', 'b2', 'b3'] },
            place: [
              {
                capability: 'BerthTile',
                into: 'meridian-console/berth.{id}',
                props: { berthId: '{id}' },
              },
            ],
          },
        ],
      }),
      manifests: [consoleManifest, manifest()],
    });

    expect(fatal(findings)).toEqual([]);
    const routes = payload.find((d) => d.registration.name === 'meridian-docking-control')!.routes;
    expect(routes).toHaveLength(3);
    expect(routes.map((r) => r.when.stateKey)).toEqual([
      'meridian.berth.b1',
      'meridian.berth.b2',
      'meridian.berth.b3',
    ]);
    expect(routes[2].resolve.props).toEqual({
      slot: 'meridian-console/berth.b3',
      berthId: 'b3',
    });
  });

  it('expands the cross product of several bindings', () => {
    const { payload } = compileControlPlane({
      document: doc({
        routes: [
          {
            when: 'meridian.{deck}.{id}',
            forEach: { deck: ['upper', 'lower'], id: ['b1', 'b2'] },
            place: [{ capability: 'BerthTile' }],
          },
        ],
      }),
      manifests: [consoleManifest, manifest()],
    });

    expect(
      payload.find((d) => d.registration.name === 'meridian-docking-control')!.routes.map(
        (r) => r.when.stateKey
      )
    ).toEqual([
      'meridian.upper.b1',
      'meridian.upper.b2',
      'meridian.lower.b1',
      'meridian.lower.b2',
    ]);
  });

  it('substitutes into `from` so a loop can select the provider', () => {
    const flappy = manifest({
      name: 'abc-kids-flappy',
      endpoint: 'http://localhost:3001',
      remoteEntry: 'http://localhost:3001/remoteEntry.js',
      capabilities: [{ PlayGame: { type: 'domain' } }, { Load: { type: 'platform' } }],
    } as Partial<DSLManifest>);
    const hockey = manifest({
      name: 'abc-kids-hockey',
      endpoint: 'http://localhost:3002',
      remoteEntry: 'http://localhost:3002/remoteEntry.js',
      capabilities: [{ PlayGame: { type: 'domain' } }, { Load: { type: 'platform' } }],
    } as Partial<DSLManifest>);

    const { payload, findings } = compileControlPlane({
      document: {
        project: 'abc-kids',
        namespace: 'abc',
        mfes: ['flappy', 'hockey'],
        routes: [
          {
            when: 'abc.play.{game}',
            forEach: { game: ['flappy', 'hockey'] },
            place: [{ from: 'abc-kids-{game}', capability: 'PlayGame' }],
          },
        ],
      },
      manifests: [flappy, hockey],
    });

    expect(fatal(findings)).toEqual([]);
    expect(payload.map((d) => d.routes.map((r) => r.when.stateKey))).toEqual([
      ['abc.play.flappy'],
      ['abc.play.hockey'],
    ]);
  });

  it('rejects a placeholder with no binding rather than emitting a literal {id}', () => {
    // An unexpanded {id} in a slot address is the placement ADR-066 parks and
    // waits on — silently, forever. It has to fail here instead.
    const { findings } = compileControlPlane({
      document: doc({
        routes: [
          {
            when: 'meridian.berth.{id}',
            place: [{ capability: 'BerthTile', into: 'meridian-console/berth.{id}' }],
          },
        ],
      }),
      manifests: [consoleManifest, manifest()],
    });

    const finding = fatal(findings).find((f) => f.rule === 'unbound-placeholder');
    expect(finding).toBeDefined();
    expect(finding!.message).toContain('{id}');
  });
});

// ── namespace scoping (ADR-083 §1) ──────────────────────────────────────────

describe('compileControlPlane — namespace scoping', () => {
  it('accepts a state key under the declared namespace', () => {
    const { findings } = compileControlPlane({
      document: doc({
        routes: [{ when: 'meridian.open.docking', place: [{ capability: 'DockingBoard' }] }],
      }),
      manifests: [consoleManifest, manifest()],
    });

    expect(fatal(findings)).toEqual([]);
  });

  it('rejects a state key that escapes the namespace', () => {
    const { findings } = compileControlPlane({
      document: doc({
        routes: [{ when: 'abc.play.flappy', place: [{ capability: 'DockingBoard' }] }],
      }),
      manifests: [consoleManifest, manifest()],
    });

    const finding = fatal(findings).find((f) => f.rule === 'namespace-escape');
    expect(finding).toBeDefined();
    expect(finding!.message).toContain('meridian');
  });

  it('rejects a bare namespace with no sub-key', () => {
    // `meridian` alone would collide with any other project's root key the
    // moment the prefix rule is enforced only as startsWith.
    const { findings } = compileControlPlane({
      document: doc({ routes: [{ when: 'meridianx.root', place: [{ capability: 'DockingBoard' }] }] }),
      manifests: [consoleManifest, manifest()],
    });

    expect(fatal(findings).some((f) => f.rule === 'namespace-escape')).toBe(true);
  });
});

// ── capability resolution ───────────────────────────────────────────────────

describe('compileControlPlane — capability resolution', () => {
  it('rejects a capability no MFE declares', () => {
    const { findings } = compileControlPlane({
      document: doc({
        routes: [{ when: 'meridian.open.x', place: [{ capability: 'NoSuchThing' }] }],
      }),
      manifests: [consoleManifest, manifest()],
    });

    const finding = fatal(findings).find((f) => f.rule === 'unknown-capability');
    expect(finding).toBeDefined();
    expect(finding!.message).toContain('NoSuchThing');
  });

  it('rejects an ambiguous capability and names the candidates', () => {
    const a = manifest({ name: 'game-a', capabilities: [{ PlayGame: { type: 'domain' } }] } as Partial<DSLManifest>);
    const b = manifest({ name: 'game-b', capabilities: [{ PlayGame: { type: 'domain' } }] } as Partial<DSLManifest>);

    const { findings } = compileControlPlane({
      document: doc({
        mfes: ['a', 'b'],
        routes: [{ when: 'meridian.play', place: [{ capability: 'PlayGame' }] }],
      }),
      manifests: [a, b],
    });

    const finding = fatal(findings).find((f) => f.rule === 'ambiguous-capability');
    expect(finding).toBeDefined();
    expect(finding!.message).toContain('game-a');
    expect(finding!.message).toContain('game-b');
    expect(finding!.message).toContain('from');
  });

  it('accepts an ambiguous capability qualified with from', () => {
    const a = manifest({ name: 'game-a', capabilities: [{ PlayGame: { type: 'domain' } }] } as Partial<DSLManifest>);
    const b = manifest({ name: 'game-b', capabilities: [{ PlayGame: { type: 'domain' } }] } as Partial<DSLManifest>);

    const { payload, findings } = compileControlPlane({
      document: doc({
        mfes: ['a', 'b'],
        routes: [{ when: 'meridian.play', place: [{ from: 'game-b', capability: 'PlayGame' }] }],
      }),
      manifests: [a, b],
    });

    expect(fatal(findings)).toEqual([]);
    expect(payload.find((d) => d.registration.name === 'game-b')!.routes).toHaveLength(1);
    expect(payload.find((d) => d.registration.name === 'game-a')!.routes).toHaveLength(0);
  });

  it('rejects a from that names an MFE not in the fleet', () => {
    const { findings } = compileControlPlane({
      document: doc({
        routes: [
          { when: 'meridian.open.x', place: [{ from: 'ghost-mfe', capability: 'DockingBoard' }] },
        ],
      }),
      manifests: [consoleManifest, manifest()],
    });

    const finding = fatal(findings).find((f) => f.rule === 'unknown-mfe');
    expect(finding).toBeDefined();
    expect(finding!.message).toContain('ghost-mfe');
  });

  it('rejects a from whose MFE does not declare the capability', () => {
    const { findings } = compileControlPlane({
      document: doc({
        routes: [
          {
            when: 'meridian.open.x',
            place: [{ from: 'meridian-console', capability: 'DockingBoard' }],
          },
        ],
      }),
      manifests: [consoleManifest, manifest()],
    });

    expect(fatal(findings).some((f) => f.rule === 'unknown-capability')).toBe(true);
  });
});

// ── slot addresses (reuses ADR-073's check) ─────────────────────────────────

describe('compileControlPlane — slot addresses', () => {
  it('rejects an address no MFE provides', () => {
    const { findings } = compileControlPlane({
      document: doc({
        routes: [
          {
            when: 'meridian.open.docking',
            place: [{ capability: 'DockingBoard', into: 'meridian-console/nope' }],
          },
        ],
      }),
      manifests: [consoleManifest, manifest()],
    });

    expect(fatal(findings).some((f) => f.rule === 'undeclared-slot')).toBe(true);
  });

  it('accepts a keyed address that matches a declared pattern', () => {
    const { findings } = compileControlPlane({
      document: doc({
        routes: [
          {
            when: 'meridian.berth.b4',
            place: [{ capability: 'BerthTile', into: 'meridian-console/berth.b4' }],
          },
        ],
      }),
      manifests: [consoleManifest, manifest()],
    });

    expect(fatal(findings)).toEqual([]);
  });

  it('accepts the host-owned root address that no MFE declares', () => {
    const { findings } = compileControlPlane({
      document: doc({
        routes: [{ when: 'meridian.root', place: [{ capability: 'StationConsole', into: 'root' }] }],
      }),
      manifests: [consoleManifest, manifest()],
    });

    expect(fatal(findings)).toEqual([]);
  });
});
