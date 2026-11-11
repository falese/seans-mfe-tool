/**
 * decompose:port — every domain's source into its MFE, and the proposal
 * composed directly (ADR-126, PDR-013).
 *
 * Deterministic and confined to developer-owned files (ADR-084, ADR-087):
 *
 *   <mfe>/src/monolith/<path>              the domain's closure, copied unchanged
 *   <mfe>/src/monolith/__port__/slots.tsx  (shell) the slot a route block became
 *   <mfe>/src/features/<Cap>/<Cap>.tsx     the component inside the monolith's providers
 *   <mfe>/package.json                     the packages the copied code imports
 *   shell/src/routes.ts                    path → state key
 *   control-plane/control-plane.yaml       the proposal's composition; rules.json from it
 *
 * What it does not do is judge: a store every MFE now loads in full, a domain
 * reading another's data. Those are reported, and the parity gate measures them.
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import { BusinessError, ValidationError } from '@seans-mfe/contracts';
import { compileControlPlane, DSLManifestSchema, parseAndValidateDirectory, type DSLManifest } from '@seans-mfe/dsl';
import { approvalStatus, bffReads, type BffRead, deriveFleet, dumpYaml, EMPTY_SLOT, readDecomposition, readSpecs, type Decomposition, type Domain } from '@seans-mfe/decompose';
import { loadTypeScript } from '../source/load';
import { validateDecomposition } from '../../sentinel/decomposition';
import { routesModule } from '../scaffold/shell';
import { viaBffModule } from './shim';
import { buildSourceGraph, type FileNode } from '../source/graph';
import { readProject } from '../source/load';
import {
  closure,
  declaringFile,
  packageOf,
  exportsByName,
  importsOf,
  providerTree,
  pruneUnusedImports,
  inlineReads,
  type FunctionRead,
  resolveRelative,
  routesBlocks,
  type ProviderTree,
  type Read,
  type Ts,
} from './source';

export interface PortOptions {
  proposalDir: string;
  /** The scaffolded fleet; default: what `proposal/scaffold.json` recorded. */
  fleetDir?: string;
  /** The monolith's source; default: what decompose:analyze recorded. */
  appDir?: string;
  /** Replace feature files and copies a developer has already changed. */
  force?: boolean;
}

export interface PortedMfe {
  name: string;
  domain: string;
  /** Monolith files copied under `src/monolith/`. */
  files: string[];
  /** Capabilities whose feature file now renders the ported component. */
  capabilities: string[];
  /** Capabilities whose feature file a developer had changed, so it was kept. */
  kept: string[];
  /** Packages added to package.json. */
  packages: string[];
  /**
   * ADR-127, ADR-128: the endpoints its BFF fronts; the data functions (`file#name`) that read
   * through it when composed; and those left on the monolith's code in both modes, with why.
   */
  bff: { operations: string[]; inlined: string[]; monolith: string[] };
}

export interface PortResult {
  fleetDir: string;
  mfes: PortedMfe[];
  /** Shell route blocks that became slots, as `<file>: <slot>`. */
  slots: string[];
  /** Files copied into more than one MFE: shared code the agent splits, duplicates or replaces. */
  duplicated: Array<{ file: string; mfes: string[] }>;
  controlPlane: string;
  rules: string;
  routes: string;
  warnings: string[];
}

const PORT_MARK = 'Ported by decompose:port';
const stripExt = (f: string): string => f.replace(/\.(tsx?|jsx?)$/, '');
const rel = (fromFile: string, toFile: string): string => {
  const r = path.posix.relative(path.posix.dirname(fromFile), toFile);
  return r.startsWith('.') ? r : `./${r}`;
};

async function readJsonIf<T>(file: string): Promise<T | undefined> {
  return (await fs.pathExists(file)) ? ((await fs.readJson(file)) as T) : undefined;
}

function reader(appDir: string, overrides: Map<string, string>): Read {
  const cache = new Map<string, string | undefined>();
  return (file) => {
    if (overrides.has(file)) return overrides.get(file);
    if (!cache.has(file)) {
      const full = path.join(appDir, file);
      cache.set(file, fs.existsSync(full) && fs.statSync(full).isFile() ? fs.readFileSync(full, 'utf8') : undefined);
    }
    return cache.get(file);
  };
}

