/**
 * Manifests and composition derived from a `decomposition.yaml` (ADR-110 §2).
 *
 * Derivation is pure and re-runnable: `decompose:propose --from` calls it after
 * a human or the agent edits the proposal. Every manifest goes through the
 * same full DSL validation a hand-written one does, and the composition
 * through the same compiler `compose:build` uses (ADR-083), so a proposal that
 * cannot ship says so before anything is scaffolded.
 */

import {
  compileControlPlane,
  ControlPlaneDocumentSchema,
  DSLManifestSchema,
  validateFull,
  type ControlPlaneDocument,
  type ControlPlaneFinding,
  type DSLManifest,
} from '@seans-mfe/dsl';
import type { Decomposition, Domain } from './model';
import { hoistsOf, restrictSpec, type OpenApiDocument } from './openapi';

/** Per backend: its OpenAPI document (inferred or published) and the recorded responses by operationId (ADR-112). */
export interface BackendSpecs {
  specs: Record<string, OpenApiDocument>;
  mocks?: Record<string, Record<string, unknown>>;
}

/** What one MFE's BFF is generated from: the specs it fronts, cut to what it calls, and its demo fixtures. */
export interface BffInputs {
  specs: Record<string, OpenApiDocument>;
  mocks: Record<string, unknown>;
}

export interface DerivedFleet {
  /** MFE name → manifest, in domain order. */
  manifests: Record<string, Record<string, unknown>>;
  composition: ControlPlaneDocument;
  /** MFE name → its BFF's specs and fixtures; only MFEs with a backend that has a spec. */
  bff: Record<string, BffInputs>;
  validation: {
    /** MFE name → `path: message` for each manifest error. */
    manifests: Record<string, string[]>;
    /** Fatal composition findings. */
    composition: Array<Pick<ControlPlaneFinding, 'rule' | 'message'>>;
  };
}

const BASE_PORT = 5201;

const platformCapabilities = [
  {
    Load: {
      type: 'platform',
      lifecycle: {
        error: [{ onLoadError: { handler: 'onLoadError', contained: true, description: 'Log load failure' } }],
      },
    },
  },
  {
    Render: {
      type: 'platform',
      lifecycle: {
        error: [{ onRenderError: { handler: 'onRenderError', contained: true, description: 'Log render failure' } }],
      },
    },
  },
];

function bffFor(domain: Domain, backends?: BackendSpecs): BffInputs | undefined {
  if (!backends) return undefined;
  const specs: Record<string, OpenApiDocument> = {};
  const mocks: Record<string, unknown> = {};
  for (const b of domain.backends) {
    const full = backends.specs[b];
    if (!full) continue;
    const doc = restrictSpec(full, domain.endpoints, b);
    specs[b] = doc;
    const recorded = backends.mocks?.[b] ?? {};
    const ids = new Set(Object.values(doc.paths).flatMap((item) => Object.values(item).map((op) => op?.operationId)));
    for (const id of Object.keys(recorded)) if (ids.has(id)) mocks[id] = recorded[id];
    // The mock switch wraps every Query field, the hoisted ones included (ADR-052).
    for (const h of hoistsOf(doc)) {
      const body = recorded[h.pathConfig[0]];
      if (body && typeof body === 'object' && !Array.isArray(body)) mocks[h.newFieldName] = (body as Record<string, unknown>)[h.pathConfig[1]];
    }
  }
  return Object.keys(specs).length > 0 ? { specs, mocks } : undefined;
}

