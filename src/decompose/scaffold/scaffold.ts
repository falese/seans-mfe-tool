/**
 * decompose:scaffold — an approved proposal becomes a fleet (#417, ADR-111).
 *
 *   <out>/<mfe>/                      one generated MFE per domain: manifest, its BFF's specs and
 *                                     recorded fixtures, and everything remote:generate emits
 *   <out>/legacy-<app>/               the monolith, whole, as one generated MFE (ADR-111 §1)
 *   <out>/legacy-<app>/MONOLITH-FEDERATION.md  what the monolith's own build needs
 *   <out>/shell/                      a generic LayoutManager host with nothing of its own on screen
 *   <out>/control-plane/control-plane.yaml   the legacy capability everywhere (ADR-111 §3)
 *   <out>/control-plane/rules.json           compiled from it (ADR-083)
 *   <out>/control-plane/target.yaml          the proposal's own composition: where strangling ends
 *
 * Every MFE goes through the same generator `remote:generate` uses, so the
 * fleet is held to every gate a hand-made one is. A model writes none of it
 * (ADR-084): scaffold is deterministic, and what it seeds into developer-owned
 * files is written once and never again (ADR-087).
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import { BusinessError, ValidationError } from '@seans-mfe/contracts';
import { compileControlPlane, DSLManifestSchema, parseAndValidateDirectory, formatErrorsForCLI, type DSLManifest } from '@seans-mfe/dsl';
import { generateAllFiles, writeGeneratedFiles } from '@seans-mfe/codegen';
import {
  approvalStatus,
  deriveFleet,
  dumpYaml,
  readDecomposition,
  readSpecs,
  type Decomposition,
  type DerivedFleet,
} from '@seans-mfe/decompose';
import { registerTargetCodegen, resolveFrameworkVariant } from '../../framework/loader';
import {
  legacyCapabilityName,
  legacyComposition,
  legacyFeatureSource,
  legacyManifest,
  legacyMfeName,
  monolithFederationSnippet,
} from './legacy';
import { headStylesOf, shellFiles } from './shell';
import { stopAndAsk, validateDecomposition } from '../../sentinel/decomposition';

// Registers the BFF's file contribution (ADR-094 §2), as remote:generate does.
import '@seans-mfe/plugin-bff/codegen';

export const LEGACY_PORT = 5200;
export const SHELL_PORT = 5199;
export const DEFAULT_DAEMON = 'ws://localhost:3004/graphql';

export interface ScaffoldOptions {
  /** The proposal directory: decomposition.yaml and specs/. */
  proposalDir: string;
  outDir: string;
  /** The monolith's source; its `public/index.html` styles the shell's page. */
  appDir?: string;
  /** Where the monolith is served; default: the evidence bundle's `app`. */
  appUrl?: string;
  daemonWsUrl?: string;
  /** A built `dist/runtime` to point each MFE's runtime dependency at (it is not on npm, ADR-064). */
  runtimeDir?: string;
  force?: boolean;
}

export interface ScaffoldedMfe {
  name: string;
  dir: string;
  role: 'domain' | 'legacy';
  capabilities: string[];
  generated: number;
  kept: number;
}

export interface ScaffoldResult {
  fleetDir: string;
  app: string;
  namespace: string;
  approvedHash: string;
  mfes: ScaffoldedMfe[];
  legacy: { mfe: string; capability: string; remoteEntry: string };
  shell: { dir: string; port: number };
  controlPlane: string;
  rules: string;
  target: string;
  files: number;
  warnings: string[];
}

const SCAFFOLD_HEADER = (doc: Decomposition): string =>
  `# Scaffolded by decompose:scaffold from ${doc.app.name}'s approved decomposition.yaml (${doc.approval?.hash ?? ''}).\n` +
  '# From here on this manifest is the MFE\'s own source: edit it, then remote:generate.\n';

const MOCKS_COMMENT =
  'Demo-mode fixtures (ADR-052), keyed by GraphQL Query field name: the responses decompose:capture recorded from the monolith (ADR-109 §4). ' +
  'Developer-owned: regeneration does not overwrite this file.';

async function writeOnce(file: string, content: string, written: string[]): Promise<void> {
  if (await fs.pathExists(file)) return;
  await fs.ensureDir(path.dirname(file));
  await fs.writeFile(file, content);
  written.push(file);
}

function fleetErrors(v: DerivedFleet['validation']): string[] {
  return [
    ...Object.entries(v.manifests).flatMap(([mfe, errs]) => errs.map((e) => `${mfe}: ${e}`)),
    ...v.composition.map((c) => `composition ${c.rule}: ${c.message}`),
  ];
}

