#!/usr/bin/env ts-node
/**
 * Governance summary for a pull request (ADR-075).
 *
 * Emits Markdown showing that the work in a PR is properly governed: which
 * decisions it touches, which it cites, and what state the register is in.
 *
 * Deliberately **scoped to the diff**, not a dump of the whole index. A 75-row
 * table on every PR is noise nobody reads, and noise nobody reads is worse than
 * nothing — it makes the governance signal look like boilerplate. What a
 * reviewer actually needs is: does this PR change a decision, which decisions
 * does it reference, and are those ratified.
 *
 * Usage:
 *   ts-node scripts/adr-governance-report.ts <base-ref>
 *   ts-node scripts/adr-governance-report.ts origin/main > comment.md
 *
 * Refs ADR-075.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { parseAdrDocument, formatAdrId, normalizeAdrId, SUPPRESSION } from '@seans-mfe/plugin-adr';
import type { AdrDocument, AdrStatus } from '@seans-mfe/plugin-adr';

const REPO_ROOT = path.resolve(__dirname, '..');
const ADR_DIR = path.join(REPO_ROOT, 'docs', 'architecture-decisions');
const BASE = process.argv[2] ?? 'origin/main';
/**
 * Optional path to a JSON array of open issues (`gh issue list --json number,title,body`).
 *
 * Live GitHub state is deliberately an *argument*, not a fetch (ADR-075 §7): the
 * script stays offline-testable and CI keeps the network call in the job that
 * already makes one. Absent, the one-way section is simply skipped.
 */
const ISSUES_FILE = process.argv[3];

/** Marker so the CI step can find and update its own comment instead of piling up. */
export const COMMENT_MARKER = '<!-- adr-governance-report -->';

const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.ejs', '.mjs', '.cjs']);

/**
 * Paths whose change can land in code the generator seeds but does not own
 * (ADR-082).
 *
 * Four, deliberately: the templates themselves, the package generated MFEs
 * import from, the package that reaches them through its re-export shims
 * (`packages/runtime/src/errors/index.ts` forwards the whole error hierarchy
 * from contracts, so a rename there changes what generated code imports with no
 * runtime file in the diff), and the generator itself — which decides not only
 * *what* is emitted but *who owns it*.
 *
 * That fourth path was missing until the first change to run through these
 * directives fell straight through the gap: flipping `.gitignore` from
 * `overwrite: false` to `true` (#341) made regeneration start **overwriting**
 * a file in every MFE, and this section stayed silent. An ownership change is
 * the more dangerous of the two edits — a template change alters content a
 * developer can review in the diff, while an ownership change alters whether
 * their own edits survive at all.
 *
 * Scoped to `unified-generator.ts` rather than all of `packages/codegen/src`:
 * it is the only non-test file that *sets* the `overwrite` flag. `validate.ts`
 * and `drift.ts` read it, and widening to the whole directory would put this
 * comment on nearly every codegen PR.
 *
 * Widening this set is a decision rather than a tweak. Every path added puts
 * this comment on more pull requests, and a reminder that appears on all of
 * them is one nobody reads — at which point the registry goes unmaintained
 * exactly as if the section did not exist.
 */
export const GENERATED_CONTRACT_PATHS: readonly RegExp[] = [
  /^packages\/codegen\/templates\//,
  /^packages\/runtime\/src\//,
  /^packages\/contracts\/src\//,
  /^packages\/codegen\/src\/unified-generator\.ts$/,
];

/** Touching this file *is* the declaration, so it suppresses the reminder. */
export const MIGRATION_REGISTRY = 'packages/codegen/src/platform-migrations.ts';

const IS_TEST_FILE = /(^|\/)__tests__\/|\.test\.[jt]sx?$/;

/**
 * The reminder that a change reaching generated code needs a declared
 * migration — or an explicit note that it does not (ADR-082).
 *
 * Advisory, matching the report's existing posture (ADR-075 §7 keeps live
 * GitHub state in a comment rather than the correctness path, and reports
 * one-way citations rather than failing them). A blocking gate here would fire
 * on comment reflows and typo fixes, and an escape hatch used every third PR
 * stops being read.
 *
 * Pure, and pure on purpose: the rest of `main` interleaves git and fs reads
 * with formatting, which is why none of it has ever been tested. This takes the
 * file list and returns lines.
 */
export function generatedContractSection(files: string[]): string[] {
  // A PR that already declares an entry did the thing this asks for.
  if (files.includes(MIGRATION_REGISTRY)) return [];

  const hits = files.filter(
    (file) => GENERATED_CONTRACT_PATHS.some((p) => p.test(file)) && !IS_TEST_FILE.test(file)
  );
  if (hits.length === 0) return [];

  const rest = hits.length - 1;
  const named = `\`${hits[0]}\`${rest > 0 ? ` (+${rest} more)` : ''}`;

  return [
    '### ⚠️ This PR changes contracts that reach generated code',
    '',
    named,
    '',
    'Regeneration re-stamps the files the generator owns (`npm run check:mfe-drift`). ' +
      'It **cannot reach developer-owned files** — `src/index.tsx`, `App.tsx`, anything ' +
      'an MFE author wrote — even with `--force`. Carrying ADR-017 out to the fleet ' +
      'reached 29 of 48 files and left 19 stale with every gate green.',
    '',
    `If this change affects code an MFE author wrote, declare an entry in \`${MIGRATION_REGISTRY}\` ` +
      '(ADR-082) in this PR — or say here why none is needed.',
    '',
  ];
}

