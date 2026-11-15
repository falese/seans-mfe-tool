/**
 * The crawler's browser half (ADR-129 §9): a `CrawlDriver` over Playwright.
 *
 * `FIND_CONTROLS` runs in the page. It lists what a person can operate — buttons,
 * links on the app's own origin, tabs, menu items, checkboxes, radios,
 * switches, disclosure summaries — with the role and accessible name a
 * Playwright role selector addresses them by. The driver then keeps only the
 * selectors that resolve to exactly one element on the live page, so the
 * journey file never names a control the runner cannot find.
 */

import type { JourneyStep } from '../decompose/journeys';
import { performStep } from '../decompose/capture';
import { launchBrowser, type ChromiumLike } from '../design/dom-capture';
import { selectorFor, type Control, type CrawlDriver, type CrawlState } from './crawl';

interface RawControl {
  role: string;
  name: string;
  input?: string;
  options?: string[];
}

/**
 * In the page: every operable control, by role and accessible name, in
 * document order, with the route and visible text. Plain JavaScript, evaluated
 * in the page as is: the CLI compiles without DOM types, and this needs no
 * import. `__tests__/crawl-page.test.ts` runs it in jsdom.
 */
export const FIND_CONTROLS = `(() => {
  const ROLES = ['button', 'link', 'tab', 'menuitem', 'checkbox', 'radio', 'switch', 'option', 'textbox', 'searchbox', 'spinbutton', 'combobox'];
  const FIELD_TYPES = { text: 'textbox', search: 'searchbox', email: 'textbox', tel: 'textbox', url: 'textbox', password: 'textbox', number: 'spinbutton', date: 'textbox' };
  const collapse = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const roleOf = (el) => {
    const explicit = el.getAttribute('role');
    if (explicit) return ROLES.includes(explicit) ? explicit : null;
    const tag = el.tagName.toLowerCase();
    if (tag === 'button' || tag === 'summary') return 'button';
    if (tag === 'a' && el.hasAttribute('href')) {
      const href = el.href;
      return href.startsWith(location.origin) && !href.startsWith('javascript:') ? 'link' : null;
    }
    if (tag === 'textarea') return 'textbox';
    if (tag === 'select') return el.multiple || el.size > 1 ? null : 'combobox';
    if (tag === 'input') {
      const type = (el.getAttribute('type') || 'text').toLowerCase();
      if (type === 'checkbox' || type === 'radio') return type;
      if (type === 'button' || type === 'submit' || type === 'reset') return 'button';
      return FIELD_TYPES[type] || null;
    }
    return null;
  };
  const isField = (el) => el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'submit', 'reset'].includes((el.getAttribute('type') || 'text').toLowerCase()));
  const labelText = (el) => {
    const labels = el.labels ? Array.from(el.labels) : [];
    return collapse(labels.map((l) => {
      const copy = l.cloneNode(true);
      copy.querySelectorAll('select, input, textarea').forEach((x) => x.remove());
      return copy.textContent;
    }).join(' '));
  };
  const nameOf = (el) => {
    const label = el.getAttribute('aria-label');
    if (label) return collapse(label);
    const by = el.getAttribute('aria-labelledby');
    if (by) {
      const text = collapse(by.split(/\\s+/).map((id) => (document.getElementById(id) || {}).textContent || '').join(' '));
      if (text) return text;
    }
    if (isField(el) || el.tagName === 'SELECT') return labelText(el) || collapse(el.getAttribute('placeholder') || el.getAttribute('title') || '');
    return collapse(el.textContent) || collapse(el.getAttribute('title') || el.value || '');
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const sized = r.width > 0 && r.height > 0;
    if (!sized && typeof navigator !== 'undefined' && !/jsdom/i.test(navigator.userAgent)) return false;
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') return false;
    for (let e = el; e; e = e.parentElement) {
      if (e.getAttribute('aria-hidden') === 'true' || e.hasAttribute('hidden')) return false;
      const s = getComputedStyle(e);
      if (s.visibility === 'hidden' || s.display === 'none') return false;
    }
    return true;
  };
  const controls = [];
  const values = [];
  for (const el of Array.from(document.querySelectorAll('button, a[href], summary, input, textarea, select, [role]'))) {
    const role = roleOf(el);
    if (!role || !visible(el)) continue;
    const name = nameOf(el);
    if (!name) continue;
    const control = { role, name };
    if (el.tagName === 'SELECT') control.options = Array.from(el.options).map((o) => o.value);
    else if (isField(el)) control.input = el.tagName === 'TEXTAREA' ? 'textarea' : (el.getAttribute('type') || 'text').toLowerCase();
    controls.push(control);
    if (control.options || control.input !== undefined) values.push(role + ':' + name + '=' + el.value);
    else if (role === 'checkbox' || role === 'radio' || role === 'switch') values.push(role + ':' + name + '=' + String(!!el.checked));
  }
  const route = location.hash.startsWith('#/') ? location.hash.slice(1) : location.pathname + location.search;
  return { path: route, text: ((document.body && document.body.innerText) || (document.body && document.body.textContent) || '').slice(0, 20000), controls, values };
})()`;

