/**
 * ADR frontmatter schema (ADR-075).
 *
 * The decision record is the artifact every other gate in this repo answers to,
 * and it was the last one kept in sync by hand. ADR-075 makes each ADR's
 * frontmatter the single source of truth for its own metadata and turns the
 * `docs/spec.md` index into a generated view of it — which only works if the
 * frontmatter has a shape something can rely on.
 *
 * This is that shape. It lives beside the manifest schema for the ADR-061
 * reason: `@falese/smt-dsl` is where the platform's parse-time contracts live,
 * and ADR metadata is parsed at design time by CLI tooling with no runtime
 * dependency.
 *
 * Two things the old free-text header could not do and this can:
 *   - `status` is a closed set, so "what is Proposed and cited by code" is a
 *     query rather than a reading exercise (the library carried 13 distinct
 *     status strings for 74 records);
 *   - implementation state is structured (`impl`), so "Accepted (impl deferred,
 *     #252)" stops being a string only a human can parse.
 */

import { z } from 'zod';
import * as yaml from 'js-yaml';

// =============================================================================
// Vocabulary
// =============================================================================

/**
 * The closed status vocabulary (ADR-075 §2).
 *
 * `Accepted` = decision ratified. `Implemented` = code in place. The distinction
 * predates this schema (`docs/architecture-decisions/README.md` records it) and
 * is kept; what changes is that nothing else is spellable.
 */
export const AdrStatusSchema = z.enum([
  'Proposed',
  'Accepted',
  'Implemented',
  'Deferred',
  'Superseded',
  'Withdrawn',
]);
export type AdrStatus = z.infer<typeof AdrStatusSchema>;

/**
 * Statuses under which code may legitimately cite an ADR (ADR-075 §4).
 *
 * The excluded pair is the point: `Proposed` means nobody has decided yet, and
 * `Withdrawn` means they decided against — code resting on either is drift.
 * Everything else is a decision that was actually made, including `Deferred`:
 * `packages/dsl/src/schema.ts:151` marks a placeholder field `// Deferred -
 * ADR-007`, and pointing at the decision to defer is exactly right.
 */
export const CITABLE_STATUSES: readonly AdrStatus[] = [
  'Accepted',
  'Implemented',
  'Superseded',
  'Deferred',
];

/**
 * How a decision is held to: `code` = a gate or type enforces it, `convention` =
 * humans do, `tooling` = a build step does. Carried over from the existing
 * frontmatter rather than invented here.
 */
export const AdrEnforcementSchema = z.enum(['code', 'convention', 'tooling', 'none']);
export type AdrEnforcement = z.infer<typeof AdrEnforcementSchema>;

/**
 * Implementation stage, separate from ratification (ADR-075 §2).
 *
 * A decision can be `Accepted` while its implementation is phased across
 * releases (ADR-065, ADR-070) or deferred behind another decision (ADR-063,
 * ADR-064). That was previously encoded by appending prose to the status.
 */
export const AdrImplSchema = z.object({
  stage: z.enum(['phased', 'deferred']),
  /** Issue or PR references that track the remaining work, e.g. `#252`. */
  refs: z.array(z.string().min(1)).default([]),
});
export type AdrImpl = z.infer<typeof AdrImplSchema>;

// =============================================================================
// Frontmatter
// =============================================================================

/**
 * An ADR id as it appears in `relates-to` / `supersedes` / `superseded-by`.
 *
 * js-yaml resolves a zero-padded `0074` to the number 74, so both forms are
 * accepted and normalized to a number. `normalizeAdrId` is the only place that
 * conversion happens.
 */
export const AdrIdSchema = z.union([z.number().int().positive(), z.string().regex(/^\d{1,4}$/)]);