/** The entry file and the provider tree it renders around the shell's root component. */
function findEntry(ts: Ts, doc: Decomposition, read: Read): { entry: string; tree: ProviderTree } {
  const shell = doc.domains.find((d) => d.shell);
  const root = shell?.capabilities[0];
  if (!shell || !root) throw new ValidationError('the proposal has no shell domain with a capability: nothing to compose the others into', 'decomposition', 'shell');
  for (const file of doc.domains.flatMap((d) => d.files)) {
    const text = read(file);
    if (!text || !/\.render\(/.test(text)) continue;
    const tree = providerTree(ts, file, text, root.component);
    if (tree) return { entry: file, tree };
  }
  throw new ValidationError(`no file renders <${root.component} /> through a .render(...) call: cannot read the monolith's providers`, 'monolith', 'entry');
}

/**
 * ADR-126 §3: a `<Routes>` block whose routes render other domains' capabilities
 * becomes the slot those capabilities are placed in.
 */
function rewriteShell(ts: Ts, doc: Decomposition, shell: Domain, file: string, read: Read): { text: string; slots: string[]; kept: string[] } {
  const text = read(file) as string;
  const owner = new Map(doc.domains.flatMap((d) => d.files.map((f) => [f, d] as const)));
  const imports = importsOf(ts, file, text);
  const blocks = routesBlocks(ts, file, text);
  const slots: string[] = [];
  const kept: string[] = [];
  let out = text;
  for (const block of [...blocks].reverse()) {
    const votes = new Map<string, number>();
    let own = false;
    for (const r of block.routes) {
      if (!r.element) continue;
      const imp = imports.find((i) => i.names.includes(r.element as string));
      const target = imp && resolveRelative(file, imp.spec, read);
      const exported = imp?.defaultName === r.element ? 'default' : imp?.named.find((n) => n.local === r.element)?.imported;
      const declared = target && exported ? declaringFile(ts, target, exported, read) : undefined;
      const domain = declared ? owner.get(declared) : undefined;
      if (!domain || domain.id === shell.id) {
        own = true;
        continue;
      }
      const placements = doc.routes.filter((x) => x.path === r.path).flatMap((x) => x.place).filter((p) => p.domain === domain.id);
      const caps = new Map(domain.capabilities.map((c) => [c.name, c]));
      const exact = placements.filter((p) => caps.get(p.capability)?.file === declared || caps.get(p.capability)?.component === r.element);
      for (const p of exact.length > 0 ? exact : placements) votes.set(p.slot, (votes.get(p.slot) ?? 0) + 1);
    }
    const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1]);
    if (own || ranked.length === 0 || (ranked.length > 1 && ranked[0][1] === ranked[1][1])) {
      kept.push(`${file}: a <Routes> block ${own ? 'renders the shell\'s own components' : 'has no single slot'} — kept as written`);
      continue;
    }
    const slot = ranked[0][0];
    slots.push(`${file}: ${slot}`);
    out = `${out.slice(0, block.start)}<PortedSlot id="${slot}" />${out.slice(block.end)}`;
  }
  if (slots.length > 0) {
    const imp = `import { PortedSlot } from '${rel(file, 'src/monolith/__port__/slots'.replace(/^src\/monolith\//, ''))}';\n`;
    const decls = importsOf(ts, file, out);
    const at = decls.length > 0 ? decls[decls.length - 1].end + 1 : 0;
    out = pruneUnusedImports(ts, file, `${out.slice(0, at)}${imp}${out.slice(at)}`);
  }
  return { text: out, slots, kept };
}

const SLOTS_MODULE = `/**
 * ${PORT_MARK} (ADR-126 §3): where a route block of the monolith's layout
 * became a declared slot. The shell capability's feature file provides the
 * registrar it gets from the LayoutManager (provideSlot, ADR-058).
 */
import React, { createContext, useContext } from 'react';
import { DeclaredSlot, type DeclaredSlotId } from '../../slots';

export type ProvideSlot = (slotId: string, element: HTMLElement | null) => void;
export const SlotRegistrar = createContext<ProvideSlot | undefined>(undefined);

export function PortedSlot({ id }: { id: DeclaredSlotId }): React.ReactElement {
  return <DeclaredSlot id={id} provideSlot={useContext(SlotRegistrar)} />;
}
`;

