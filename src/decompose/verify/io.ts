/**
 * Files in and out of `decompose:verify` (ADR-113): a bundle read as the
 * comparison sees it, and the parity report written for people.
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { ValidationError } from '@seans-mfe/contracts';
import type { BundleView, ParityReport, StepView } from './parity';

export interface LoadedBundle extends BundleView {
  app: string;
  dir: string;
}

export async function readBundleView(dir: string): Promise<LoadedBundle> {
  const metaFile = path.join(dir, 'bundle.json');
  if (!(await fs.pathExists(metaFile))) throw new ValidationError(`${dir} is not an evidence bundle (no bundle.json)`, 'bundle', 'bundle.json');
  const meta = (await fs.readJson(metaFile)) as { app?: string; journeys?: string[] };
  const journeys: BundleView['journeys'] = [];
  for (const name of meta.journeys ?? []) {
    const file = path.join(dir, 'journeys', `${name}.json`);
    if (!(await fs.pathExists(file))) continue;
    const j = (await fs.readJson(file)) as { name: string; steps: StepView[] };
    journeys.push({ name: j.name, steps: j.steps });
  }
  const requests: BundleView['requests'] = {};
  const listFile = path.join(dir, 'requests.json');
  if (await fs.pathExists(listFile)) {
    for (const r of (await fs.readJson(listFile)) as Array<{ id: string; method: string; url: string }>) requests[r.id] = { method: r.method, url: r.url };
  }
  return { app: meta.app ?? '', dir, journeys, requests };
}

/** Reads each side's step screenshots from its bundle directory. */
export function screenshotReader(baselineDir: string, candidateDir: string): (side: 'baseline' | 'candidate', step: StepView) => Buffer | undefined {
  return (side, step) => {
    const file = path.join(side === 'baseline' ? baselineDir : candidateDir, step.screenshot);
    return fs.existsSync(file) ? fs.readFileSync(file) : undefined;
  };
}

export function renderParityMarkdown(report: ParityReport, gaps: { routes: string[] }): string {
  const s = report.summary;
  const lines = [
    `# Parity: ${report.parity ? '✓ at parity' : '✗ not at parity'}`,
    '',
    'The candidate was driven through the baseline’s journeys on the baseline’s recorded data (ADR-113).',
    '',
    '| Steps | at parity | Regions | at parity | New console errors | Visual failures |',
    '|---|---|---|---|---|---|',
    `| ${s.steps} | ${s.stepsAtParity} | ${s.regions} | ${s.regionsAtParity} | ${s.newConsoleErrors} | ${s.visualFailures} |`,
    '',
  ];
  const failing = report.journeys.flatMap((j) => j.steps.filter((st) => !st.ok));
  if (failing.length > 0) {
    lines.push('## Differences', '');
    for (const st of failing) {
      lines.push(`### ${st.id}`, '');
      if (st.missing) lines.push('- the candidate never ran this step');
      if (st.path) lines.push(`- path: \`${st.path.baseline}\` → \`${st.path.candidate}\``);
      for (const r of st.content.missing) lines.push(`- missing region: ${r}`);
      for (const c of st.content.changed) lines.push(`- text changed in ${c.region}: “${c.baseline}” → “${c.candidate}”`);
      for (const m of st.content.moved) lines.push(`- ${m.region} moved from ${m.baseline} to ${m.candidate}`);
      for (const a of st.content.added) lines.push(`- new text: ${a}`);
      for (const n of st.network.missing) lines.push(`- call not made: ${n}`);
      for (const n of st.network.extra) lines.push(`- extra call: ${n}`);
      for (const e of st.console.new) lines.push(`- new console error: ${e}`);
      if (st.visual.failed.length > 0) lines.push(`- pixels changed: ${st.visual.failed.join(', ')}`);
      lines.push('');
    }
  }
  lines.push('## Coverage gaps', '', 'Parity covers only what the journeys exercised (ADR-113, Boundaries).', '');
  if (gaps.routes.length === 0) lines.push('Every route was visited.');
  for (const r of gaps.routes) lines.push(`- route \`${r}\` — no journey visits it`);
  return `${lines.join('\n')}\n`;
}