export const AdrFrontmatterSchema = z.object({
  id: AdrIdSchema,
  title: z.string().min(1),
  status: AdrStatusSchema,
  date: z.union([z.string().min(1), z.date()]),
  deciders: z.array(z.string().min(1)).default([]),

  /**
   * Replaces the index's hand-typed Area column (ADR-075 §1).
   *
   * Optional *in the schema*, required by the `metadata-complete` rule. The
   * distinction matters during the migration: a schema that cannot parse the
   * library it describes reports one failure per file and starves every other
   * rule of input. Making the new field a rule rather than a parse error lets
   * the cross-reference and supersession checks run against the corpus that
   * exists today, which is the whole point of landing the gate first.
   */
  area: z.string().min(1).optional(),
  enforcement: AdrEnforcementSchema,
  tags: z.array(z.string().min(1)).default([]),

  impl: AdrImplSchema.optional(),

  'relates-to': z.array(AdrIdSchema).default([]),
  supersedes: z.array(AdrIdSchema).default([]),
  'superseded-by': z.array(AdrIdSchema).default([]),

  /** Product decision(s) this ADR implements, e.g. `5` for PDR-005. */
  'implements-pdr': z.array(AdrIdSchema).default([]),

  /**
   * Repo-relative paths to the code that carries this decision (ADR-075 §3).
   * Checked to exist. Empty is valid and honest for a pure-convention ADR.
   */
  'implemented-by': z.array(z.string().min(1)).default([]),

  /** Test names or npm-script gate names that demonstrate the decision holds. */
  'verified-by': z.array(z.string().min(1)).default([]),

  /**
   * Open issues *concerning* this decision (ADR-075 §7).
   *
   * Deliberately not `impl.refs`. That field means "work required to finish
   * ratifying this decision" and lives under `impl.stage`; putting a bug against
   * an already-`Implemented` decision there would make `adr:status --outstanding`
   * report finished work as outstanding. This field carries no such implication.
   */
  'tracked-by': z.array(z.string().regex(/^#\d+$/, 'must be an issue reference like "#123"')).default([]),

  summary: z.string().min(1).optional(),
  'rationale-summary': z.string().min(1).optional(),

  /** Pre-existing marker on 57 ADRs; preserved rather than silently stripped. */
  'long-form': z.boolean().optional(),
});

export type AdrFrontmatter = z.infer<typeof AdrFrontmatterSchema>;

// =============================================================================
// Parsing
// =============================================================================

/** An ADR as the rules see it: metadata, raw body, and where it came from. */
export interface AdrDocument {
  /** Repo-relative path, used for reporting. */
  path: string;
  frontmatter: AdrFrontmatter;
  /** Everything after the closing `---`, for cross-reference scanning. */
  body: string;
  /**
   * 1-indexed file line on which `body` starts.
   *
   * Without this, a finding's line is relative to the body and gets printed as
   * `file:line`, sending the reader to a line that has nothing to do with the
   * defect — off by the whole length of the frontmatter block.
   */
  bodyLine: number;
}

export interface AdrParseFailure {
  path: string;
  /** `no-frontmatter` = a prose header; `invalid-yaml`/`schema` = malformed. */
  reason: 'no-frontmatter' | 'invalid-yaml' | 'schema';
  message: string;
}

/**
 * Discriminated on a *string*, not a boolean: this repo does not enable
 * `strictNullChecks`, and without it a `{ ok: true } | { ok: false }` union does
 * not narrow. Same reason `SlotTargetResult` uses `status` (ADR-073).
 */
export type AdrParseResult =
  | { status: 'ok'; document: AdrDocument }
  | { status: 'failed'; failure: AdrParseFailure };

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

/**
 * Normalize any accepted id spelling to a plain number.
 *
 * `0074` (js-yaml → 74), `74`, and `'074'` all become `74`.
 */
export function normalizeAdrId(id: number | string): number {
  return typeof id === 'number' ? id : Number.parseInt(id, 10);
}

/** Render an id back to its canonical 3-digit display form: `74` → `074`. */
export function formatAdrId(id: number | string): string {
  return String(normalizeAdrId(id)).padStart(3, '0');
}

/**
 * Split an ADR file into validated frontmatter and body.
 *
 * Pure: the caller supplies the text. A file with a prose header (`- **Status:**
 * …`) fails with `no-frontmatter` rather than throwing — 16 ADRs are in that
 * shape today and the gate's job is to report them, not to crash on them.
 */
export function parseAdrDocument(path: string, text: string): AdrParseResult {
  const match = FRONTMATTER.exec(text);
  if (!match) {
    return {
      status: 'failed',
      failure: {
        path,
        reason: 'no-frontmatter',
        message: 'no YAML frontmatter block — ADR-075 §1 requires one',
      },
    };
  }

  let raw: unknown;
  try {
    raw = yaml.load(match[1]);
  } catch (error) {
    return {
      status: 'failed',
      failure: {
        path,
        reason: 'invalid-yaml',
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }

  const parsed = AdrFrontmatterSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: 'failed',
      failure: {
        path,
        reason: 'schema',
        message: parsed.error.issues
          .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
          .join('; '),
      },
    };
  }

  // Lines consumed before the body starts: the whole matched prefix minus the
  // body itself. Reported findings are file-relative because of this.
  const bodyLine = text.slice(0, text.length - match[2].length).split(/\r?\n/).length;

  return {
    status: 'ok',
    document: { path, frontmatter: parsed.data, body: match[2], bodyLine },
  };
}