/**
 * Strip Markdown blockquotes before scanning an issue body for citations.
 *
 * A blockquote is commentary *about* an issue, not a claim the issue makes.
 * The ADR-075 §7 backlog pass appended a `> **Reference corrected…**` footer to
 * every issue whose decision number was stale, and each footer necessarily
 * *quotes* the wrong number it is correcting and names the pass that corrected
 * it. Counting those meant fixing an issue made it scan worse than leaving it
 * broken — one issue went from one genuine reference to three.
 *
 * This comment names no decision numbers on purpose. Prose that cites a number
 * to talk *about* citing is exactly the case the rule exists to exclude, and
 * demonstrating that by needing a suppression here would be a poor advert for it.
 */
function withoutQuotes(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((line) => !/^\s*>/.test(line))
    .join('\n');
}

/** Escape what would break a Markdown table cell or be read as an HTML tag. */
function cell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function git(...args: string[]): string {
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
}

function changedFiles(): string[] {
  const merge = git('merge-base', BASE, 'HEAD');
  return git('diff', '--name-only', `${merge}..HEAD`).split('\n').filter(Boolean);
}

function readAdrs(): Map<number, AdrDocument> {
  const byId = new Map<number, AdrDocument>();
  for (const name of fs.readdirSync(ADR_DIR).sort()) {
    if (!/^ADR-\d+.*\.md$/.test(name)) continue;
    const parsed = parseAdrDocument(name, fs.readFileSync(path.join(ADR_DIR, name), 'utf8'));
    if (parsed.status === 'ok') byId.set(normalizeAdrId(parsed.document.frontmatter.id), parsed.document);
  }
  return byId;
}

/** The status an ADR had on the base branch, for showing transitions. */
function statusOnBase(file: string): AdrStatus | 'new' | undefined {
  try {
    const before = git('show', `${BASE}:${file}`);
    const parsed = parseAdrDocument(file, before);
    return parsed.status === 'ok' ? parsed.document.frontmatter.status : undefined;
  } catch {
    return 'new';
  }
}

const STATUS_ICON: Record<string, string> = {
  Proposed: '🟡',
  Accepted: '🔵',
  Implemented: '🟢',
  Deferred: '⚪',
  Superseded: '⚫',
  Withdrawn: '⚫',
};

