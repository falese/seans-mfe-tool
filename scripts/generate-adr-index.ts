#!/usr/bin/env ts-node
/**
 * Generate the ADR index and the PDR↔ADR map from ADR frontmatter (ADR-075 §1).
 *
 * ADR-075 made each ADR's frontmatter the single source of truth for its own
 * metadata. Until now the `docs/spec.md#adr-index` table and the PDR↔ADR map in
 * `docs/architecture-decisions/README.md` were still hand-maintained copies of
 * that same data — the exact shape ADR-069/071/074 argue against, and it drifted
 * on schedule: the index disagreed with the files on ADR-057/058 and on
 * qualifiers for six more, and the PDR-005 row carried a status recap
 * ("054/055/057/058 Implemented; 056/059/060/066…067/068/069 Accepted") that the
 * ADR-075 §6 reconciliation made wrong the moment it landed.
 *
 * This replaces both with generated regions plus the `--check` diff gate ADR-065
 * established for schemas. Index drift stops being detectable and becomes
 * unrepresentable.
 *
 * Two things it deliberately does not do:
 *   - It does not touch anything outside the BEGIN/END markers. The prose around
 *     each table is authored and stays authored.
 *   - It does not invent the per-ADR glosses the old PDR map carried
 *     ("ADR-001 lifecycle re-entrancy guard"). Those were hand-written
 *     restatements of each ADR's own title — the drift class this whole effort
 *     exists to remove — so the generated map uses the titles themselves.
 *
 * Usage:
 *   npm run build:adr-index            # rewrite the generated regions
 *   npm run build:adr-index:check      # diff only; exit 1 if stale (CI)
 *
 * Refs ADR-075.
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseAdrDocument, formatAdrId, normalizeAdrId } from '@seans-mfe/plugin-adr';
import type { AdrDocument } from '@seans-mfe/plugin-adr';

const REPO_ROOT = path.resolve(__dirname, '..');
const CHECK_MODE = process.argv.includes('--check');

const ADR_DIR = path.join(REPO_ROOT, 'docs', 'architecture-decisions');
const PDR_DIR = path.join(REPO_ROOT, 'docs', 'product-decisions');
const SPEC_FILE = path.join(REPO_ROOT, 'docs', 'spec.md');
const README_FILE = path.join(ADR_DIR, 'README.md');

const BEGIN = (id: string): string => `<!-- BEGIN GENERATED: ${id} -->`;
const END = (id: string): string => `<!-- END GENERATED: ${id} -->`;

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

interface Pdr {
  id: number;
  title: string;
  file: string;
}

function readAdrs(): AdrDocument[] {
  const documents: AdrDocument[] = [];
  for (const name of fs.readdirSync(ADR_DIR).sort()) {
    if (!/^ADR-\d+.*\.md$/.test(name)) continue;
    const parsed = parseAdrDocument(name, fs.readFileSync(path.join(ADR_DIR, name), 'utf8'));
    if (parsed.status === 'ok') {
      documents.push(parsed.document);
      continue;
    }
    // A file the schema cannot read cannot be rendered. `check:adr` owns that
    // failure and reports it far better than a half-built table would.
    throw new Error(
      `${name} does not parse (${parsed.failure.reason}) — run \`npm run check:adr\` first`
    );
  }
  return documents.sort((a, b) => normalizeAdrId(a.frontmatter.id) - normalizeAdrId(b.frontmatter.id));
}

function readPdrs(): Pdr[] {
  if (!fs.existsSync(PDR_DIR)) return [];
  const pdrs: Pdr[] = [];
  for (const name of fs.readdirSync(PDR_DIR).sort()) {
    const m = /^PDR-(\d+).*\.md$/.exec(name);
    if (!m) continue;
    const text = fs.readFileSync(path.join(PDR_DIR, name), 'utf8');
    const title = /^title:\s*(.+)$/m.exec(text)?.[1]?.trim() ?? name;
    pdrs.push({ id: Number.parseInt(m[1], 10), title: title.replace(/^["']|["']$/g, ''), file: name });
  }
  return pdrs.sort((a, b) => a.id - b.id);
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

/** `Accepted` + `impl: {stage, refs}` -> `Accepted (impl deferred, #252)`. */
function renderStatus(document: AdrDocument): string {
  const { status, impl } = document.frontmatter;
  if (!impl) return status;
  const refs = impl.refs.join(', ');
  return `${status} (impl ${impl.stage}${refs ? `, ${refs}` : ''})`;
}

/** Escape the pipes and angle brackets that would break a Markdown table cell. */
function cell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/</g, '\\<').replace(/>/g, '\\>');
}

/**
 * The index is grouped by lifecycle tier, not rendered as one flat run of 83
 * rows. A reader opening this table wants "what is the architecture now"; a
 * single sorted list answers "what decisions have ever been filed", and buries
 * the eight Proposed and two Superseded entries among them at full visual
 * weight.
 *
 * The grouping is a property of the generated VIEW. The files stay where they
 * are: ADR paths are cited from code comments, from other ADRs, and from merged
 * PRs, and this repo has already paid once for moving them — PR #194's
 * renumbering left twelve in-body cross-references pointing at decisions whose
 * meaning had changed (see the register's "Cross-references corrected" table).
 * Frontmatter is the source of truth and views are generated (ADR-075 §1), so
 * curation belongs here rather than in the filesystem.
 */
