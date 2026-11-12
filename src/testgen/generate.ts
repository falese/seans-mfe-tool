/**
 * test:generate — an MFE's tests, from what a capture observed (PDR-014, ADR-129).
 *
 * Given an evidence bundle (ADR-109) of a running app and an MFE, writes into
 * the MFE:
 *
 *   src/features/<Cap>/<Cap>.characterization.test.tsx   each capability alone, in jsdom (§3) — React;
 *     (.test.ts for Angular, by TestBed)
 *   src/features/<Cap>/__characterization__/<Cap>.json   its cases
 *   src/__smt__/recorded-network.ts, recorded.json        the harness and the capture's responses
 *   e2e/characterization.e2e.ts                          every journey: text, calls, console, pixels (§4)
 *   e2e/characterization/evidence.json, baselines/*.png   its data and the visual baselines
 *   playwright.characterization.config.ts
 *   src/platform/bff/__tests__/contract.test.ts           the BFF's provider contract (§5)
 *   src/platform/bff/contract/*                           the connector contract, its data, its checker
 *   src/monolith/<path>                                   tests triaged keep, moved with their code (§6)
 *   TESTS.md                                              what is tested, from what, and what is not
 *
 * Every file is the MFE's own (ADR-087). `.smt/tests.json` records what was
 * written; a re-run replaces a file only while it is still what was written,
 * so a developer's change — an updated baseline included — survives (§7).
 */

import { createHash } from 'crypto';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as yaml from 'js-yaml';
import { BusinessError, ValidationError } from '@seans-mfe/contracts';
import { resolveWebTarget } from '@seans-mfe/codegen';
import type { DSLManifest } from '@seans-mfe/dsl';
import { bffOperations, readDecomposition, readSpecs, type Decomposition, type HoistRule, type OpenApiDocument } from '@seans-mfe/decompose';
import { parseJourneys } from '../decompose/journeys';
import { planContracts, upstreamRequests, type ContractPlan, type RecordedResponse } from './contract';
import { aloneTestSource, angularAloneTestSource, connectorTestSource, contractTestSource, journeySpecSource, playwrightConfigSource, SCHEMA_CHECK } from './emit';
import { GENERATED_MARK, RECORDED_NETWORK } from './harness';
import { planTests, type Evidence, type EvidenceRequest, type EvidenceStep, type TestPlan, type TestTarget } from './plan';
import { planPacks } from './pack';
import { baselinePng } from './png';

export interface GenerateOptions {
  /** The MFE to write tests into (holds mfe-manifest.yaml). */
  mfeDir: string;
  /** The evidence bundle the tests are derived from. */
  evidenceDir: string;
  /** A decomposition proposal: capability components, placements, triaged tests. */
  proposalDir?: string;
  /** The monolith's source, for moving tests triaged keep (default: what decompose:analyze recorded). */
  appDir?: string;
  /** Replace files a developer has changed since they were generated. */
  force?: boolean;
  /**
   * Record, from each spec's server, the GET operations the capture holds no
   * response for: a capture of an MFE that reads through its BFF sees only the
   * BFF, never the backends behind it (ADR-129 §5).
   */
  upstream?: boolean;
  /** How `upstream` fetches; injectable for tests. */
  fetchUpstream?: (url: string) => Promise<RecordedResponse>;
}

async function fetchJson(url: string): Promise<RecordedResponse> {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  const mimeType = res.headers.get('content-type')?.split(';')[0] ?? 'application/octet-stream';
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // not JSON: keep the text
  }
  return { status: res.status, mimeType, body };
}

export interface GeneratedMfeTests {
  mfe: string;
  dir: string;
  /** Capabilities with an alone test, and their case counts; skipped ones with why. */
  alone: Array<{ capability: string; cases: number }>;
  skipped: Array<{ capability: string; reason: string }>;
  journeys: { journeys: number; checks: number; baselines: number };
  contract: { operations: number; unrecorded: string[] };
  migrated: { kept: string[]; rewritten: Array<{ file: string; reasons: string[] }>; discarded: Array<{ file: string; reasons: string[] }> };
  /** Files written, relative to the MFE. */
  written: string[];
  /** Files left alone because a developer changed them. */
  kept: string[];
  /** Files a previous run wrote that this one no longer generates, removed. */
  removed: string[];
  /** What could not be generated, with why. */
  warnings: string[];
  report: string;
}