function featureSource(o: {
  cap: string;
  component: string;
  componentFile: string;
  named: boolean;
  tree: ProviderTree;
  entry: string;
  read: Read;
  slots: boolean;
}): string {
  const featureFile = `src/features/${o.cap}/${o.cap}.tsx`;
  const toCopy = (f: string) => rel(featureFile, `src/monolith/${stripExt(f)}`);
  const providerImports = o.tree.imports.map((i) => {
    const target = resolveRelative(o.entry, i.spec, o.read);
    return target ? i.text.replace(/(['"])[^'"]+\1/, `'${toCopy(target)}'`) : i.text;
  });
  const ported = o.named ? `import { ${o.component} as Ported } from '${toCopy(o.componentFile)}';` : `import Ported from '${toCopy(o.componentFile)}';`;
  const body = o.tree.jsx.replace('__CHILD__', '<Rendered {...props} />');
  const inner = o.slots ? `<SlotRegistrar.Provider value={provideSlot}>\n      ${body}\n    </SlotRegistrar.Provider>` : body;
  return `/**
 * ${o.cap} — ${PORT_MARK} from ${o.componentFile} (ADR-126 §2).
 *
 * Renders the monolith's own component inside the providers its entry
 * (${o.entry}) renders around the app, so it has the context it was written
 * against. The component's code is under src/monolith/, unchanged. Developer-owned:
 * slim the providers down to what this capability reads.
 */
import React from 'react';
${[...providerImports, ported, ...(o.slots ? [`import { SlotRegistrar, type ProvideSlot } from '../../monolith/__port__/slots';`] : [])].join('\n')}

// The host's props are untyped; the monolith's component is rendered with what it is given.
const Rendered = Ported as unknown as React.ComponentType<Record<string, unknown>>;

export interface ${o.cap}Props {
  provideSlot?: ${o.slots ? 'ProvideSlot' : '(slotId: string, element: HTMLElement | null) => void'};
  [key: string]: unknown;
}

export const ${o.cap}: React.FC<${o.cap}Props> = ({ provideSlot, ...props }) => {
${o.slots ? '' : '  void provideSlot;\n'}  return (
    ${inner}
  );
};

export default ${o.cap};
`;
}

const EMPTY_SLOT_SOURCE = `/**
 * ${EMPTY_SLOT} — ${PORT_MARK} (ADR-126 §4a). What a state shows in a slot it
 * does not fill: nothing, as the monolith's \`<Route path="*" element={null} />\`.
 */
import React from 'react';

export interface ${EMPTY_SLOT}Props {
  [key: string]: unknown;
}

export const ${EMPTY_SLOT}: React.FC<${EMPTY_SLOT}Props> = () => null;

export default ${EMPTY_SLOT};
`;

const featureTest = (cap: string): string => `/**
 * ${cap} — ${PORT_MARK}. The monolith's behaviour is checked by decompose:verify
 * against its capture (ADR-113); this only proves the capability resolves.
 */
import { ${cap} } from './${cap}';

describe('${cap}', () => {
  it('is the ported component', () => {
    expect(typeof ${cap}).toBe('function');
  });
});
`;

/** A feature file still holding scaffold's stub, or a previous port: safe to (re)write. */
const replaceable = (text: string | undefined, cap: string): boolean =>
  text === undefined || text.includes(`TODO: Implement ${cap}`) || text.includes(PORT_MARK) || text.includes('TODO: Add more tests based on capability');

const fits = (template: string, url: string): boolean => {
  const t = template.split('/').filter(Boolean);
  const u = url.split('/').filter(Boolean);
  return t.length === u.length && t.every((s, i) => s === u[i] || s.startsWith('{') || u[i].startsWith('{'));
};

/**
 * How one exported data function reads once ported (ADR-128 §2–4): through the
 * BFF when its MFE fronts its endpoint, empty when it does not, or on the
 * monolith's code when it is a write, reads several endpoints, or has no spec.
 */
export function planRead(
  fn: NonNullable<FileNode['functions']>[number],
  fronted: BffRead[],
  every: BffRead[]
): FunctionRead {
  if (fn.endpoints.length !== 1) return { name: fn.name, monolith: `reads ${fn.endpoints.length} endpoints` };
  const ep = fn.endpoints[0];
  if (ep.method !== 'GET') return { name: fn.name, monolith: `${ep.method} is a write; writes are not through the BFF yet` };
  const mine = fronted.find((r) => r.method === ep.method && fits(r.path, ep.url));
  if (!mine) {
    const any = every.find((r) => r.method === ep.method && fits(r.path, ep.url));
    return any ? { name: fn.name, empty: any.empty } : { name: fn.name, monolith: `${ep.method} ${ep.url} is in no backend's spec` };
  }
  // Path parameters the function passes by name become variables; any other parameter keeps the monolith's call.
  const urlSegs = ep.url.split('/').filter(Boolean);
  const tplSegs = mine.path.split('/').filter(Boolean);
  const variables: Record<string, string> = {};
  for (const v of mine.variables.filter((x) => x.in === 'path')) {
    const at = tplSegs.indexOf(`{${v.name}}`);
    const name = /^\{([A-Za-z_$][\w$]*)\}$/.exec(urlSegs[at] ?? '')?.[1];
    if (name && fn.params.includes(name)) variables[v.name] = name;
  }
  const unless = fn.params.filter((p) => !Object.values(variables).includes(p));
  return { name: fn.name, read: { document: mine.document, field: mine.field }, variables, unless };
}

export async function portFleet(opts: PortOptions): Promise<PortResult> {
  const ts = await loadTypeScript();
  const proposalDir = path.resolve(opts.proposalDir);
  const doc = await readDecomposition(path.join(proposalDir, 'decomposition.yaml'));
  if (approvalStatus(doc) !== 'current') {
    throw new BusinessError(`${doc.app.name}'s proposal is not approved as it stands — approve it, scaffold, then port`, 'PROPOSAL_NOT_APPROVED', {});
  }
  const verdict = await validateDecomposition(doc);
  if (!verdict.valid) throw new ValidationError(verdict.errors.map((e) => `${e.path}: ${e.message}`).join('; '), 'decomposition', 'playbook');

  const scaffolded = await readJsonIf<{ fleetDir: string }>(path.join(proposalDir, 'scaffold.json'));
  const fleetDir = path.resolve(opts.fleetDir ?? scaffolded?.fleetDir ?? path.join(proposalDir, '..', '..', 'fleet'));
  if (!(await fs.pathExists(path.join(fleetDir, 'control-plane')))) {
    throw new BusinessError(`${fleetDir} is not a scaffolded fleet — run decompose:scaffold first`, 'NOT_SCAFFOLDED', { fleetDir });
  }
  const project = await readJsonIf<{ dir: string }>(path.join(proposalDir, '..', 'source', 'project.json'));
  const appDir = path.resolve(opts.appDir ?? project?.dir ?? '');
  if (!opts.appDir && !project) throw new ValidationError('pass --app-dir: no decompose:analyze record names the monolith\'s source', 'app-dir', 'required');
  const monolithPkg = (await readJsonIf<Record<string, Record<string, string> | undefined>>(path.join(appDir, 'package.json'))) ?? {};
  const versionOf = (pkg: string): string | undefined => monolithPkg.dependencies?.[pkg] ?? monolithPkg.devDependencies?.[pkg];

  const warnings: string[] = [];
  const plain = reader(appDir, new Map());
  const { entry, tree } = findEntry(ts, doc, plain);

  // The shell's layout, with its route blocks turned into slots.
  const shell = doc.domains.find((d) => d.shell) as Domain;
  const shellRoot = shell.capabilities[0];
  const rewritten = rewriteShell(ts, doc, shell, shellRoot.file, plain);
  warnings.push(...rewritten.kept);
  for (const r of doc.repeated) {
    warnings.push(`${r.capability} (one per item, rendered by ${r.renderedBy}) stays rendered by its parent: repeated placements are bound when composed, and the source does not know the keys`);
  }

  const providerFiles = tree.imports.map((i) => resolveRelative(entry, i.spec, plain)).filter((f): f is string => Boolean(f));
  const mfes: PortedMfe[] = [];
  const copiedBy = new Map<string, string[]>();
  // ADR-127: each MFE reads only through its own BFF, generated from these specs.
  const allSpecs = await readSpecs(proposalDir);
  const fleet = deriveFleet(doc, allSpecs);
  const layout = { gateway: doc.app.gateway !== false };
  // Which endpoint each exported data function reads, through its wrappers (ADR-128 §2).
  const graph = buildSourceGraph((await readProject(ts, appDir)).facts);
  const everyRead = Object.entries(allSpecs?.specs ?? {}).flatMap(([b, spec]) => bffReads(spec, b, layout));
  for (const domain of doc.domains) {
    const dir = path.join(fleetDir, domain.mfe);
    if (!(await fs.pathExists(dir))) throw new BusinessError(`${dir} is missing — scaffold the fleet again`, 'NOT_SCAFFOLDED', { dir });
    const read = domain.shell ? reader(appDir, new Map([[shellRoot.file, rewritten.text]])) : plain;
    const { files, packages } = closure(ts, [...domain.capabilities.map((c) => c.file), ...providerFiles], read);

    // ADR-128: each data function reads through this MFE's BFF when composed — what the BFF
    // fronts (ADR-127 §1) — and is empty when composed for data it does not.
    const fronted = Object.entries(fleet.bff[domain.mfe]?.specs ?? {}).flatMap(([b, spec]) => bffReads(spec, b, layout));
    const inlined: string[] = [];
    const onMonolith: string[] = [];
    for (const f of files) {
      const target = path.join(dir, 'src', 'monolith', f);
      const node = graph.files.find((n) => n.file === f);
      let text = read(f) as string;
      // Only where the HTTP calls are made: a function that reads by calling those (a store's
      // loader) reads through them, already rewritten.
      if (node?.apiClient && node.functions) {
        const r = inlineReads(ts, f, text, node.functions.map((fn) => planRead(fn, fronted, everyRead)), rel(f, '__port__/via-bff'));
        text = r.text;
        inlined.push(...r.inlined.map((n) => `${f}#${n}`));
        onMonolith.push(...r.monolith.map((m) => `${f}#${m}`));
      }
      if ((await fs.pathExists(target)) && !opts.force && (await fs.readFile(target, 'utf8')) !== text) {
        warnings.push(`${domain.mfe}: src/monolith/${f} was changed since the last port — kept (--force replaces it)`);
      } else {
        await fs.ensureDir(path.dirname(target));
        await fs.writeFile(target, text);
      }
      copiedBy.set(f, [...(copiedBy.get(f) ?? []), domain.mfe]);
    }
    for (const m of onMonolith) warnings.push(`${domain.mfe}: ${m} — runs the monolith's code in both modes`);
    await fs.ensureDir(path.join(dir, 'src', 'monolith', '__port__'));
    if (inlined.length > 0) await fs.writeFile(path.join(dir, 'src', 'monolith', '__port__', 'via-bff.ts'), viaBffModule());
    if (domain.shell && rewritten.slots.length > 0) {
      await fs.writeFile(path.join(dir, 'src', 'monolith', '__port__', 'slots.tsx'), SLOTS_MODULE);
    }

    const ported: string[] = [];
    const kept: string[] = [];
    for (const cap of domain.capabilities) {
      const featureFile = path.join(dir, 'src', 'features', cap.name, `${cap.name}.tsx`);
      const testFile = path.join(dir, 'src', 'features', cap.name, `${cap.name}.test.tsx`);
      const current = (await fs.pathExists(featureFile)) ? await fs.readFile(featureFile, 'utf8') : undefined;
      if (!opts.force && !replaceable(current, cap.name)) {
        kept.push(cap.name);
        warnings.push(`${domain.mfe}: ${cap.name}'s feature file was changed by hand — kept (--force replaces it)`);
        continue;
      }
      const named = exportsByName(ts, cap.file, read(cap.file) ?? '', cap.component);
      await fs.ensureDir(path.dirname(featureFile));
      await fs.writeFile(
        featureFile,
        featureSource({ cap: cap.name, component: cap.component, componentFile: cap.file, named, tree, entry, read, slots: domain.shell && rewritten.slots.length > 0 && cap === shellRoot })
      );
      const test = (await fs.pathExists(testFile)) ? await fs.readFile(testFile, 'utf8') : undefined;
      if (opts.force || replaceable(test, cap.name)) await fs.writeFile(testFile, featureTest(cap.name));
      ported.push(cap.name);
    }

    // ADR-126 §4a: the shell's capability for a slot a state leaves empty.
    const emptyFile = path.join(dir, 'src', 'features', EMPTY_SLOT, `${EMPTY_SLOT}.tsx`);
    if (domain.shell && (await fs.pathExists(emptyFile))) {
      const current = await fs.readFile(emptyFile, 'utf8');
      if (opts.force || replaceable(current, EMPTY_SLOT)) {
        await fs.writeFile(emptyFile, EMPTY_SLOT_SOURCE);
        await fs.writeFile(path.join(dir, 'src', 'features', EMPTY_SLOT, `${EMPTY_SLOT}.test.tsx`), featureTest(EMPTY_SLOT));
        ported.push(EMPTY_SLOT);
      }
    }

    // ADR-126 §6: the packages the copied code imports, at the monolith's versions.
    const pkgFile = path.join(dir, 'package.json');
    const pkg = (await fs.readJson(pkgFile)) as Record<string, Record<string, string> | undefined>;
    const deps = (pkg.dependencies ??= {});
    const added: string[] = [];
    // The feature files import the entry's providers too (ADR-126 §2).
    const providerPackages = tree.imports.map((i) => packageOf(i.spec)).filter((p): p is string => Boolean(p));
    for (const p of [...new Set([...packages, ...providerPackages])].sort()) {
      if (deps[p] || pkg.devDependencies?.[p]) continue;
      const v = versionOf(p);
      if (!v) {
        warnings.push(`${domain.mfe}: imports ${p}, which the monolith's package.json does not declare`);
        continue;
      }
      deps[p] = v;
      added.push(p);
    }
    if (added.length > 0) await fs.writeFile(pkgFile, `${JSON.stringify(pkg, null, 2)}\n`);
    mfes.push({
      name: domain.mfe,
      domain: domain.id,
      files,
      capabilities: ported,
      kept,
      packages: added,
      bff: { operations: fronted.map((o) => `${o.method} ${o.path}`).sort(), inlined, monolith: onMonolith },
    });
  }

  // ADR-126 §4: the proposal's own composition, compiled.
  const manifests: DSLManifest[] = [];
  for (const d of doc.domains) {
    const r = await parseAndValidateDirectory(path.join(fleetDir, d.mfe));
    if (!r.valid || !r.manifest) throw new ValidationError(`${d.mfe}'s manifest does not validate`, 'mfe-manifest.yaml', 'schema');
    manifests.push(DSLManifestSchema.parse(r.manifest) as DSLManifest);
  }
  const { payload, findings } = compileControlPlane({ document: fleet.composition, manifests });
  const fatal = findings.filter((f) => f.fatal);
  if (fatal.length > 0) throw new ValidationError(`the proposal's composition does not compile: ${fatal.map((f) => f.message).join('; ')}`, 'control-plane', 'compile');
  const controlPlane = path.join(fleetDir, 'control-plane', 'control-plane.yaml');
  const rules = path.join(fleetDir, 'control-plane', 'rules.json');
  await fs.writeFile(
    controlPlane,
    `# The approved proposal's composition, placed directly (ADR-126 §4, PDR-013). Edit this, then compose:build.\n${dumpYaml(fleet.composition)}`
  );
  await fs.writeFile(rules, `${JSON.stringify(payload, null, 2)}\n`);

  // ADR-126 §5: the shell enters the state key for the URL.
  const routes = path.join(fleetDir, 'shell', 'src', 'routes.ts');
  await fs.ensureDir(path.dirname(routes));
  await fs.writeFile(routes, routesModule(doc.routes.map((r) => ({ path: r.path, stateKey: r.stateKey }))));

  const duplicated = [...copiedBy.entries()].filter(([, by]) => by.length > 1).map(([file, by]) => ({ file, mfes: by }));
  for (const c of doc.couplings) warnings.push(`coupling kept: ${c.file} (${c.domain}) reads ${c.owner}'s ${c.field} — ${c.note}`);
  return { fleetDir, mfes, slots: rewritten.slots.reverse(), duplicated, controlPlane, rules, routes, warnings };
}
