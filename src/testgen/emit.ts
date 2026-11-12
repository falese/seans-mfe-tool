/**
 * The generated tests' source (ADR-129 §3–§5). Each function returns the text
 * of one file; the data each test reads is written beside it as JSON, so a
 * re-capture changes data files, not test code.
 *
 * Every file says it was generated, from what, and that it is the MFE's own
 * once written.
 */

import { BODY_HASH_SOURCE, GENERATED_MARK, JSDOM_NOISE } from './harness';

const noise = `[${JSDOM_NOISE.map((r) => r.toString()).join(', ')}]`;

/** Jest, per capability: rendered alone in jsdom, the network answered from the capture (§3). */
export function aloneTestSource(capability: string, app: string): string {
  return `/**
 * ${capability} — characterization, alone. ${GENERATED_MARK}.
 *
 * At each state ${app} was captured in, this capability is rendered on its own —
 * no host, no shell, no backend — with the network answered from the capture.
 * It must show what the captured app showed there, make the calls behind it,
 * and log no console error the captured app did not.
 *
 * The cases are data: ./__characterization__/${capability}.json. Re-run
 * test:generate after a new capture to refresh them. This file is yours once
 * written; test:generate leaves it alone after you change it.
 */
import React from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { ${capability} } from './${capability}';
import { installRecordedNetwork, missingText, type RecordedNetwork, type RecordedResponse } from '../../__smt__/recorded-network';
import { readFileSync } from 'fs';
import { join } from 'path';

// Read, not imported: an MFE's tsconfig need not allow JSON modules (an Angular spec config does not).
const json = <T,>(file: string): T => JSON.parse(readFileSync(join(__dirname, file), 'utf8')) as T;
const recorded = json<Record<string, unknown>>('../../__smt__/recorded.json');
const evidence = json<{ app: string; clock: string; cases: Array<{ step: string; path: string; regions: Array<{ region: string; text: string }>; calls: string[]; consoleErrors: string[] }> }>('./__characterization__/${capability}.json');

/** What jsdom logs and a browser never would. */
const JSDOM_NOISE = ${noise};
const TIMERS = ['hrtime', 'nextTick', 'performance', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] as const;

describe('${capability} — as captured', () => {
  let net: RecordedNetwork;
  let errors: string[];
  let spy: jest.SpyInstance;

  beforeEach(() => {
    // The capture's frozen clock; every other timer runs for real.
    jest.useFakeTimers({ now: new Date(evidence.clock), doNotFake: [...TIMERS] });
    net = installRecordedNetwork(recorded as unknown as Record<string, RecordedResponse>, { appOrigin: new URL(evidence.app).origin });
    errors = [];
    spy = jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      const text = args.map(String).join(' ');
      if (!JSDOM_NOISE.some((n) => n.test(text))) errors.push(text);
    });
  });

  afterEach(() => {
    cleanup();
    spy.mockRestore();
    net.restore();
    jest.useRealTimers();
  });

  // waitFor's budget sits inside the test's, so a failure says what was missing rather than timing out.
  it.each(evidence.cases)('$step at $path', async (c) => {
    window.history.pushState({}, '', c.path);
    const { container } = render(<${capability} />);
    await waitFor(
      () => {
        const page = container.textContent ?? '';
        const missing = c.regions.flatMap((r) => {
          const m = missingText(page, r.text);
          return m === null ? [] : [\`\${r.region}: "\${m}"\`];
        });
        expect(missing).toEqual([]);
      },
      { timeout: 10_000 }
    );
    expect(c.calls.filter((call) => !net.calls.includes(call))).toEqual([]);
    expect(net.unexpected).toEqual([]);
    expect(errors.filter((e) => !c.consoleErrors.some((known) => e.includes(known)))).toEqual([]);
  }, 20_000);
});
`;
}