/** Raw controls numbered among their equals (same role and name), as `selectorFor` addresses them. */
export function numberControls(raw: RawControl[]): Control[] {
  const totals = new Map<string, number>();
  for (const c of raw) totals.set(`${c.role}\0${c.name}`, (totals.get(`${c.role}\0${c.name}`) ?? 0) + 1);
  const seen = new Map<string, number>();
  return raw.map((c) => {
    const key = `${c.role}\0${c.name}`;
    const index = seen.get(key) ?? 0;
    seen.set(key, index + 1);
    return { ...c, index, of: totals.get(key) ?? 1 };
  });
}

interface CrawlPage {
  goto(url: string, opts?: { waitUntil?: string; timeout?: number }): Promise<unknown>;
  click(selector: string, opts?: { timeout?: number }): Promise<void>;
  fill(selector: string, value: string, opts?: { timeout?: number }): Promise<void>;
  press(selector: string, key: string, opts?: { timeout?: number }): Promise<void>;
  selectOption(selector: string, value: string, opts?: { timeout?: number }): Promise<unknown>;
  waitForTimeout(ms: number): Promise<void>;
  waitForLoadState(state: 'networkidle', opts?: { timeout?: number }): Promise<void>;
  evaluate<T>(fn: string): Promise<T>;
  locator(selector: string): { count(): Promise<number> };
  close(): Promise<void>;
}

interface CrawlBrowser {
  newContext(opts: { viewport: { width: number; height: number } }): Promise<{ newPage(): Promise<CrawlPage>; close(): Promise<void> }>;
  close(): Promise<void>;
}

export interface PageDriver extends CrawlDriver {
  close(): Promise<void>;
}

/** A driver opening a fresh page per journey prefix, settled on network quiet plus `settleMs`. */
export async function pageDriver(opts: { url: string; viewport: { width: number; height: number }; settleMs: number }, chromium?: ChromiumLike): Promise<PageDriver> {
  const pw = chromium ?? ((await import('playwright')).chromium as unknown as ChromiumLike);
  const browser = (await launchBrowser(pw)) as unknown as CrawlBrowser;
  const context = await browser.newContext({ viewport: opts.viewport });
  return {
    async open(steps: JourneyStep[]): Promise<CrawlState> {
      const page = await context.newPage();
      try {
        for (const step of steps) {
          await performStep(page, step, opts.url, { optional: false });
          await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
        }
        await page.waitForTimeout(opts.settleMs);
        const seen = await page.evaluate<{ path: string; text: string; controls: RawControl[]; values: string[] }>(FIND_CONTROLS);
        const controls: Control[] = [];
        for (const c of numberControls(seen.controls)) {
          // Only what the runner will find again, exactly once.
          if ((await page.locator(selectorFor(c)).count()) === 1) controls.push(c);
        }
        return { path: seen.path, text: seen.text, controls, values: seen.values };
      } finally {
        await page.close();
      }
    },
    async close() {
      await context.close();
      await browser.close();
    },
  };
}
