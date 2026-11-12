/**
 * test:run — every MFE of a composition, its tests run together (ADR-129 §12).
 *
 * A composition (`control-plane/rules.json`, compiled from `control-plane.yaml`, ADR-083)
 * says, for each action, which MFE's capability goes into which slot. The run:
 *
 *   1. each MFE's own suites, in its own directory — `npm test`'s Jest (conformance,
 *      alone, provider contract, its developer's tests) and the connector contracts;
 *   2. in the running shell, each action fired, and each placement it makes checked to
 *      mount in its slot, found by its boundary stamp (#408);
 *   3. each placed capability's pack (`e2e/packs/<Cap>.json`, test:generate) run inside
 *      its slot: its recorded states, on its recorded data and clock.
 *
 * Add or remove an MFE in the composition and the aggregate follows. This file is the
 * plan, the replay lookup, the per-MFE suites and the report; the browser half is
 * `run-page.ts`.
 */

import { execFile } from 'child_process';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import * as fs from 'fs-extra';
import * as yaml from 'js-yaml';
import { bodyKey, responseKey } from '../decompose/bundle';
import type { RecordedResponse } from './contract';
import type { CapabilityPack } from './pack';

const run = promisify(execFile);

export interface Placement {
  mfe: string;
  capability: string;
  slot: string;
  /** Where its MFE is loaded from: probed when it does not mount, to tell unserved from broken. */
  remoteEntryUrl?: string;
}

export interface Composition {
  /** The action that places into the root slot: fired before any other. */
  root: string | null;
  actions: Array<{ stateKey: string; placements: Placement[] }>;
}

interface RuleDoc {
  registration: { name: string; remoteEntryUrl?: string };
  routes: Array<{ when: { stateKey?: string }; resolve: { capability: string; props?: { slot?: string } } }>;
}

export function compositionOf(rules: RuleDoc[]): Composition {
  const byKey = new Map<string, Placement[]>();
  for (const doc of rules) {
    for (const r of doc.routes) {
      const key = r.when.stateKey;
      const slot = r.resolve.props?.slot;
      if (!key || !slot) continue;
      byKey.set(key, [...(byKey.get(key) ?? []), { mfe: doc.registration.name, capability: r.resolve.capability, slot, ...(doc.registration.remoteEntryUrl ? { remoteEntryUrl: doc.registration.remoteEntryUrl } : {}) }]);
    }
  }
  const root = [...byKey.entries()].find(([, ps]) => ps.some((p) => p.slot === 'root'))?.[0] ?? null;
  const keys = [...byKey.keys()].sort((a, b) => (a === root ? -1 : b === root ? 1 : a.localeCompare(b)));
  return { root, actions: keys.map((stateKey) => ({ stateKey, placements: byKey.get(stateKey) as Placement[] })) };
}

/**
 * Why a placement's remote cannot load, or null when its entry is served. A dev server's
 * SPA fallback answers a missing file 200 with HTML, so the content type is the check.
 */
export async function remoteServed(url: string, fetchFn: (u: string) => Promise<Response> = fetch): Promise<string | null> {
  let res: Response;
  try {
    res = await fetchFn(url);
  } catch {
    return `its remote entry ${url} does not answer: is it running?`;
  }
  if (!res.ok) return `its remote entry ${url} answers ${res.status}`;
  const type = (res.headers.get('content-type') ?? '').split(';')[0].trim();
  if (!/javascript|ecmascript/.test(type)) return `its remote entry ${url} answers ${type || 'no content type'}, not JavaScript: not built or not served`;
  return null;
}

/**
 * A request answered from the recording of the MFE whose origin it goes to — by its body
 * first, one GraphQL endpoint answering many documents — or undefined to let it through.
 */
export function replayLookup(
  method: string,
  url: string,
  body: string | undefined,
  responses: Map<string, Record<string, RecordedResponse>>
): RecordedResponse | undefined {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return undefined;
  }
  const recorded = responses.get(u.origin);
  if (!recorded) return undefined;
  const rel = u.pathname + u.search;
  return (body ? recorded[bodyKey(method, rel, body)] : undefined) ?? recorded[responseKey(method, rel)];
}

export type SuiteResult = { passed: number; failed: number; failures?: string[] } | { skipped: string };