/** Playwright: every captured journey against a target URL, text, calls, console and pixels (§4). */
export function journeySpecSource(mfe: string, app: string): string {
  return `/**
 * ${mfe} — journeys, as captured. ${GENERATED_MARK}.
 *
 * Replays every journey ${app} was captured running, against SMT_TARGET_URL
 * (default: the captured app), on the captured clock and recorded responses.
 * After each step, each of ${mfe}'s capabilities on screen must show the text it
 * showed then, the calls behind it must have been made, the page must log no
 * new console error, and its pixels must match the baseline cut from the
 * capture's screenshot (other placements inside it masked).
 *
 * Point it at the monolith first — it must pass there (ADR-113 §3) — then at
 * the composed shell. Composed, text is scoped to [data-smt-capability] (#408)
 * and a GraphQL request counts as the backend calls it stands for.
 *
 *   SMT_TARGET_URL=http://localhost:5199 npx playwright test -c playwright.characterization.config.ts
 *
 * Data: ./characterization/evidence.json. Baselines: ./characterization/baselines/.
 * Yours once written; test:generate leaves a changed file alone.
 */
import { expect, test, type Page } from '@playwright/test';
import evidence from './characterization/evidence.json';

type Action = { goto: string } | { click: string } | { fill: { selector: string; value: string } } | { press: { selector: string; key: string } } | { select: { selector: string; value: string } } | { wait: number };
interface Rect { x: number; y: number; width: number; height: number }

const TARGET = new URL(process.env.SMT_TARGET_URL ?? evidence.app);
const MASK = '${'#ff00ff'}';

function relative(url: string): string {
  const u = new URL(url);
  return u.origin === TARGET.origin ? u.pathname + u.search : u.toString();
}

/** As decompose:capture keys a response by its request body: one GraphQL endpoint, many documents. */
${BODY_HASH_SOURCE}

/** \`METHOD path\`, without the query: a BFF field stands for an endpoint, not one URL. */
const endpoint = (call: string): string => call.split('?')[0];

/** The root fields of a GraphQL document, aliases resolved. */
function rootFields(document: string): string[] {
  const body = document.replace(/#[^\\n]*/g, '');
  const fields: string[] = [];
  let depth = -1;
  let parens = 0;
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (ch === '(') parens += 1;
    else if (ch === ')') parens -= 1;
    else if (parens === 0 && ch === '{') depth += 1;
    else if (parens === 0 && ch === '}') depth -= 1;
    else if (depth === 0 && parens === 0 && /[_A-Za-z]/.test(ch)) {
      const m = /^([_A-Za-z]\\w*)(\\s*:\\s*([_A-Za-z]\\w*))?/.exec(body.slice(i));
      if (m) {
        fields.push(m[3] ?? m[1]);
        i += m[0].length - 1;
      }
    }
  }
  return fields;
}

function missingText(pageText: string, expected: string): string | null {
  const page = pageText.replace(/\\s+/g, '');
  let at = 0;
  for (const chunk of expected.split(/\\s+/).filter(Boolean)) {
    const i = page.indexOf(chunk, at);
    if (i < 0) return chunk;
    at = i + chunk.length;
  }
  return null;
}

/**
 * A console message as compared with the baseline's: source locations masked, since a rebuild
 * renames the bundle (\`main.c8107cfa.js:42548:75\`) without changing what was logged.
 */
function consoleKey(text: string): string {
  return text.replace(/https?:\\/\\/[^\\s)]+/g, '<src>').replace(/\\s+/g, ' ').trim();
}

async function act(page: Page, a: Action): Promise<void> {
  if ('goto' in a) await page.goto(new URL(a.goto, TARGET).toString());
  else if ('click' in a) await page.click(a.click);
  else if ('fill' in a) await page.fill(a.fill.selector, a.fill.value);
  else if ('press' in a) await page.press(a.press.selector, a.press.key);
  else if ('select' in a) await page.selectOption(a.select.selector, a.select.value);
  else await page.waitForTimeout(a.wait);
}

async function mask(page: Page, rects: Rect[]): Promise<void> {
  await page.evaluate(
    ({ rects, color }) => {
      for (const r of rects) {
        const d = document.createElement('div');
        d.setAttribute('data-smt-mask', '');
        d.style.cssText = \`position:fixed;left:\${r.x}px;top:\${r.y}px;width:\${r.width}px;height:\${r.height}px;background:\${color};z-index:2147483647;pointer-events:none\`;
        document.documentElement.appendChild(d);
      }
    },
    { rects, color: MASK }
  );
}

const unmask = (page: Page) => page.evaluate(() => document.querySelectorAll('[data-smt-mask]').forEach((e) => e.remove()));

for (const journey of evidence.journeys) {
  test(journey.name, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(String(e)));
    const made: string[] = [];
    await page.clock.setFixedTime(new Date(evidence.clock));
    await page.route('**/*', async (route) => {
      const req = route.request();
      if (!['xhr', 'fetch'].includes(req.resourceType())) return route.continue();
      const key = \`\${req.method()} \${relative(req.url())}\`;
      const bff = req.method() === 'POST' && /\\/graphql\\/?(\\?|$)/.test(req.url()) ? rootFields(String((req.postDataJSON() as { query?: string } | null)?.query ?? '')) : [];
      // A GraphQL request is itself, and the backend calls its fields stand for (ADR-127 §4).
      made.push(key, ...bff.flatMap((f) => (evidence.bff as unknown as Record<string, string>)[f] ?? []));
      const responses = evidence.responses as unknown as Record<string, { status: number; mimeType: string; body: unknown }>;
      const body = req.postData() ?? '';
      const hit = (body ? responses[\`\${key} #\${bodyHash(body)}\`] : undefined) ?? responses[key];
      if (!hit) return route.continue();
      return route.fulfill({ status: hit.status, contentType: hit.mimeType, body: typeof hit.body === 'string' ? hit.body : JSON.stringify(hit.body) });
    });

    for (const step of journey.steps) {
      await test.step(\`\${step.id} \${step.path}\`, async () => {
        await act(page, step.action as Action);
        await page.waitForLoadState('networkidle');
        for (const cap of step.capabilities) {
          const stamped = page.locator(\`[data-smt-capability="\${cap.capability}"]\`);
          const scope = (await stamped.count()) > 0 ? stamped.first() : page.locator('body');
          await expect
            .poll(async () => {
              const text = (await scope.evaluate((e) => e.textContent)) ?? '';
              return cap.regions.flatMap((r) => {
                const m = missingText(text, r.text);
                return m === null ? [] : [\`\${r.region}: "\${m}"\`];
              });
            }, { message: \`\${cap.capability} shows what it showed in the capture\` })
            .toEqual([]);
          const calls = made.map(endpoint);
          expect(cap.calls.filter((c) => !calls.includes(endpoint(c))), \`\${cap.capability}'s calls\`).toEqual([]);
          if (cap.visual) {
            await mask(page, cap.visual.exclude);
            const shot = await page.screenshot({ clip: cap.visual.rect, animations: 'disabled', caret: 'hide' });
            await unmask(page);
            expect(shot).toMatchSnapshot(\`\${cap.visual.name}.png\`);
          }
        }
        const known = new Set(step.consoleErrors.map(consoleKey));
        const fresh = errors.splice(0).filter((e) => !known.has(consoleKey(e)));
        expect(fresh, 'new console errors').toEqual([]);
      });
    }
  });
}
`;
}

