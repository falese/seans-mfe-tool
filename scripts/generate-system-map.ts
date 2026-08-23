#!/usr/bin/env ts-node
/**
 * The system map's counts are measured, not typed.
 *
 * `docs/system-map.html` is the executive-facing artifact — the site tooling
 * calls it "the point of the site" — and its own lede says the counts are
 * "measured from the repository at the commit this page was generated from".
 * They were not. They were hand-typed, and by the time anyone checked, three
 * of eight were wrong:
 *
 *     shared packages   9  ->  11   (two plugin extractions)
 *     code templates   44  ->  56
 *     test files      220  -> 236
 *
 * None of that is anyone's carelessness. A number in HTML has no relationship
 * to the thing it counts, so it decays the moment the repository moves. This
 * is the same failure ADR-075 fixed for the ADR index — frontmatter is the
 * source of truth, the table is a generated view under a diff gate — applied
 * to the page a reader is most likely to trust and least able to check.
 *
 * The narrative around the metrics stays hand-written. Argument is authored;
 * facts are derived. Only the block between the markers is generated.
 *
 * Usage:
 *   npm run build:system-map           # write
 *   npm run build:system-map:check     # fail if the committed page is stale
 */

import * as fs from 'fs';
import * as path from 'path';
import { PLATFORM_CAPABILITIES } from '@seans-mfe/contracts';

const REPO_ROOT = path.resolve(__dirname, '..');
const PAGE = path.join(REPO_ROOT, 'docs', 'system-map.html');
const METRICS_REGION = 'repo-metrics';
const DECISIONS_REGION = 'decision-status';

const exists = (p: string): boolean => fs.existsSync(p);

/** Recursive file walk that never descends into build or dependency output. */
function walk(dir: string, keep: (p: string) => boolean, acc: string[] = []): string[] {
  if (!exists(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.mesh', '.git', 'coverage'].includes(entry.name)) continue;
      walk(full, keep, acc);
    } else if (keep(full)) {
      acc.push(full);
    }
  }
  return acc;
}

interface Metric {
  value: number;
  label: string;
}

function measure(): Metric[] {
  const examples = path.join(REPO_ROOT, 'examples');
  const manifests = walk(examples, (p) => path.basename(p) === 'mfe-manifest.yaml');

  // A demo product is a top-level example directory containing at least one MFE.
  const products = new Set(
    manifests.map((p) => path.relative(examples, p).split(path.sep)[0]),
  );

  const adrDir = path.join(REPO_ROOT, 'docs', 'architecture-decisions');
  const pdrDir = path.join(REPO_ROOT, 'docs', 'product-decisions');
  const adrs = fs.readdirSync(adrDir).filter((f) => /^ADR-\d+.*\.md$/.test(f));
  const pdrs = fs.readdirSync(pdrDir).filter((f) => /^PDR-\d+.*\.md$/.test(f));

  const packages = fs
    .readdirSync(path.join(REPO_ROOT, 'packages'), { withFileTypes: true })
    .filter((e) => e.isDirectory() && exists(path.join(REPO_ROOT, 'packages', e.name, 'package.json')));

  // One schema per agent-facing command (scripts/generate-schemas.ts writes them).
  const schemas = fs
    .readdirSync(path.join(REPO_ROOT, 'schemas'))
    .filter((f) => f.endsWith('.json'));

  const templates = walk(path.join(REPO_ROOT, 'packages'), (p) => p.endsWith('.ejs'));

  const tests = walk(REPO_ROOT, (p) => /\.test\.(ts|tsx|js|jsx)$/.test(p));

  return [
    { value: manifests.length, label: `reference capabilities, across ${products.size} complete demo products` },
    { value: adrs.length, label: 'recorded architecture decisions' },
    { value: pdrs.length, label: 'recorded product decisions' },
    { value: packages.length, label: 'shared packages' },
    { value: schemas.length, label: 'commands, each also an AI-assistant tool' },
    { value: templates.length, label: 'code templates in the build system' },
    { value: PLATFORM_CAPABILITIES.length, label: 'abilities every capability must have' },
    { value: tests.length, label: 'test files' },
  ];
}