/** The first path segment of every endpoint the proposal's domains call: what the shell forwards while the monolith is composed. */
export function apiPrefixes(doc: Decomposition): string[] {
  const prefixes = new Set<string>();
  for (const d of doc.domains) {
    for (const e of d.endpoints) {
      const p = e.split(' ')[1] ?? '';
      const seg = p.split('/')[1];
      if (seg) prefixes.add(`/${seg}`);
    }
  }
  return [...prefixes].sort();
}

async function resolveAppUrl(opts: ScaffoldOptions): Promise<string | undefined> {
  if (opts.appUrl) return opts.appUrl;
  const bundle = path.join(opts.proposalDir, '..', 'bundle.json');
  if (!(await fs.pathExists(bundle))) return undefined;
  const meta = (await fs.readJson(bundle)) as { app?: unknown };
  return typeof meta.app === 'string' ? meta.app : undefined;
}

/** Generate one MFE directory with the same generator `remote:generate` uses. */
async function generate(dir: string): Promise<{ manifest: DSLManifest; generated: number; kept: number }> {
  const result = await parseAndValidateDirectory(dir);
  if (!result.valid || !result.manifest) {
    throw new ValidationError(`${dir}: ${formatErrorsForCLI(result.errors)}`, 'mfe-manifest.yaml', 'schema');
  }
  registerTargetCodegen(result.manifest);
  const { files } = await generateAllFiles(result.manifest, dir, { frameworkVariant: resolveFrameworkVariant(result.manifest) });
  const written = await writeGeneratedFiles(files);
  if (written.errors.length > 0) throw new ValidationError(`${dir}: ${written.errors.join('; ')}`, 'generate', 'write');
  return { manifest: result.manifest, generated: written.files.length, kept: written.skipped.length };
}

/** Point a generated package.json's runtime dependency at a local build (ADR-064: not on npm yet). */
async function linkRuntime(dir: string, runtimeDir: string): Promise<void> {
  const file = path.join(dir, 'package.json');
  if (!(await fs.pathExists(file))) return;
  const pkg = (await fs.readJson(file)) as Record<string, Record<string, string> | unknown>;
  const spec = `file:${path.relative(dir, runtimeDir).split(path.sep).join('/')}`;
  let changed = false;
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
    const deps = pkg[field] as Record<string, string> | undefined;
    if (deps?.['@seans-mfe-tool/runtime']) {
      deps['@seans-mfe-tool/runtime'] = spec;
      changed = true;
    }
  }
  if (changed) await fs.writeFile(file, `${JSON.stringify(pkg, null, 2)}\n`);
}

function readme(doc: Decomposition, r: Pick<ScaffoldResult, 'mfes' | 'legacy' | 'shell'>, daemon: string): string {
  const rows = r.mfes.map((m) => `| \`${m.name}\` | ${m.role} | ${m.capabilities.map((c) => `\`${c}\``).join(', ')} |`).join('\n');
  return `# ${doc.app.name} — the decomposed fleet

Scaffolded by \`decompose:scaffold\` from the approved \`decomposition.yaml\` (${doc.approval?.hash ?? ''}).
The monolith still renders everything: \`control-plane/control-plane.yaml\` places
\`${r.legacy.capability}\` in the shell's root for every state key (ADR-111 §3). Strangling
moves one placement at a time to a new MFE (#419); \`control-plane/target.yaml\` is where it ends.

| MFE | Role | Capabilities |
|---|---|---|
${rows}

## Run it composed

1. **The monolith, with its remote entry.** Apply \`${r.legacy.mfe}/MONOLITH-FEDERATION.md\` to the
   monolith's build once, then start it as usual. It must serve \`${r.legacy.remoteEntry}\`.
2. **The control plane** (\`packages/control-plane\`, ADR-078):
   \`\`\`bash
   (cd packages/control-plane/registry && npm ci && REGISTRY_TOKEN=local-dev-only PORT=4000 node simple-registry.js) &
   (cd packages/control-plane/daemon && npm ci && REGISTRY_HOST=localhost REGISTRY_PORT=4000 PORT=${new URL(daemon.replace(/^ws/, 'http')).port || '3004'} node simple-daemon.js) &
   for i in $(seq 0 $(($(jq length control-plane/rules.json) - 1))); do
     jq -c ".[$i]" control-plane/rules.json | curl -fsS -X POST http://localhost:4000/mfes \\
       -H 'Content-Type: application/json' -H 'Authorization: Bearer local-dev-only' -d @-
   done
   \`\`\`
3. **The legacy wrapper, as a production build** — rspack's dev server compiles dynamic imports
   lazily, and a shell on another origin waits on that forever:
   \`cd ${r.legacy.mfe} && npm install && npx rspack build && npx serve dist -l ${LEGACY_PORT} --cors\`
4. **The shell:** \`cd shell && npm install && npm run dev\`, then open http://localhost:${r.shell.port}.
5. **Check parity** against the monolith's baseline (ADR-113):
   \`seans-mfe-tool decompose:verify <evidence> --url http://localhost:${r.shell.port}\`

Every MFE here is an ordinary generated MFE: \`mfe:validate\`, \`check:mfe-drift\` and
\`compose:validate --check\` apply to it as to any other.
`;
}