export function playwrightConfigSource(viewport: { width: number; height: number }): string {
  return `/**
 * Playwright config for the generated journey spec — ${GENERATED_MARK}.
 * The viewport and scale are the capture's: the baselines were cut at them.
 */
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: /characterization\\.spec\\.ts$/,
  snapshotPathTemplate: '{testDir}/characterization/baselines/{arg}{ext}',
  workers: 1,
  timeout: 120_000,
  expect: { toMatchSnapshot: { maxDiffPixels: Number(process.env.SMT_MAX_DIFF_PIXELS ?? 0) } },
  use: {
    viewport: { width: ${viewport.width}, height: ${viewport.height} },
    deviceScaleFactor: 1,
    ...(process.env.CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.CHROMIUM_PATH } } : {}),
  },
});
`;
}

/** Minimal OpenAPI-schema checker for the contract tests: the subset inferred and published specs use. */
export const SCHEMA_CHECK = `/**
 * OpenAPI response-schema check for contract tests — ${GENERATED_MARK}.
 * Covers what a BFF's specs use: type, nullable, enum, required, properties, items.
 */
export interface Schema {
  type?: string;
  nullable?: boolean;
  enum?: unknown[];
  required?: string[];
  properties?: Record<string, Schema>;
  items?: Schema;
  'x-smt-mixed'?: boolean;
}

export function schemaErrors(schema: Schema | undefined, value: unknown, at = '$'): string[] {
  if (!schema || schema['x-smt-mixed']) return [];
  if (value === null) return schema.nullable || !schema.type ? [] : [\`\${at}: null, but the spec says \${schema.type}\`];
  if (schema.enum && !schema.enum.includes(value)) return [\`\${at}: \${JSON.stringify(value)} is not one of \${JSON.stringify(schema.enum)}\`];
  const actual = Array.isArray(value) ? 'array' : typeof value;
  switch (schema.type) {
    case undefined:
      return [];
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value) ? [] : [\`\${at}: \${actual}, but the spec says integer\`];
    case 'number':
    case 'string':
    case 'boolean':
      return actual === schema.type ? [] : [\`\${at}: \${actual}, but the spec says \${schema.type}\`];
    case 'array':
      if (!Array.isArray(value)) return [\`\${at}: \${actual}, but the spec says array\`];
      return value.flatMap((v, i) => schemaErrors(schema.items, v, \`\${at}[\${i}]\`));
    case 'object': {
      if (actual !== 'object') return [\`\${at}: \${actual}, but the spec says object\`];
      const obj = value as Record<string, unknown>;
      const missing = (schema.required ?? []).filter((k) => !(k in obj)).map((k) => \`\${at}.\${k}: required, absent\`);
      return [...missing, ...Object.entries(schema.properties ?? {}).flatMap(([k, s]) => (k in obj ? schemaErrors(s, obj[k], \`\${at}.\${k}\`) : []))];
    }
    default:
      return [];
  }
}
`;