function manifestFor(doc: Decomposition, domain: Domain, index: number, bff?: BffInputs): Record<string, unknown> {
  const port = BASE_PORT + index;
  const manifest: Record<string, unknown> = {
    name: domain.mfe,
    version: '0.1.0',
    type: 'remote',
    language: 'typescript',
    framework: 'react',
    bundler: 'rspack',
    description: `${domain.id} — derived from ${doc.app.name} by decompose:propose (${domain.files.length} source files)`,
    owner: doc.app.name,
    hosts: [{ id: doc.app.namespace }],
    endpoint: `http://localhost:${port}`,
    remoteEntry: `http://localhost:${port}/remoteEntry.js`,
    discovery: `http://localhost:${port}/.well-known/mfe-manifest.yaml`,
    capabilities: [
      ...domain.capabilities.map((c) => ({
        [c.name]: { type: 'domain', description: `${c.component} from ${c.file}` },
      })),
      ...platformCapabilities,
    ],
  };
  if (domain.backends.length > 0) {
    // One BFF source per backend the domain's screens call, each from the
    // backend's OpenAPI document — published, or inferred from what the app
    // was seen to call (ADR-112). Enveloped lists are unwrapped at the graph.
    manifest.data = {
      sources: domain.backends.map((b) => {
        const hoists = bff?.specs[b] ? hoistsOf(bff.specs[b]) : [];
        return {
          name: b,
          handler: { openapi: { source: `./specs/${b}.yaml` } },
          ...(hoists.length > 0 ? { transforms: [{ hoistField: hoists }] } : {}),
        };
      }),
      // The recorded responses become the demo fixtures (ADR-052, ADR-109 §4).
      ...(bff ? { mockSwitch: { enabled: true } } : {}),
    };
  }
  if (domain.shell) {
    const provided = doc.slots.filter((s) => s.provider === domain.id);
    if (provided.length > 0) manifest.providesSlots = provided.map((s) => ({ id: s.id }));
  }
  return manifest;
}

export function deriveFleet(doc: Decomposition, backends?: BackendSpecs): DerivedFleet {
  const manifests: Record<string, Record<string, unknown>> = {};
  const bff: Record<string, BffInputs> = {};
  const errors: Record<string, string[]> = {};
  const parsed: DSLManifest[] = [];
  doc.domains.forEach((domain, i) => {
    const inputs = bffFor(domain, backends);
    if (inputs) bff[domain.mfe] = inputs;
    const manifest = manifestFor(doc, domain, i, inputs);
    manifests[domain.mfe] = manifest;
    const result = validateFull(manifest);
    errors[domain.mfe] = result.valid ? [] : result.errors.map((e) => `${e.path}: ${e.message}`);
    const typed = DSLManifestSchema.safeParse(manifest);
    if (typed.success) parsed.push(typed.data as DSLManifest);
  });

  const shell = doc.domains.find((d) => d.shell);
  const routes: ControlPlaneDocument['routes'] = [];
  if (shell && shell.capabilities.length > 0) {
    const root = doc.routes.find((r) => r.stateKey === `${doc.app.namespace}.root`);
    routes.push({
      when: `${doc.app.namespace}.root`,
      place: [
        { capability: shell.capabilities[0].name, into: 'root' },
        ...(root?.place ?? []).map((p) => ({ capability: p.capability, into: `${shell.mfe}/${p.slot}` })),
      ],
    });
  }
  for (const r of doc.routes) {
    if (r.stateKey === `${doc.app.namespace}.root`) continue;
    routes.push({
      when: r.stateKey,
      place: r.place.map((p) => ({
        capability: p.capability,
        into: shell ? `${shell.mfe}/${p.slot}` : p.slot,
      })),
    });
  }
  // Repeated placements (one tile per berth) need their keys bound with `forEach`,
  // which the source does not know; they stay in decomposition.yaml until composed.

  const composition = ControlPlaneDocumentSchema.parse({
    project: doc.app.name,
    namespace: doc.app.namespace,
    mfes: doc.domains.map((d) => d.mfe),
    routes,
  });
  const { findings } = compileControlPlane({ document: composition, manifests: parsed });
  return {
    manifests,
    composition,
    bff,
    validation: {
      manifests: errors,
      composition: findings.filter((f) => f.fatal).map((f) => ({ rule: f.rule, message: f.message })),
    },
  };
}