export interface MfeRun {
  mfe: string;
  /** The MFE's directory, relative to the project; null for a placement with none (a second build). */
  dir: string | null;
  unit: SuiteResult;
  contract: SuiteResult;
}

export interface PackRun {
  mfe: string;
  capability: string;
  slot: string;
  stateKey: string;
  cases: Array<{ name: string; ok: boolean; failure?: string }>;
}

export interface RunReport {
  project: string;
  ok: boolean;
  mfes: MfeRun[];
  composed: {
    actions: Array<{ stateKey: string; placements: Array<Placement & { mounted: boolean; error?: string }> }>;
    packs: PackRun[];
    /** Placed capabilities with no pack: their MFE has not been recorded. */
    unpacked: Array<{ mfe: string; capability: string }>;
  } | { skipped: string };
}

/** The project's MFE directories by manifest name, from the composition's `mfes:` list. */
export async function mfeDirs(projectDir: string): Promise<Map<string, string>> {
  const doc = yaml.load(await fs.readFile(path.join(projectDir, 'control-plane', 'control-plane.yaml'), 'utf8')) as { mfes?: string[] };
  const out = new Map<string, string>();
  for (const entry of doc.mfes ?? []) {
    const dir = path.resolve(projectDir, entry);
    const manifest = path.join(dir, 'mfe-manifest.yaml');
    if (!(await fs.pathExists(manifest))) continue;
    const name = (yaml.load(await fs.readFile(manifest, 'utf8')) as { name?: string }).name;
    if (name) out.set(name, dir);
  }
  return out;
}

interface JestJson {
  numPassedTests: number;
  numFailedTests: number;
  numTotalTestSuites: number;
  numFailedTestSuites: number;
  testResults?: Array<{ name: string; status: string; message?: string; assertionResults?: Array<{ fullName: string; status: string }> }>;
}

/** One Jest run in an MFE's directory, read from its JSON report. */
async function jest(dir: string, args: string[]): Promise<SuiteResult> {
  if (!(await fs.pathExists(path.join(dir, 'node_modules', '.bin', 'jest')))) return { skipped: 'not installed (npm install in it)' };
  const out = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'smt-run-')), 'jest.json');
  try {
    await run('npx', ['jest', '--ci', '--json', `--outputFile=${out}`, ...args], { cwd: dir, timeout: 15 * 60_000, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, CI: 'true' } }).catch(() => undefined);
    if (!(await fs.pathExists(out))) return { skipped: 'jest wrote no report' };
    const r = (await fs.readJson(out)) as JestJson;
    const failures = (r.testResults ?? []).flatMap((t) => {
      const failed = (t.assertionResults ?? []).filter((a) => a.status === 'failed').map((a) => `${path.relative(dir, t.name)}: ${a.fullName}`);
      return failed.length > 0 ? failed : t.status === 'failed' ? [`${path.relative(dir, t.name)}: suite failed to run`] : [];
    });
    return { passed: r.numPassedTests, failed: r.numFailedTests + (failures.length > r.numFailedTests ? failures.length - r.numFailedTests : 0), ...(failures.length > 0 ? { failures } : {}) };
  } finally {
    await fs.remove(path.dirname(out));
  }
}

/** An MFE's own suites: `npm test`'s Jest, then its connector contracts (after `mesh build`). */
export async function runMfeSuites(mfe: string, dir: string, projectDir: string): Promise<MfeRun> {
  const unit = await jest(dir, []);
  const contractDir = path.join(dir, 'src', 'platform', 'bff', 'contract');
  let contract: SuiteResult;
  const connectors = (await fs.pathExists(contractDir)) ? (await fs.readdir(contractDir)).filter((f) => f.endsWith('.contract.ts')) : [];
  if (connectors.length === 0) {
    contract = { skipped: 'no BFF' };
  } else if ('skipped' in unit && unit.skipped.startsWith('not installed')) {
    contract = unit;
  } else {
    if (!(await fs.pathExists(path.join(dir, '.mesh')))) await run('npx', ['mesh', 'build'], { cwd: dir, timeout: 10 * 60_000 }).catch(() => undefined);
    contract = (await fs.pathExists(path.join(dir, '.mesh'))) ? await jest(dir, ['--testRegex', 'contract/[^/]+\\.contract\\.ts$']) : { skipped: 'mesh build failed' };
  }
  return { mfe, dir: path.relative(projectDir, dir), unit, contract };
}