export async function scaffoldFleet(opts: ScaffoldOptions): Promise<ScaffoldResult> {
  const proposalDir = path.resolve(opts.proposalDir);
  const outDir = path.resolve(opts.outDir);
  const doc = await readDecomposition(path.join(proposalDir, 'decomposition.yaml'));

  // The human gate (#410 step 4): scaffold builds only what was agreed, as it was agreed.
  const approval = approvalStatus(doc);
  if (approval !== 'current') {
    throw new BusinessError(
      approval === 'none'
        ? `${doc.app.name}'s proposal is not approved — approve it in decompose:workspace or with decompose:edit, then scaffold`
        : `${doc.app.name}'s proposal changed after it was approved — review and approve it again, then scaffold`,
      'PROPOSAL_NOT_APPROVED',
      { approval }
    );
  }
  // The playbook's structural rules (#420): a proposal that breaks one cannot be built as agreed.
  const verdict = await validateDecomposition(doc);
  if (!verdict.valid) {
    throw new ValidationError(
      `the approved proposal breaks the playbook's structural rules:\n  ${verdict.errors.map((e) => `${e.path}: ${e.message}`).join('\n  ')}`,
      'decomposition',
      'playbook'
    );
  }
  const specs = await readSpecs(proposalDir);
  const fleet = deriveFleet(doc, specs);
  const errors = fleetErrors(fleet.validation);
  if (errors.length > 0) throw new ValidationError(`the approved proposal does not derive a valid fleet:\n  ${errors.join('\n  ')}`, 'decomposition', 'derive');

  if ((await fs.pathExists(outDir)) && (await fs.readdir(outDir)).length > 0 && !opts.force) {
    throw new BusinessError(`${outDir} is not empty — pass --force to scaffold into it (developer-owned files are kept)`, 'DIR_EXISTS', { outDir });
  }

  const written: string[] = [];
  // Approved, so buildable — but the playbook's stop-and-ask conditions are worth repeating.
  const warnings: string[] = stopAndAsk(doc).map((f) => f.message);
  const write = async (file: string, content: string): Promise<void> => {
    await fs.ensureDir(path.dirname(file));
    await fs.writeFile(file, content);
    written.push(file);
  };

  // 1. The domain MFEs: manifest, the BFF's specs and recorded fixtures (ADR-112, ADR-052).
  for (const [name, manifest] of Object.entries(fleet.manifests)) {
    const dir = path.join(outDir, name);
    await write(path.join(dir, 'mfe-manifest.yaml'), `${SCAFFOLD_HEADER(doc)}${dumpYaml(manifest)}`);
    const bff = fleet.bff[name];
    if (!bff) continue;
    for (const b of Object.keys(bff.specs).sort()) {
      await write(path.join(dir, 'specs', `${b}.yaml`), `# The operations ${name} calls on ${b}, from the proposal (ADR-112).\n${dumpYaml(bff.specs[b])}`);
    }
    await writeOnce(path.join(dir, 'src', 'platform', 'bff', 'mocks.json'), `${JSON.stringify({ _comment: MOCKS_COMMENT, ...bff.mocks }, null, 2)}\n`, written);
    if (Object.keys(bff.mocks).length === 0) warnings.push(`${name}: no recorded responses for its BFF — demo mode will have no fixtures`);
  }

  // 2. The legacy wrapper (ADR-111 §1).
  const appUrl = await resolveAppUrl(opts);
  if (!appUrl) warnings.push('no --app-url and no bundle.json beside the proposal: the legacy wrapper points at http://localhost:5090/');
  const remoteEntry = new URL('remoteEntry.js', appUrl ?? 'http://localhost:5090/').toString();
  const legacyName = legacyMfeName(doc);
  const legacyCap = legacyCapabilityName(doc);
  const legacyDir = path.join(outDir, legacyName);
  const legacy = legacyManifest(doc, { port: LEGACY_PORT });
  await write(path.join(legacyDir, 'mfe-manifest.yaml'), `${SCAFFOLD_HEADER(doc)}${dumpYaml(legacy)}`);
  await writeOnce(path.join(legacyDir, 'src', 'features', legacyCap, `${legacyCap}.tsx`), legacyFeatureSource(doc, { remoteEntry }), written);
  const snippet = monolithFederationSnippet(doc);
  await write(
    path.join(legacyDir, 'MONOLITH-FEDERATION.md'),
    `# Give ${doc.app.name} a remote entry (ADR-111 §1)\n\n` +
      `\`${legacyCap}\` loads \`${remoteEntry}\` and calls the \`mount(element)\` it exposes. ` +
      'The monolith\'s build needs two changes, made once, by the agent or by hand:\n\n' +
      `## A module that mounts the root\n\n\`\`\`tsx\n${snippet.module}\`\`\`\n\n## The federation plugin\n\n\`\`\`js\n${snippet.webpack}\`\`\`\n`
  );

  // 3. Generate every MFE through remote:generate's generator.
  const mfes: ScaffoldedMfe[] = [];
  const parsed: DSLManifest[] = [];
  const all = [...doc.domains.map((d) => ({ name: d.mfe, role: 'domain' as const, caps: d.capabilities.map((c) => c.name) })), { name: legacyName, role: 'legacy' as const, caps: [legacyCap] }];
  for (const m of all) {
    const dir = path.join(outDir, m.name);
    const g = await generate(dir);
    if (opts.runtimeDir) await linkRuntime(dir, path.resolve(opts.runtimeDir));
    parsed.push(g.manifest);
    mfes.push({ name: m.name, dir, role: m.role, capabilities: m.caps, generated: g.generated, kept: g.kept });
  }

  // 4. The composition: the legacy capability everywhere, compiled (ADR-083).
  const composition = legacyComposition(doc);
  const { payload, findings } = compileControlPlane({ document: composition, manifests: parsed.map((p) => DSLManifestSchema.parse(p) as DSLManifest) });
  const fatal = findings.filter((f) => f.fatal);
  if (fatal.length > 0) throw new ValidationError(`the starting composition does not compile: ${fatal.map((f) => f.message).join('; ')}`, 'control-plane', 'compile');
  const controlPlane = path.join(outDir, 'control-plane', 'control-plane.yaml');
  const rules = path.join(outDir, 'control-plane', 'rules.json');
  const target = path.join(outDir, 'control-plane', 'target.yaml');
  await write(
    controlPlane,
    `# The strangler's starting point (ADR-111 §3): the monolith, as ${legacyCap}, in every state.\n` +
      '# Each strangler step moves one placement to a new MFE, then compose:build. target.yaml is where it ends.\n' +
      dumpYaml(composition)
  );
  await write(rules, `${JSON.stringify(payload, null, 2)}\n`);
  await write(
    target,
    `# The approved proposal's composition (ADR-110 §2): where strangling ends. Not compiled — control-plane.yaml is.\n${dumpYaml(fleet.composition)}`
  );

  // 5. The shell.
  const shellDir = path.join(outDir, 'shell');
  const page = opts.appDir ? path.join(path.resolve(opts.appDir), 'public', 'index.html') : undefined;
  const headStyles = page && (await fs.pathExists(page)) ? headStylesOf(await fs.readFile(page, 'utf8')) : '';
  if (!headStyles) warnings.push('no monolith page styles found (pass --app-dir): the shell\'s page background may differ from the monolith\'s');
  const prefixes = apiPrefixes(doc);
  const daemon = opts.daemonWsUrl ?? DEFAULT_DAEMON;
  const shell = shellFiles({
    namespace: doc.app.namespace,
    title: doc.app.name,
    port: SHELL_PORT,
    daemonWsUrl: daemon,
    headStyles,
    proxy: prefixes.length > 0 && appUrl ? { context: prefixes, target: new URL(appUrl).origin } : prefixes.length > 0 ? { context: prefixes, target: 'http://localhost:5090' } : null,
  });
  for (const [rel, content] of Object.entries(shell)) await writeOnce(path.join(shellDir, rel), content, written);
  if (opts.runtimeDir) await linkRuntime(shellDir, path.resolve(opts.runtimeDir));

  const result = {
    mfes,
    legacy: { mfe: legacyName, capability: legacyCap, remoteEntry },
    shell: { dir: shellDir, port: SHELL_PORT },
  };
  await writeOnce(path.join(outDir, 'README.md'), readme(doc, result, daemon), written);

  return {
    fleetDir: outDir,
    app: doc.app.name,
    namespace: doc.app.namespace,
    approvedHash: doc.approval?.hash ?? '',
    ...result,
    controlPlane,
    rules,
    target,
    files: written.length + mfes.reduce((n, m) => n + m.generated, 0),
    warnings,
  };
}