const OWNERSHIP = '.smt/tests.json';
const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
const json = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`;

interface Ownership {
  files: Record<string, string>;
}

/** Writes files the MFE owns, replacing only what is still as last generated (ADR-129 §7). */
class OwnedWriter {
  readonly written: string[] = [];
  readonly kept: string[] = [];
  readonly removed: string[] = [];
  private readonly touched = new Set<string>();
  private constructor(private readonly dir: string, private readonly owned: Ownership, private readonly force: boolean) {}

  static async open(dir: string, force: boolean): Promise<OwnedWriter> {
    const file = path.join(dir, OWNERSHIP);
    const owned = (await fs.pathExists(file)) ? ((await fs.readJson(file)) as Ownership) : { files: {} };
    return new OwnedWriter(dir, owned, force);
  }

  async write(rel: string, content: string | Buffer): Promise<void> {
    const full = path.join(this.dir, rel);
    const next = sha(content);
    this.touched.add(rel);
    if ((await fs.pathExists(full)) && !this.force) {
      const current = sha(await fs.readFile(full));
      if (current !== next && current !== this.owned.files[rel]) {
        this.kept.push(rel);
        return;
      }
    }
    await fs.ensureDir(path.dirname(full));
    await fs.writeFile(full, content);
    this.owned.files[rel] = next;
    this.written.push(rel);
  }

  async close(): Promise<void> {
    // What a previous run wrote and this one did not is no longer generated: removed while it is
    // still as written, kept (and said so) once a developer has changed it.
    for (const rel of Object.keys(this.owned.files)) {
      if (this.touched.has(rel)) continue;
      const full = path.join(this.dir, rel);
      if (!(await fs.pathExists(full))) {
        delete this.owned.files[rel];
        continue;
      }
      if (this.force || sha(await fs.readFile(full)) === this.owned.files[rel]) {
        await fs.remove(full);
        delete this.owned.files[rel];
        this.removed.push(rel);
      } else {
        this.kept.push(rel);
      }
    }
    const file = path.join(this.dir, OWNERSHIP);
    await fs.ensureDir(path.dirname(file));
    const files = Object.fromEntries(Object.entries(this.owned.files).sort(([a], [b]) => a.localeCompare(b)));
    await fs.writeFile(file, json({ _comment: `${GENERATED_MARK}: what test:generate last wrote, so a re-run never replaces your changes.`, files }));
  }
}

/** The bundle as the planner reads it. */
export async function readEvidence(dir: string): Promise<{ evidence: Evidence; responses: Record<string, RecordedResponse> }> {
  const metaFile = path.join(dir, 'bundle.json');
  if (!(await fs.pathExists(metaFile))) throw new ValidationError(`${dir} is not an evidence bundle (no bundle.json)`, 'evidence', 'bundle.json');
  const meta = (await fs.readJson(metaFile)) as { app: string; clock: string; viewport: { width: number; height: number }; journeys: string[] };
  const actions = new Map(parseJourneys(await fs.readFile(path.join(dir, 'journeys.yaml'), 'utf8')).map((j) => [j.name, j.steps]));
  const journeys: Evidence['journeys'] = [];
  for (const name of meta.journeys) {
    const file = path.join(dir, 'journeys', `${name}.json`);
    if (!(await fs.pathExists(file))) continue;
    const j = (await fs.readJson(file)) as { steps: EvidenceStep[] };
    journeys.push({ name, actions: actions.get(name) ?? [], steps: j.steps });
  }
  const requests = (await fs.readJson(path.join(dir, 'requests.json'))) as EvidenceRequest[];
  const responses = (await fs.readJson(path.join(dir, 'responses.json'))) as Record<string, RecordedResponse>;
  return { evidence: { app: meta.app, clock: meta.clock, viewport: meta.viewport, journeys, requests }, responses };
}

interface Manifest {
  name: string;
  framework?: string;
  targets?: { web?: { framework?: string; bundler?: string } };
  capabilities: Array<Record<string, { type?: string } | undefined>>;
  data?: {
    sources?: Array<{
      handler?: { openapi?: { source?: string } };
      transforms?: Array<{ hoistField?: HoistRule[] }>;
    }>;
  };
}

/**
 * The `hoistField` rules the MFE's BFF is configured with, by spec (the
 * file name under specs/), from its manifest: what its graph really exposes
 * (ADR-129 §5). Empty when the manifest declares no sources.
 */
export function manifestHoists(manifest: Manifest): Record<string, HoistRule[]> {
  const out: Record<string, HoistRule[]> = {};
  for (const s of manifest.data?.sources ?? []) {
    const file = s.handler?.openapi?.source;
    if (!file) continue;
    const backend = path.basename(file).replace(/\.ya?ml$|\.json$/, '');
    out[backend] = (s.transforms ?? []).flatMap((t) => t.hoistField ?? []);
  }
  return out;
}

/** What the planner needs to know about the MFE, from its manifest and, when there is one, the proposal. */
/** The jsdom lane an MFE's web build renders a capability alone in, by `resolveWebTarget` (ADR-092 §4). */
function aloneLane(manifest: Manifest): { name: string; lane: 'react' | 'angular' | null } {
  const { framework } = resolveWebTarget(manifest as unknown as DSLManifest);
  return { name: framework, lane: framework === 'react' || framework === 'angular' ? framework : null };
}

export function testTarget(manifest: Manifest, doc?: Decomposition): TestTarget {
  const domain = doc?.domains.find((d) => d.mfe === manifest.name);
  const own = manifest.capabilities
    .flatMap((entry) => Object.entries(entry))
    .filter(([, v]) => !v || v.type === undefined || v.type === 'domain')
    .map(([name]) => name);
  const component = (name: string) => domain?.capabilities.find((c) => c.name === name)?.component ?? name;
  const repeated = new Map((doc?.repeated ?? []).map((r) => [r.capability, r.renderedBy]));
  // Alone tests render a capability in jsdom with its framework's own test bed. A framework
  // with no lane yet is held by the browser tiers, which mount it through the platform (§13).
  const framework = aloneLane(manifest);
  const otherFramework = framework.lane === null ? `no alone lane for ${framework.name} yet (React and Angular have one); its journey spec and its pack hold it, recorded through the capability host` : null;
  const capabilities = own.map((name) => {
    const by = repeated.get(name);
    const notAlone = by ? `drawn by ${by} once per item, with props only it has; its journey checks cover it` : otherFramework;
    return { name, component: component(name), ...(notAlone ? { notAlone } : {}) };
  });
  // Where a capability's view stops: every capability a composition places, anywhere.
  const placed = doc
    ? [
        ...doc.domains.filter((d) => d.shell).flatMap((d) => d.capabilities.slice(0, 1)),
        ...doc.routes.flatMap((r) => r.place.map((p) => doc.domains.find((d) => d.id === p.domain)?.capabilities.find((c) => c.name === p.capability))),
      ]
        .filter((c): c is NonNullable<typeof c> => Boolean(c))
        .map((c) => c.component)
    : capabilities.map((c) => c.component);
  return { mfe: manifest.name, capabilities, boundaries: [...new Set(placed)].sort() };
}

const IMPORT = /(?:from\s+|import\s*\(\s*|require\s*\(\s*|jest\.mock\(\s*)['"`](\.[^'"`]+)['"`]/g;

/** Whether every relative import of a test resolves inside the MFE's copy of the monolith. */
async function resolvesIn(copyRoot: string, file: string, text: string): Promise<boolean> {
  for (const m of text.matchAll(IMPORT)) {
    const target = path.join(copyRoot, path.dirname(file), m[1]);
    const candidates = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'].map((ext) => target + ext);
    let found = false;
    for (const c of candidates) if ((await fs.pathExists(c)) && (await fs.stat(c)).isFile()) found = true;
    if (!found) return false;
  }
  return true;
}

/** The monolith's Jest setup files (`setupFilesAfterEnv`), app-relative: what its tests ran inside. */
async function jestSetupFiles(appDir: string): Promise<string[]> {
  const texts: string[] = [];
  for (const f of ['jest.config.js', 'jest.config.cjs', 'jest.config.ts', 'jest.config.mjs', 'package.json']) {
    const full = path.join(appDir, f);
    if (await fs.pathExists(full)) texts.push(await fs.readFile(full, 'utf8'));
  }
  const files = new Set<string>();
  for (const t of texts) {
    for (const list of t.matchAll(/["']?setupFilesAfterEnv["']?\s*:\s*\[([^\]]*)\]/g)) {
      for (const m of list[1].matchAll(/['"`]<rootDir>\/([^'"`]+)['"`]/g)) files.add(m[1]);
    }
  }
  const found: string[] = [];
  for (const f of [...files].sort()) if (await fs.pathExists(path.join(appDir, f))) found.push(f);
  return found;
}

async function appDirOf(evidenceDir: string, given?: string): Promise<string | undefined> {
  if (given) return path.resolve(given);
  const project = path.join(evidenceDir, 'source', 'project.json');
  if (!(await fs.pathExists(project))) return undefined;
  const dir = ((await fs.readJson(project)) as { dir?: string }).dir;
  return dir ? path.resolve(evidenceDir, dir) : undefined;
}

/** The Playwright spec's data: journeys, the responses they replay, and BFF field → backend call. */
function journeyEvidence(plan: TestPlan, responses: Record<string, RecordedResponse>, specs: Record<string, OpenApiDocument>, gateway: boolean, hoists: Record<string, HoistRule[]>) {
  const bff: Record<string, string> = {};
  for (const [b, spec] of Object.entries(specs)) {
    for (const op of bffOperations(spec, b, { gateway }, hoists[b])) {
      bff[op.field] = `${op.method} ${op.path}`;
      if (op.hoist) bff[op.hoist.field] = `${op.method} ${op.path}`;
    }
  }
  const journeys = plan.journeys
    .map((j) => ({ ...j, steps: j.steps }))
    .filter((j) => j.steps.some((s) => s.capabilities.length > 0));
  return { _comment: `${GENERATED_MARK}. Re-run test:generate after a new capture.`, app: plan.app, clock: plan.clock, viewport: plan.viewport, bff, responses, journeys };
}

function report(plan: TestPlan, contract: ContractPlan, migrated: GeneratedMfeTests['migrated'], checks: number, baselines: number, kept: string[]): string {
  const lines = [
    `# ${plan.mfe} — tests`,
    '',
    `${GENERATED_MARK}, from the capture of ${plan.app} (clock ${plan.clock}). What the captured app did is the specification (ADR-113 §1).`,
    '',
    '| Suite | Runs with | What it holds the MFE to |',
    '|---|---|---|',
    `| Alone — ${plan.capabilities.filter((c) => !c.skipped).length} capabilities, ${plan.capabilities.reduce((n, c) => n + c.cases.length, 0)} states | \`npm test\` | each capability rendered by itself shows what it showed, makes its calls, logs no new error |`,
    `| Journeys — ${plan.journeys.filter((j) => j.steps.some((s) => s.capabilities.length > 0)).length} journeys, ${checks} checks, ${baselines} baselines | \`npm run test:e2e\` | the same, in a browser, step by step, plus pixels |`,
    `| Contract — ${contract.operations.length} operations | \`npm test\`, then \`npm run test:contract\` | what the backends sent is what the specs say, the demo fixtures are it, and the connector returns it |`,
    ...(migrated.kept.length + migrated.rewritten.length + migrated.discarded.length > 0 ? [`| Moved from the monolith — ${migrated.kept.length} | \`npm test\` | tests triaged keep |`] : []),
    '',
    '## Capabilities',
    '',
  ];
  for (const c of plan.capabilities) {
    lines.push(c.skipped ? `- **${c.capability}** — no alone test: ${c.skipped}` : `- **${c.capability}** — ${c.cases.map((k) => `\`${k.path}\` (${k.step})`).join(', ')}`);
  }
  lines.push('', '## Contract', '');
  for (const o of contract.operations) {
    lines.push(`- \`${o.call}\` — recorded as \`${o.url}\``);
    if (o.undeclared.length > 0) lines.push(`  - the backend also sends ${o.undeclared.map((u) => `\`${u}\``).join(', ')}, which its spec does not declare, so the BFF does not expose them`);
  }
  for (const u of contract.unrecorded) {
    lines.push(`- \`${u}\` — **untested**: ${u.includes('{') ? 'no recording — it takes a path parameter no recorded call supplied' : 'no recording — the capture never called it (try --upstream)'}`);
  }
  if (contract.operations.length + contract.unrecorded.length === 0) lines.push('No BFF.');
  if (migrated.kept.length + migrated.rewritten.length + migrated.discarded.length > 0) {
    lines.push('', '## From the monolith’s suite', '');
    for (const f of migrated.kept) lines.push(`- kept: \`${f}\` → \`src/monolith/${f}\``);
    for (const f of migrated.rewritten) lines.push(`- rewritten as the characterization tests above: \`${f.file}\` — ${f.reasons.join('; ')}`);
    for (const f of migrated.discarded) lines.push(`- discarded: \`${f.file}\` — ${f.reasons.join('; ')}`);
  }
  lines.push('', '## Not covered', '', 'Only what the capture exercised is specified. Behaviour no journey reached is not tested here; add a journey and re-run.');
  if (kept.length > 0) lines.push('', '## Kept as you changed them', '', ...kept.map((k) => `- \`${k}\``));
  return `${lines.join('\n')}\n`;
}

const SCRIPTS: Record<string, string> = {
  'test:e2e': 'playwright test -c playwright.characterization.config.ts',
  'test:contract': "mesh build && jest --testRegex 'contract/[^/]+\\.contract\\.ts$'",
};

/** The scripts, the Playwright dependency, and keeping Jest off the Playwright spec. Only adds. */
async function updatePackage(dir: string, hasBff: boolean, playwrightVersion: string): Promise<void> {
  const file = path.join(dir, 'package.json');
  if (!(await fs.pathExists(file))) return;
  const pkg = (await fs.readJson(file)) as {
    scripts?: Record<string, string>;
    devDependencies?: Record<string, string>;
    jest?: { testPathIgnorePatterns?: string[] };
  };
  const before = JSON.stringify(pkg);
  pkg.scripts ??= {};
  pkg.scripts['test:e2e'] ??= SCRIPTS['test:e2e'];
  if (hasBff) pkg.scripts['test:contract'] ??= SCRIPTS['test:contract'];
  pkg.devDependencies ??= {};
  pkg.devDependencies['@playwright/test'] ??= playwrightVersion;
  if (pkg.jest) {
    const ignore = (pkg.jest.testPathIgnorePatterns ??= ['/node_modules/']);
    if (!ignore.includes('<rootDir>/e2e/')) ignore.push('<rootDir>/e2e/');
  }
  if (JSON.stringify(pkg) !== before) await fs.writeFile(file, json(pkg));
}

/** The upstream answers the last run's contract recorded, by `GET <endpoint>`. */
async function previousUpstream(dir: string): Promise<Record<string, RecordedResponse>> {
  const file = path.join(dir, 'src', 'platform', 'bff', 'contract', 'recorded.json');
  if (!(await fs.pathExists(file))) return {};
  const doc = (await fs.readJson(file).catch(() => ({}))) as { operations?: Array<{ call: string; status: number; body: unknown }> };
  return Object.fromEntries((doc.operations ?? []).map((o) => [o.call, { status: o.status, mimeType: 'application/json', body: o.body }]));
}

export async function generateTests(opts: GenerateOptions): Promise<GeneratedMfeTests> {
  const dir = path.resolve(opts.mfeDir);
  const evidenceDir = path.resolve(opts.evidenceDir);
  const manifestFile = path.join(dir, 'mfe-manifest.yaml');
  if (!(await fs.pathExists(manifestFile))) throw new ValidationError(`${dir} has no mfe-manifest.yaml`, 'mfe', 'manifest');
  const manifest = yaml.load(await fs.readFile(manifestFile, 'utf8')) as Manifest;
  const doc = opts.proposalDir ? await readDecomposition(path.join(path.resolve(opts.proposalDir), 'decomposition.yaml')) : undefined;
  const { evidence, responses } = await readEvidence(evidenceDir);
  // Steps were captured, yet nothing mapped to a capability: no boundary stamp (not recorded
  // through the host) and no React debug source (a production build), or not the app. Generating from it would write an empty
  // suite and remove the real one, so stop before anything is written.
  const steps = evidence.journeys.flatMap((j) => j.steps);
  if (steps.length > 0 && steps.every((s) => s.regions.length === 0)) {
    throw new BusinessError(
      `none of ${steps.length} captured steps attributed anything to a capability — record through the capability host (--host), which works for any framework and build, or against a React development build; nothing was written`,
      'NOTHING_ATTRIBUTED',
      { evidence: evidenceDir, steps: steps.length }
    );
  }
  const plan = planTests(evidence, testTarget(manifest, doc));
  const out = await OwnedWriter.open(dir, opts.force ?? false);
  const warnings: string[] = [];

  // §3 — alone, per capability.
  await out.write('src/__smt__/recorded-network.ts', RECORDED_NETWORK);
  await out.write('src/__smt__/recorded.json', json(responses));
  for (const c of plan.capabilities) {
    if (c.skipped) continue;
    const base = `src/features/${c.capability}`;
    await out.write(`${base}/__characterization__/${c.capability}.json`, json({ _comment: `${GENERATED_MARK}.`, app: plan.app, clock: plan.clock, cases: c.cases }));
    if (aloneLane(manifest).lane === 'angular') await out.write(`${base}/${c.capability}.characterization.test.ts`, angularAloneTestSource(c.capability, plan.app));
    else await out.write(`${base}/${c.capability}.characterization.test.tsx`, aloneTestSource(c.capability, plan.app));
  }

  // §4 — journeys, with a baseline per capability per step.
  const specs = (await readSpecs(dir))?.specs ?? {};
  const hoists = manifestHoists(manifest);
  const gateway = doc?.app.gateway !== false;
  let checks = 0;
  let baselines = 0;
  const shots = new Map<string, Buffer>();
  for (const j of evidence.journeys) for (const s of j.steps) shots.set(s.id, await fs.readFile(path.join(evidenceDir, s.screenshot)).catch(() => Buffer.alloc(0)));
  for (const j of plan.journeys) {
    for (const s of j.steps) {
      for (const c of s.capabilities) {
        checks += 1;
        const shot = shots.get(s.id);
        if (!c.visual || !shot || shot.length === 0) {
          c.visual = null;
          continue;
        }
        await out.write(`e2e/characterization/baselines/${c.visual.name}.png`, baselinePng(shot, c.visual.rect, c.visual.exclude));
        baselines += 1;
      }
    }
  }
  // §12 — each capability's pack, for any host that composes it (test:run).
  for (const pack of planPacks(plan)) {
    await out.write(`e2e/packs/${pack.capability}.json`, json({ _comment: `${GENERATED_MARK}. Run by test:run in a composition.`, ...pack }));
  }
  await out.write('e2e/characterization/evidence.json', json(journeyEvidence(plan, responses, specs, gateway, hoists)));
  await out.write('e2e/characterization.e2e.ts', journeySpecSource(plan.mfe, plan.app));
  await out.write('playwright.characterization.config.ts', playwrightConfigSource(plan.viewport));

  // §5 — the BFF's contract.
  const upstream: Record<string, RecordedResponse> = {};
  if (opts.upstream) {
    const get = opts.fetchUpstream ?? fetchJson;
    // What each server answered last time: a server that is down now does not take its contract with it.
    const previous = await previousUpstream(dir);
    for (const r of upstreamRequests(specs, { gateway })) {
      if (r.key in responses) continue;
      try {
        upstream[r.key] = await get(r.url);
      } catch (err) {
        const why = err instanceof Error ? err.message : String(err);
        const kept = previous[r.key];
        if (kept) upstream[r.key] = kept;
        warnings.push(`upstream ${r.url}: ${why} — ${kept ? 'kept what it answered last time' : 'no contract test'} for ${r.key}`);
      }
    }
  }
  const contract = planContracts(specs, { ...upstream, ...responses }, { gateway }, hoists);
  if (Object.keys(specs).length > 0) {
    await out.write('src/platform/bff/contract/recorded.json', json({ _comment: `${GENERATED_MARK}.`, operations: contract.operations, unrecorded: contract.unrecorded }));
    await out.write('src/platform/bff/contract/schema-check.ts', SCHEMA_CHECK);
    await out.write('src/platform/bff/contract/connector.contract.ts', connectorTestSource(plan.mfe));
    if (contract.operations.length > 0) await out.write('src/platform/bff/__tests__/contract.test.ts', contractTestSource(plan.mfe));
  }

  // §6 — the monolith's tests, as triaged.
  const migrated: GeneratedMfeTests['migrated'] = { kept: [], rewritten: [], discarded: [] };
  const domain = doc?.domains.find((d) => d.mfe === plan.mfe);
  const appDir = await appDirOf(evidenceDir, opts.appDir);
  if (doc && domain) {
    const copyRoot = path.join(dir, 'src', 'monolith');
    // A keeper ran inside the monolith's Jest setup; it moves with it, imported from the test itself.
    const setup = appDir ? await jestSetupFiles(appDir) : [];
    for (const t of doc.tests) {
      if (t.verdict === 'keep') {
        const source = appDir ? path.join(appDir, t.file) : undefined;
        if (!source || !(await fs.pathExists(source))) continue;
        const text = await fs.readFile(source, 'utf8');
        // A keeper moves with its code: to every MFE that carries all of what it imports.
        if (!(await fs.pathExists(copyRoot)) || !(await resolvesIn(copyRoot, t.file, text))) continue;
        const imports = setup.map((s) => {
          const rel = path.posix.relative(path.posix.dirname(t.file), s.replace(/\.[jt]sx?$/, ''));
          return `import '${rel.startsWith('.') ? rel : `./${rel}`}'; // the monolith's Jest setup, moved with this test (ADR-129 §6)\n`;
        });
        for (const s of setup) if (appDir) await out.write(`src/monolith/${s}`, await fs.readFile(path.join(appDir, s), 'utf8'));
        await out.write(`src/monolith/${t.file}`, `${imports.join('')}${text}`);
        migrated.kept.push(t.file);
      } else if (t.domain === domain.id) {
        (t.verdict === 'rewrite' ? migrated.rewritten : migrated.discarded).push({ file: t.file, reasons: t.reasons });
      }
    }
  }

  await updatePackage(dir, Object.keys(specs).length > 0, '^1.44.0');
  const text = report(plan, contract, migrated, checks, baselines, out.kept);
  await out.write('TESTS.md', text);
  await out.close();

  return {
    mfe: plan.mfe,
    dir,
    alone: plan.capabilities.filter((c) => !c.skipped).map((c) => ({ capability: c.capability, cases: c.cases.length })),
    skipped: plan.capabilities.filter((c) => c.skipped).map((c) => ({ capability: c.capability, reason: c.skipped as string })),
    journeys: { journeys: plan.journeys.filter((j) => j.steps.some((s) => s.capabilities.length > 0)).length, checks, baselines },
    contract: { operations: contract.operations.length, unrecorded: contract.unrecorded },
    migrated,
    written: out.written,
    kept: out.kept,
    removed: out.removed,
    warnings,
    report: path.join(dir, 'TESTS.md'),
  };
}

/** Every MFE of a ported decomposition (ADR-129 §8): the fleet from `proposal/scaffold.json`. */
export async function generateFleetTests(opts: { proposalDir: string; evidenceDir?: string; fleetDir?: string; appDir?: string; force?: boolean; upstream?: boolean }): Promise<GeneratedMfeTests[]> {
  const proposalDir = path.resolve(opts.proposalDir);
  const doc = await readDecomposition(path.join(proposalDir, 'decomposition.yaml'));
  const scaffold = path.join(proposalDir, 'scaffold.json');
  const fleetDir = opts.fleetDir ? path.resolve(opts.fleetDir) : (await fs.pathExists(scaffold)) ? ((await fs.readJson(scaffold)) as { fleetDir: string }).fleetDir : undefined;
  if (!fleetDir) throw new ValidationError('no fleet: pass --fleet, or scaffold the proposal first', 'fleet', 'scaffold.json');
  const evidenceDir = path.resolve(opts.evidenceDir ?? path.join(proposalDir, '..'));
  const results: GeneratedMfeTests[] = [];
  for (const d of doc.domains) {
    const mfeDir = path.join(fleetDir, d.mfe);
    if (!(await fs.pathExists(path.join(mfeDir, 'mfe-manifest.yaml')))) continue;
    results.push(await generateTests({ mfeDir, evidenceDir, proposalDir, appDir: opts.appDir, force: opts.force, upstream: opts.upstream }));
  }
  return results;
}
