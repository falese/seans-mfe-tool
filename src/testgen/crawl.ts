/**
 * The crawler: from a running MFE to a journey file (ADR-129 §9).
 *
 * The journey file is the source of the UI tests. A person writes it in the
 * journey DSL (`decompose/journeys.ts`), or the crawler writes it: starting at
 * the MFE's page, it finds every interactive control by role and accessible
 * name, performs each one in each state it is offered in, and walks every new
 * state it reaches, breadth first. Each interaction becomes one journey that
 * replays on its own from the start URL. `test:generate` then records the
 * journeys and generates the tests from what it saw.
 *
 * This file is the walk, pure over a driver; the browser half is `crawl-page.ts`.
 */

import { createHash } from 'crypto';
import * as yaml from 'js-yaml';
import type { Journey, JourneyStep } from '../decompose/journeys';

/** One interactive control as the page offers it. */
export interface Control {
  /** ARIA role, explicit or implied by the element. */
  role: string;
  /** Accessible name, whitespace-collapsed. */
  name: string;
  /** Its position among controls with the same role and name, and how many there are. */
  index: number;
  of: number;
}

export interface CrawlState {
  /** The route shown. */
  path: string;
  /** Visible text, as the signature reads it. */
  text: string;
  controls: Control[];
}

export interface CrawlDriver {
  /** A fresh page at the start, the steps performed in order, settled: what it shows. */
  open(steps: JourneyStep[]): Promise<CrawlState>;
}

export interface CrawlOptions {
  /** Where every journey starts, app-relative. */
  start: string;
  /** At most this many interactions, so a large app ends. */
  maxInteractions: number;
  /** Controls whose accessible name matches are never performed (log out, delete). */
  exclude?: RegExp;
}

export interface CrawlResult {
  journeys: Journey[];
  /** Distinct states reached. */
  states: number;
  /** Interactions performed. */
  interactions: number;
  /** True when the budget ended the walk before every control in every state was tried. */
  truncated: boolean;
}

const quote = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/** A Playwright selector for one control: exact role and name, then position among equals. */
export function selectorFor(c: Control): string {
  const base = `role=${c.role}[name=${quote(c.name)}s]`;
  return c.of > 1 ? `${base} >> nth=${c.index}` : base;
}

/** Same route, same visible text, same controls: the same state. */
export function stateSignature(s: { path: string; text: string; controls: string[] }): string {
  const text = s.text.replace(/\s+/g, ' ').trim();
  return createHash('sha256').update(`${s.path}\n${text}\n${[...s.controls].sort().join('\n')}`).digest('hex').slice(0, 16);
}

const signatureOf = (s: CrawlState) => stateSignature({ path: s.path, text: s.text, controls: s.controls.map((c) => `${c.role}:${c.name}:${c.index}`) });

export async function crawl(driver: CrawlDriver, opts: CrawlOptions): Promise<CrawlResult> {
  const startSteps: JourneyStep[] = [{ goto: opts.start }];
  const initial = await driver.open(startSteps);
  const seen = new Set([signatureOf(initial)]);
  const queue: Array<{ steps: JourneyStep[]; state: CrawlState }> = [{ steps: startSteps, state: initial }];
  const journeys: Journey[] = [{ name: 'crawl-000', steps: startSteps }];
  let interactions = 0;
  let truncated = false;

  while (queue.length > 0) {
    const { steps, state } = queue.shift() as { steps: JourneyStep[]; state: CrawlState };
    for (const control of state.controls) {
      if (opts.exclude?.test(control.name)) continue;
      if (interactions >= opts.maxInteractions) {
        truncated = true;
        break;
      }
      interactions += 1;
      const next: JourneyStep[] = [...steps, { click: selectorFor(control) }];
      journeys.push({ name: `crawl-${String(interactions).padStart(3, '0')}`, steps: next });
      const reached = await driver.open(next);
      const sig = signatureOf(reached);
      if (!seen.has(sig)) {
        seen.add(sig);
        queue.push({ steps: next, state: reached });
      }
    }
    if (truncated) break;
  }
  return { journeys, states: seen.size, interactions, truncated };
}

/** The journey file, with a header saying where it came from and that it is yours to edit. */
export function journeysYaml(result: CrawlResult, url: string): string {
  const header = [
    `# Crawled from ${url} by seans-mfe-tool test:crawl (ADR-129 §9): ${result.states} state(s), ${result.interactions} interaction(s)${result.truncated ? ' — stopped at the interaction budget' : ''}.`,
    '# One journey per interaction, each replayable from the start. Edit freely: add fill/press steps,',
    '# remove what is not worth testing, rename journeys. test:generate records these and writes the tests.',
  ];
  return `${header.join('\n')}\n${yaml.dump({ journeys: result.journeys }, { lineWidth: -1, quotingType: "'", noRefs: true })}`;
}