/** Jest, node: the recorded traffic against the specs the BFF is generated from, and the demo fixtures against both (§5). */
export function contractTestSource(mfe: string): string {
  return `/**
 * @jest-environment node
 *
 * ${mfe}'s BFF — provider contract. ${GENERATED_MARK}.
 *
 * Each upstream response recorded must be what the BFF's OpenAPI spec
 * (specs/*.yaml) says that operation returns, and where demo mode has a fixture
 * for the operation (mocks.json, ADR-052) it must be exactly that response. The connector half —
 * the built Mesh answering its GraphQL from these recordings — is
 * ../contract/connector.contract.ts, run by \`npm run test:contract\`.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

// Read, not imported: an MFE's tsconfig need not allow JSON modules.
const json = (file: string): unknown => JSON.parse(readFileSync(join(__dirname, file), 'utf8'));
const fixtures = json('../contract/recorded.json') as { operations: unknown[] };
const mocks = json('../mocks.json');
import { schemaErrors, type Schema } from '../contract/schema-check';

interface Recorded { call: string; field: string; hoist?: { prop: string; field: string }; schema: Schema; status: number; body: unknown }

describe('${mfe} BFF — what the backends sent is what the specs say', () => {
  it.each(fixtures.operations as unknown as Recorded[])('$call', (op) => {
    expect(op.status).toBeLessThan(300);
    expect(schemaErrors(op.schema, op.body)).toEqual([]);
  });
});

describe('${mfe} BFF — demo mode serves what the backends sent', () => {
  const served = mocks as unknown as Record<string, unknown>;
  const fixtureOf = (op: Recorded) => served[op.hoist ? op.hoist.field : op.field];
  const withFixture = (fixtures.operations as unknown as Recorded[]).filter((op) => fixtureOf(op) !== undefined);
  if (withFixture.length === 0) {
    it('has no demo fixtures for these operations, so nothing to hold to them', () => expect(withFixture).toEqual([]));
    return;
  }
  it.each(withFixture)('$field', (op) => {
    expect(fixtureOf(op)).toEqual(op.hoist ? (op.body as Record<string, unknown>)[op.hoist.prop] : op.body);
  });
});
`;
}

/** Jest, node, after \`mesh build\`: the connector itself, upstream answered from the recordings (§5). */
/**
 * The connector test over one data file: the capture's recordings (`recorded.json`, test:generate),
 * or answers synthesised from the specs (`spec.json`, remote:generate — ADR-129 §11). The spec
 * variant also fails each upstream once and expects a GraphQL error, not data.
 */