/** Each MFE's packs and recorded responses (by its origin), for the composed run. */
export async function readPacks(dirs: Map<string, string>): Promise<{ packs: CapabilityPack[]; responses: Map<string, Record<string, RecordedResponse>> }> {
  const packs: CapabilityPack[] = [];
  const responses = new Map<string, Record<string, RecordedResponse>>();
  for (const dir of dirs.values()) {
    const packDir = path.join(dir, 'e2e', 'packs');
    if (await fs.pathExists(packDir)) {
      for (const f of (await fs.readdir(packDir)).filter((x) => x.endsWith('.json')).sort()) packs.push((await fs.readJson(path.join(packDir, f))) as CapabilityPack);
    }
    const recorded = path.join(dir, 'src', '__smt__', 'recorded.json');
    const first = packs.find((p) => dirs.get(p.mfe) === dir);
    if (first && (await fs.pathExists(recorded))) responses.set(new URL(first.app).origin, (await fs.readJson(recorded)) as Record<string, RecordedResponse>);
  }
  return { packs, responses };
}

const suiteCell = (s: SuiteResult): string => ('skipped' in s ? s.skipped : `${s.passed} / ${s.failed}`);
const failed = (s: SuiteResult): boolean => !('skipped' in s) && s.failed > 0;

export function runOk(report: Omit<RunReport, 'ok'>): boolean {
  if (report.mfes.some((m) => failed(m.unit) || failed(m.contract))) return false;
  if ('skipped' in report.composed) return true;
  return report.composed.actions.every((a) => a.placements.every((p) => p.mounted)) && report.composed.packs.every((p) => p.cases.every((c) => c.ok));
}

export function renderRunReport(r: RunReport): string {
  const lines = [`# ${r.project} — ${r.ok ? '✓ every test passes' : '✗ not every test passes'}`, '', '## Each MFE’s own suites', '', 'Passed / failed.', '', '| MFE | Jest (`npm test`) | Connector contracts |', '|---|---|---|'];
  for (const m of r.mfes) lines.push(`| ${m.mfe} | ${suiteCell(m.unit)} | ${suiteCell(m.contract)} |`);
  for (const m of r.mfes) for (const f of [...('failures' in m.unit ? m.unit.failures ?? [] : []), ...('failures' in m.contract ? m.contract.failures ?? [] : [])]) lines.push(`- ✗ ${m.mfe}: ${f}`);
  lines.push('', '## Composed', '');
  if ('skipped' in r.composed) {
    lines.push(`Not run: ${r.composed.skipped}.`);
    return `${lines.join('\n')}\n`;
  }
  lines.push('| Action | Placements mounted |', '|---|---|');
  for (const a of r.composed.actions) lines.push(`| \`${a.stateKey}\` | ${a.placements.filter((p) => p.mounted).length} / ${a.placements.length} |`);
  for (const a of r.composed.actions) for (const p of a.placements.filter((x) => !x.mounted)) lines.push(`- ✗ \`${a.stateKey}\` → ${p.mfe} / ${p.capability} did not mount in \`${p.slot}\`${p.error ? `: ${p.error}` : ''}`);
  lines.push('', '### Capability packs, in their slots', '');
  for (const p of r.composed.packs) {
    const ok = p.cases.filter((c) => c.ok).length;
    lines.push(`- ${ok === p.cases.length ? '✓' : '✗'} ${p.mfe} / ${p.capability} in \`${p.slot}\` (\`${p.stateKey}\`): ${ok} / ${p.cases.length} cases`);
  }
  for (const p of r.composed.packs) for (const c of p.cases.filter((x) => !x.ok)) lines.push(`- ✗ \`${p.stateKey}\` → ${p.mfe} / ${p.capability} in \`${p.slot}\`, case ${c.name}: ${c.failure ?? 'failed'}`);
  if (r.composed.unpacked.length > 0) {
    lines.push('', '### Placed, but not recorded', '', 'Their mounting is checked above; their behaviour is not, until their MFE has a pack.', '');
    for (const u of r.composed.unpacked) lines.push(`- ${u.mfe} / ${u.capability} — no pack: run test:generate in it`);
  }
  return `${lines.join('\n')}\n`;
}