function main(): void {
  const files = changedFiles();
  const byId = readAdrs();

  const touched = files.filter((f) => /docs\/architecture-decisions\/ADR-\d+.*\.md$/.test(f));
  const codeFiles = files.filter((f) => CODE_EXTENSIONS.has(path.extname(f)));

  // Decisions the changed code *mentions*.
  //
  // Deliberately labelled "references", not "rests on". This is a text scan, and
  // a text scan cannot tell a dependency from an example: files whose subject is
  // the decision record — this one, the schema, the rules — name decisions in
  // their prose constantly, and three rounds of suppressing those one at a time
  // did not converge. Overclaiming would be the worse error, so the heading says
  // what the scan actually knows.
  //
  // It still honours the gate's `adr-lint-ignore: code-cites-ratified-adr`
  // marker, importing the one regex rather than copying it, so a line already
  // declared to be prose stays excluded from both.
  const cited = new Set<number>();
  for (const file of codeFiles) {
    const full = path.join(REPO_ROOT, file);
    if (!fs.existsSync(full)) continue;
    for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
      if (SUPPRESSION.exec(line)?.[1] === 'code-cites-ratified-adr') continue;
      for (const m of line.matchAll(/ADR-(\d{2,4})\b/g)) {
        cited.add(Number.parseInt(m[1], 10));
      }
    }
  }

  const out: string[] = [COMMENT_MARKER, '## 🏛 ADR governance', ''];

  // One-way links: an issue cites an ADR that names neither it in `tracked-by`
  // nor in `impl.refs`. Advisory — §7 is explicit that one-way is not
  // automatically a defect (#208 cites ADR-054/055/056 to say the warnings
  // *predate* that work, which is correct and should stay one-way).
  const oneWay: string[] = [];
  if (ISSUES_FILE && fs.existsSync(ISSUES_FILE)) {
    const claimed = new Set<number>();
    for (const doc of byId.values()) {
      for (const ref of [...doc.frontmatter['tracked-by'], ...(doc.frontmatter.impl?.refs ?? [])]) {
        claimed.add(Number.parseInt(ref.replace('#', ''), 10));
      }
    }
    const openIssues = JSON.parse(fs.readFileSync(ISSUES_FILE, 'utf8')) as {
      number: number;
      title: string;
      body?: string;
    }[];
    for (const issue of openIssues) {
      if (claimed.has(issue.number)) continue;
      const cites = [
        ...new Set(
          [...withoutQuotes(`${issue.title} ${issue.body ?? ''}`).matchAll(/ADR-(\d{3})/g)].map((m) =>
            Number.parseInt(m[1], 10)
          )
        ),
      ]
        .filter((id) => byId.has(id))
        .sort((a, b) => a - b);
      if (cites.length === 0) continue;
      oneWay.push(
        `| #${issue.number} | ${cell(issue.title.slice(0, 58))} | ${cites.map((id) => `ADR-${formatAdrId(id)}`).join(', ')} |`
      );
    }
  }

  // A row per touched file would mean 48 rows for a metadata backfill — the
  // exact noise this report exists to avoid. Only a *lifecycle* change earns a
  // row; everything else collapses to a count.
  const notable: string[] = [];
  let metadataOnly = 0;

  for (const file of touched) {
    const id = Number.parseInt(/ADR-(\d+)/.exec(file)![1], 10);
    const doc = byId.get(id);
    if (!doc) continue;
    const fm = doc.frontmatter;
    const before = statusOnBase(file);

    if (before !== 'new' && before === fm.status) {
      metadataOnly += 1;
      continue;
    }

    const transition = before === 'new' ? '**new**' : `${before} → **${fm.status}**`;
    const carried =
      fm['implemented-by'].length > 0
        ? `\`${fm['implemented-by'][0]}\`${fm['implemented-by'].length > 1 ? ` +${fm['implemented-by'].length - 1}` : ''}`
        : fm.impl?.refs.length
          ? fm.impl.refs.join(', ')
          : '—';
    notable.push(
      `| [ADR-${formatAdrId(id)}](./docs/architecture-decisions/${doc.path}) | ${cell(fm.title)} | ${STATUS_ICON[fm.status] ?? ''} ${transition} | ${carried} |`
    );
  }

  if (notable.length > 0) {
    out.push('### Lifecycle changes', '');
    out.push('| ADR | Title | Status | Carried by |');
    out.push('| --- | --- | --- | --- |');
    out.push(...notable);
    out.push('');
  }

  if (metadataOnly > 0) {
    out.push(
      `${metadataOnly} further ADR${metadataOnly === 1 ? '' : 's'} had metadata updated with no status change.`,
      ''
    );
  }

  const restsOn = [...cited].filter((id) => byId.has(id)).sort((a, b) => a - b);
  if (restsOn.length > 0) {
    out.push('### Decisions referenced by the changed code', '');
    out.push(
      restsOn
        .map((id) => {
          const fm = byId.get(id)!.frontmatter;
          return `${STATUS_ICON[fm.status] ?? ''} \`ADR-${formatAdrId(id)}\``;
        })
        .join(' · ')
    );
    out.push('');
  }

  if (touched.length === 0 && restsOn.length === 0) {
    out.push('No ADRs changed and no ADR citations in the changed code.', '');
  }

  // Before the advisory one-way block, since this one is about the diff in
  // front of the reviewer rather than the state of the backlog.
  out.push(...generatedContractSection(files));

  if (oneWay.length > 0) {
    out.push('<details>');
    out.push(
      `<summary>${oneWay.length} open issue(s) cite an ADR that does not cite them back</summary>`,
      ''
    );
    out.push('| Issue | Title | Cites |', '| --- | --- | --- |', ...oneWay);
    out.push('');
    out.push(
      'Advisory (ADR-075 §7). One-way is not automatically wrong — a reference can be ' +
        'temporal ("these warnings predate ADR-054"). Where the issue genuinely concerns ' +
        'a decision, add it to that ADR\'s `tracked-by`.'
    );
    out.push('</details>', '');
  }

  // Register-wide state, one line — the context a reviewer needs without a dump.
  const counts = new Map<string, number>();
  for (const doc of byId.values()) {
    counts.set(doc.frontmatter.status, (counts.get(doc.frontmatter.status) ?? 0) + 1);
  }
  const summary = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([status, n]) => `${STATUS_ICON[status] ?? ''} ${n} ${status}`)
    .join(' · ');

  out.push('---', '');
  out.push(`**Register:** ${summary} — ${byId.size} ADRs.`);
  out.push('');
  out.push(
    '<sub>Generated from ADR frontmatter (ADR-075). References are a text scan, so a ' +
      'mention in prose counts — read that list as context, not a dependency set. ' +
      '`npm run check:adr` validates it; `npm run build:adr-index:check` proves the index matches. ' +
      '`seans-mfe-tool adr:status --outstanding` lists ratified work still to do.</sub>'
  );

  console.log(out.join('\n'));
}

// Only when run as a script. `main` reads `process.argv[2]` and shells out to
// git, so an unguarded call makes the module untestable — importing it would
// run a report over whatever the test runner happened to put in argv.
if (require.main === module) {
  main();
}