const INDEX_TIERS: readonly { heading: string; blurb: string; statuses: readonly string[] }[] = [
  {
    heading: 'Live — the current architecture',
    blurb: 'Ratified decisions. These describe how the platform works today.',
    statuses: ['Implemented', 'Accepted'],
  },
  {
    heading: 'Proposed — filed, not ratified',
    blurb: 'A decision has been written down but not agreed. Do not build against these.',
    statuses: ['Proposed'],
  },
  {
    heading: 'Deferred — postponed on purpose',
    blurb: 'Deliberately not decided yet; the ADR records why.',
    statuses: ['Deferred'],
  },
  {
    heading: 'Superseded — replaced, kept for provenance',
    blurb: 'Retired by a later decision. Kept so the reasoning stays traceable.',
    statuses: ['Superseded'],
  },
];

function renderRow(d: AdrDocument): string {
  const id = formatAdrId(d.frontmatter.id);
  const link = `[ADR-${id}](./architecture-decisions/${d.path})`;
  let status = renderStatus(d);
  // A bare "Superseded" makes the reader hunt for the replacement.
  const by = d.frontmatter['superseded-by'];
  if (by.length > 0) {
    status += ` → ${by.map((t) => `ADR-${formatAdrId(normalizeAdrId(t))}`).join(', ')}`;
  }
  return `| ${link} | ${cell(d.frontmatter.title)} | ${cell(d.frontmatter.area ?? '—')} | ${cell(status)} |`;
}

function renderIndex(documents: readonly AdrDocument[]): string {
  const out: string[] = [];
  const seen = new Set<AdrDocument>();

  for (const tier of INDEX_TIERS) {
    const inTier = documents.filter((d) => tier.statuses.includes(d.frontmatter.status));
    if (inTier.length === 0) continue;
    inTier.forEach((d) => seen.add(d));
    out.push(
      `### ${tier.heading}`,
      '',
      `_${tier.blurb}_`,
      '',
      '| ADR | Title | Area | Status |',
      '|-----|-------|------|--------|',
      ...inTier.map(renderRow),
      '',
    );
  }

  // A status outside the tier table would silently vanish from the index, which
  // is the failure mode this whole file exists to prevent. Surface it instead.
  const untiered = documents.filter((d) => !seen.has(d));
  if (untiered.length > 0) {
    out.push(
      '### Untiered',
      '',
      '_These carry a status the index does not group. Add it to `INDEX_TIERS`._',
      '',
      '| ADR | Title | Area | Status |',
      '|-----|-------|------|--------|',
      ...untiered.map(renderRow),
      '',
    );
  }

  return out.join('\n').trimEnd();
}

function renderPdrMap(documents: readonly AdrDocument[], pdrs: readonly Pdr[]): string {
  const rows = pdrs.map((pdr) => {
    const implementing = documents.filter((d) =>
      d.frontmatter['implements-pdr'].map(normalizeAdrId).includes(pdr.id)
    );
    const link = `[PDR-${formatAdrId(pdr.id)}](../product-decisions/${pdr.file})`;
    const cells =
      implementing.length === 0
        ? '_none recorded_'
        : implementing
            .map(
              (d) =>
                `[ADR-${formatAdrId(d.frontmatter.id)}](./${d.path}) ${cell(d.frontmatter.title)}`
            )
            .join('; ');
    return `| ${link} — ${cell(pdr.title)} | ${cells} |`;
  });
  return ['| PDR | ADRs that implement it |', '| --- | ---------------------- |', ...rows].join('\n');
}

// ---------------------------------------------------------------------------
// Splice
// ---------------------------------------------------------------------------

/** Replace the content between the markers, leaving the authored prose alone. */
function splice(file: string, regionId: string, body: string): { text: string; changed: boolean } {
  const current = fs.readFileSync(file, 'utf8');
  const begin = BEGIN(regionId);
  const end = END(regionId);
  const start = current.indexOf(begin);
  const stop = current.indexOf(end);

  if (start === -1 || stop === -1 || stop < start) {
    throw new Error(
      `${path.relative(REPO_ROOT, file)} is missing the ${regionId} markers — ` +
        `add ${begin} / ${end} around the generated block`
    );
  }

  const next =
    current.slice(0, start + begin.length) + '\n\n' + body + '\n\n' + current.slice(stop);
  return { text: next, changed: next !== current };
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

function main(): void {
  const documents = readAdrs();
  const pdrs = readPdrs();

  const targets: { file: string; region: string; body: string }[] = [
    { file: SPEC_FILE, region: 'adr-index', body: renderIndex(documents) },
    { file: README_FILE, region: 'pdr-adr-map', body: renderPdrMap(documents, pdrs) },
  ];

  const stale: string[] = [];

  for (const target of targets) {
    const { text, changed } = splice(target.file, target.region, target.body);
    const relative = path.relative(REPO_ROOT, target.file);
    if (!changed) {
      console.log(`OK    ${relative} (${target.region})`);
      continue;
    }
    if (CHECK_MODE) {
      stale.push(`${relative} (${target.region})`);
      continue;
    }
    fs.writeFileSync(target.file, text);
    console.log(`WROTE ${relative} (${target.region})`);
  }

  if (stale.length > 0) {
    console.error('\nGenerated regions are stale:');
    for (const s of stale) console.error(`  - ${s}`);
    console.error('\nRun `npm run build:adr-index` and commit the result.');
    process.exit(1);
  }

  console.log(`\n${documents.length} ADR(s), ${pdrs.length} PDR(s).`);
}

main();