export function connectorTestSource(mfe: string, source: { data: string; from: string; mark: string; failures: boolean } = { data: './recorded.json', from: "the capture's recordings", mark: GENERATED_MARK, failures: false }): string {
  return `/**
 * @jest-environment node
 *
 * ${mfe}'s BFF — connector contract. ${source.mark}.
 *
 * Runs the built Mesh in-process with its upstream fetch answered from
 * ${source.from}, and asks each operation for every field the spec
 * declares, under the REST names (the document is the one decompose:verify
 * reads traffic by). The answer, as it goes over the wire, must be the recorded
 * response as far as the spec declares it (\`expected\`): the connector may rename
 * and unwrap, but not drop, add or change a declared value. What the backend
 * sends beyond its spec is not exposed, and TESTS.md lists it. A date-time is compared as the instant it names: Mesh's DateTime
 * scalar re-serialises \`…T18:40:00Z\` as \`…T18:40:00.000Z\`.
 *
 * Needs .mesh/ — run through \`npm run test:contract\`, which builds it first.
 */
import { getMesh } from '@graphql-mesh/runtime';
import { getMeshOptions } from '../../../../.mesh';
import { readFileSync } from 'fs';
import { join } from 'path';

// Read, not imported: an MFE's tsconfig need not allow JSON modules (an Angular spec config does not).
const fixtures = JSON.parse(readFileSync(join(__dirname, '${source.data}'), 'utf8')) as { operations: unknown[] };

interface Recorded { call: string; url: string; upstream: string; field: string; document: string; variables: Record<string, unknown>; hoist?: { prop: string; field: string }; body: unknown; expected: unknown }

const ops = fixtures.operations as unknown as Recorded[];
let execute: (document: string, variables: Record<string, unknown>) => Promise<{ data?: Record<string, unknown> | null; errors?: unknown[] }>;
/** The upstream path answered 500 instead, while set. */
let failing: string | null = null;

const ISO = /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}(:\\d{2}(\\.\\d+)?)?(Z|[+-]\\d{2}:?\\d{2})$/;
/** JSON as sent, with each date-time as its instant. */
const wire = (v: unknown): unknown =>
  JSON.parse(JSON.stringify(v), (_k, x: unknown) => (typeof x === 'string' && ISO.test(x) ? \`instant:\${new Date(x).toISOString()}\` : x));

beforeAll(async () => {
  const options = await getMeshOptions();
  options.fetchFn = (async (input: unknown) => {
    const u = new URL(typeof input === 'string' ? input : String((input as { url?: string }).url ?? input));
    // Matched by the spec path the request ends with (the spec's server is wherever it is) and
    // every parameter the recording was made with; Mesh adds the spec's defaults (\`limit=50\`).
    // Of several, the recording with the most parameters in common.
    const hit = ops
      .map((o) => ({ o, r: new URL(o.upstream, u.origin) }))
      .filter(({ r }) => u.pathname.endsWith(r.pathname) && [...r.searchParams].every(([k, v]) => u.searchParams.get(k) === v))
      .sort((a, b) => [...b.r.searchParams].length - [...a.r.searchParams].length)[0]?.o;
    if (hit && failing === hit.upstream) {
      return new Response(JSON.stringify({ error: 'upstream failure' }), { status: 500, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify(hit ? hit.body : { error: \`no recording for \${u.pathname}\${u.search}\` }), {
      status: hit ? 200 : 404,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof options.fetchFn;
  const mesh = await getMesh(options);
  // The BFF's context plugin reads the request as Yoga hands it over; live, so the mock switch steps aside (ADR-052).
  execute = (document, variables) =>
    mesh.execute(document, variables, { request: new Request('http://bff.test/graphql', { headers: { 'x-bff-mode': 'live' } }) }) as Promise<{ data?: Record<string, unknown> | null; errors?: unknown[] }>;
});

describe('${mfe} BFF — the connector returns what the backends sent', () => {
  it.each(ops)('$call', async (op) => {
    const result = await execute(op.document, op.variables);
    expect(result.errors ?? []).toEqual([]);
    const data = result.data ?? {};
    const answer = op.hoist ? { ...((data.r as Record<string, unknown> | undefined) ?? {}), [op.hoist.prop]: data.h } : data.r;
    expect(wire(answer)).toEqual(wire(op.expected));
  });
});
${source.failures ? FAILURES : ''}`;
}

/** The spec variant's second half: an upstream failure is an error the client sees, not data. */
const FAILURES = `
describe('the connector reports an upstream failure as an error, not as data', () => {
  afterEach(() => {
    failing = null;
  });
  it.each(ops)('$call', async (op) => {
    failing = op.upstream;
    const result = await execute(op.document, op.variables);
    expect((result.errors ?? []).length).toBeGreaterThan(0);
  });
});
`;