function render(metrics: readonly Metric[]): string {
  const rows = metrics
    .map((m) => `        <div class="metric"><b>${m.value}</b><span>${m.label}</span></div>`)
    .join('\n');
  return ['      <div class="metrics">', rows, '      </div>'].join('\n');
}

/**
 * The decision register, rolled up by lifecycle tier.
 *
 * Read straight from each ADR's frontmatter — the source of truth under
 * ADR-075 — rather than from any hand-kept summary. An executive's question is
 * not "how many decisions exist" but "which are still open", so ratified-and-
 * built is one bucket and everything unfinished is broken out.
 */
function decisionStatus(): { tier: string; count: number; note: string }[] {
  const adrDir = path.join(REPO_ROOT, 'docs', 'architecture-decisions');
  const statuses: string[] = [];
  for (const file of fs.readdirSync(adrDir)) {
    if (!/^ADR-\d+.*\.md$/.test(file)) continue;
    const text = fs.readFileSync(path.join(adrDir, file), 'utf8');
    const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
    if (!frontmatter) continue;
    const status = /^status:\s*(.+)$/m.exec(frontmatter[1]);
    if (status) statuses.push(status[1].trim());
  }
  const count = (s: string): number => statuses.filter((x) => x === s).length;
  return [
    { tier: 'Implemented', count: count('Implemented'), note: 'decided and built' },
    { tier: 'Accepted', count: count('Accepted'), note: 'decided, build outstanding' },
    { tier: 'Proposed', count: count('Proposed'), note: 'written down, not yet agreed' },
    { tier: 'Deferred', count: count('Deferred'), note: 'postponed on purpose' },
    { tier: 'Superseded', count: count('Superseded'), note: 'replaced by a later decision' },
  ].filter((row) => row.count > 0);
}

function renderDecisions(rows: readonly { tier: string; count: number; note: string }[]): string {
  const cells = rows
    .map((r) => `        <div class="metric"><b>${r.count}</b><span>${r.tier} — ${r.note}</span></div>`)
    .join('\n');
  return ['      <div class="metrics">', cells, '      </div>'].join('\n');
}

/** Replace the content between the markers, leaving the authored prose alone. */
function splice(text: string, body: string, region: string): { text: string; changed: boolean } {
  const begin = `<!-- BEGIN GENERATED: ${region} -->`;
  const end = `<!-- END GENERATED: ${region} -->`;
  const startIdx = text.indexOf(begin);
  const endIdx = text.indexOf(end);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error(`Missing ${region} markers in ${path.relative(REPO_ROOT, PAGE)}`);
  }
  const next = text.slice(0, startIdx + begin.length) + '\n' + body + '\n      ' + text.slice(endIdx);
  return { text: next, changed: next !== text };
}

function main(): void {
  const check = process.argv.includes('--check');
  const current = fs.readFileSync(PAGE, 'utf8');
  const metrics = measure();
  const decisions = decisionStatus();

  const first = splice(current, render(metrics), METRICS_REGION);
  const second = splice(first.text, renderDecisions(decisions), DECISIONS_REGION);
  const text = second.text;
  const changed = first.changed || second.changed;

  if (check) {
    if (changed) {
      console.error('STALE docs/system-map.html — the committed counts do not match the repository.\n');
      for (const m of metrics) console.error(`  ${String(m.value).padStart(4)}  ${m.label}`);
      console.error('\nRun: npm run build:system-map  (then commit the result)');
      process.exit(1);
    }
    console.log(
      `OK    docs/system-map.html — ${metrics.length} measured counts and ` +
        `${decisions.length} decision tiers match.`,
    );
    return;
  }

  fs.writeFileSync(PAGE, text);
  console.log(`${changed ? 'WROTE' : 'OK   '} docs/system-map.html`);
  for (const m of metrics) console.log(`  ${String(m.value).padStart(4)}  ${m.label}`);
  for (const d of decisions) console.log(`  ${String(d.count).padStart(4)}  ${d.tier} — ${d.note}`);
}

main();
