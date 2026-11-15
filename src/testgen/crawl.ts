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
  /** A text field's input type (`text`, `search`, `email`, `number`, …): filled, not clicked. */
  input?: string;
  /** A dropdown's option values: each chosen in turn, not clicked. */
  options?: string[];
}

export interface CrawlState {
  /** The route shown. */
  path: string;
  /** Visible text, as the signature reads it. */
  text: string;
  controls: Control[];
  /** Form values, `role:name=value`: a fill that shows nothing yet is still a new state. */
  values?: string[];
}

/** A value no page shows: the empty, no-results state. */
const NO_MATCH = 'zzzz-no-match';
/** At most this many options of one dropdown are tried. */
const MAX_OPTIONS = 5;

/**
 * What a text field is filled with. A typed field gets a value of its type; a free-text one gets
 * a word the page shows (likely to match something) and one it does not (the empty state).
 */
export function sampleInputs(c: Control, pageText: string): string[] {
  switch (c.input) {
    case 'email':
      return ['test@example.com'];
    case 'url':
      return ['https://example.com'];
    case 'tel':
      return ['555-0100'];
    case 'number':
    case 'range':
      return ['1'];
    case 'date':
      return ['2026-01-01'];
    case 'password':
      return ['Password-1'];
    default: {
      // The median word, not the first: a page's opening words are its chrome (title,
      // tabs, headings); its middle is its data, where a search finds something.
      const words = pageText.split(/\s+/).filter((w) => /^[A-Za-z][A-Za-z-]{3,}$/.test(w));
      const seen = words[Math.floor(words.length / 2)];
      return seen ? [seen, NO_MATCH] : [NO_MATCH];
    }
  }
}

/** Every step one control offers in a state: one click, a fill per sample value, a select per other option. */
function actionsOf(c: Control, state: CrawlState): JourneyStep[] {
  const selector = selectorFor(c);
  if (c.options) {
    const current = state.values?.find((v) => v.startsWith(`${c.role}:${c.name}=`))?.split('=').slice(1).join('=');
    return c.options.filter((o) => o !== current).slice(0, MAX_OPTIONS).map((value) => ({ select: { selector, value } }));
  }
  if (c.input !== undefined) return sampleInputs(c, state.text).map((value) => ({ fill: { selector, value } }));
  return [{ click: selector }];
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

const signatureOf = (s: CrawlState) =>
  stateSignature({ path: s.path, text: s.text, controls: [...s.controls.map((c) => `${c.role}:${c.name}:${c.index}`), ...(s.values ?? []).map((v) => `value ${v}`)] });

export async function crawl(driver: CrawlDriver, opts: CrawlOptions): Promise<CrawlResult> {
  const startSteps: JourneyStep[] = [{ goto: opts.start }];
  const initial = await driver.open(startSteps);
  const seen = new Set([signatureOf(initial)]);
  const queue: Array<{ steps: JourneyStep[]; state: CrawlState }> = [{ steps: startSteps, state: initial }];
  const journeys: Journey[] = [{ name: 'crawl-000', steps: startSteps }];
  let interactions = 0;
  let truncated = false;
  // A form action (a value into a field, an option of a dropdown) is performed once, from the first
  // state offering it: every value is exercised, and filling A then B then A again is not a new test.
  const tried = new Set<string>();

  while (queue.length > 0) {
    const { steps, state } = queue.shift() as { steps: JourneyStep[]; state: CrawlState };
    for (const control of state.controls) {
      if (opts.exclude?.test(control.name)) continue;
      for (const action of actionsOf(control, state)) {
        if (!('click' in action)) {
          const key = JSON.stringify(action);
          if (tried.has(key)) continue;
          tried.add(key);
        }
        if (interactions >= opts.maxInteractions) {
          truncated = true;
          break;
        }
        interactions += 1;
        const next: JourneyStep[] = [...steps, action];
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
    if (truncated) break;
  }
  return { journeys, states: seen.size, interactions, truncated };
}

/** The journey file, with a header saying where it came from and that it is yours to edit. */
export function journeysYaml(result: CrawlResult, url: string): string {
  const header = [
    `# Crawled from ${url} by seans-mfe-tool test:crawl (ADR-129 §9): ${result.states} state(s), ${result.interactions} interaction(s)${result.truncated ? ' — stopped at the interaction budget' : ''}.`,
    '# One journey per interaction, each replayable from the start. Edit freely: change what is filled,',
    '# remove what is not worth testing, rename journeys. test:generate records these and writes the tests.',
  ];
  return `${header.join('\n')}\n${yaml.dump({ journeys: result.journeys }, { lineWidth: -1, quotingType: "'", noRefs: true })}`;
}
