/**
 * Which region a request belongs to (ADR-109 §2).
 *
 * Two independent signals, recorded separately so a later stage can weigh them:
 *
 * - `initiator`: an app source file on the request's JavaScript call stack —
 *   async parents included — is the file of a region on screen. This is the
 *   component that asked for the data.
 * - `data`: a distinctive value from the response body appears in a region's
 *   own text. This is the component that shows the data, and it is the only
 *   signal that sees through a global store, where every request is initiated
 *   by the store and none by the component that renders the result.
 */

import { normalizeSourcePath, type Region } from './regions';

/** The `initiator.stack` shape of CDP `Network.requestWillBeSent`. */
export interface CdpStackTrace {
  callFrames: Array<{ url: string }>;
  parent?: CdpStackTrace;
}

/** App source files on a request's call stack, innermost first, each once. */
export function initiatorFiles(stack: CdpStackTrace | undefined, sourceRoot?: string): string[] {
  const files: string[] = [];
  for (let s = stack; s; s = s.parent) {
    for (const frame of s.callFrames) {
      const file = normalizeSourcePath(frame.url, sourceRoot);
      if (file && !files.includes(file)) files.push(file);
    }
  }
  return files;
}

const NOT_DISTINCTIVE = /^(true|false|null|undefined|yes|no|ok|none|n\/a)$/i;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}([T ][\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/;
/** `DOCKED`, `IN_TRANSIT`: an enum constant, even when only one row has it. */
const ENUM_CONSTANT = /^[A-Z][A-Z_]*$/;
const MAX_VALUES = 5000;

/**
 * Leaf strings in a response body that identify a record, worth looking for on
 * screen: at least four characters, not boolean-ish, not a timestamp, not an
 * upper-case constant, and from a field whose values are mostly distinct
 * across rows. A category field (a status, a berth class) has few distinct
 * values and identifies nothing; matching it would tie every status chip on
 * the page to every request. An identifier field stays useful even when a
 * value repeats (the same vessel docking twice). Numbers are left out because
 * the page formats them (`8500` is shown as `₢ 8,500.00`).
 */
export function distinctiveValues(body: unknown): string[] {
  const fields = new Map<string, string[]>();
  let total = 0;
  const visit = (v: unknown, field: string): void => {
    if (total >= MAX_VALUES) return;
    if (typeof v === 'string') {
      const s = v.trim();
      if (s.length >= 4 && s.length <= 200 && !NOT_DISTINCTIVE.test(s) && !TIMESTAMP.test(s) && !ENUM_CONSTANT.test(s)) {
        const list = fields.get(field) ?? [];
        list.push(s);
        fields.set(field, list);
        total += 1;
      }
    } else if (Array.isArray(v)) {
      v.forEach((item) => visit(item, `${field}[]`));
    } else if (v && typeof v === 'object') {
      for (const [k, item] of Object.entries(v)) visit(item, `${field}.${k}`);
    }
  };
  visit(body, '');
  const out = new Set<string>();
  for (const values of fields.values()) {
    const distinct = new Set(values);
    if (values.length === 1 || distinct.size / values.length > 0.5) distinct.forEach((v) => out.add(v));
  }
  return [...out];
}

export interface AttributableRequest {
  id: string;
  /** From {@link initiatorFiles}. */
  initiator: string[];
  /** From {@link distinctiveValues}. */
  values: string[];
}

export interface Attribution {
  request: string;
  region: string;
  via: 'initiator' | 'data';
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Attribute requests to regions. Output is sorted by request, region and
 * signal, so the same inputs always give the same list.
 */
export function attributeRequests(requests: AttributableRequest[], regions: Region[]): Attribution[] {
  const out: Attribution[] = [];
  const texts = regions.map((r) => r.ownText.toLowerCase());
  for (const request of requests) {
    for (let k = 0; k < regions.length; k += 1) {
      const region = regions[k];
      if (region.file && request.initiator.includes(region.file)) {
        out.push({ request: request.id, region: region.id, via: 'initiator' });
      }
      if (!texts[k]) continue;
      const shown = request.values.some((value) =>
        // Whole-token match: a value is not "shown" inside a longer word.
        new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(value.toLowerCase())}($|[^\\p{L}\\p{N}])`, 'u').test(texts[k])
      );
      if (shown) out.push({ request: request.id, region: region.id, via: 'data' });
    }
  }
  const unique = new Map(out.map((a) => [`${a.request}\u0000${a.region}\u0000${a.via}`, a]));
  return [...unique.values()].sort(
    (a, b) => a.request.localeCompare(b.request) || a.region.localeCompare(b.region) || a.via.localeCompare(b.via)
  );
}
