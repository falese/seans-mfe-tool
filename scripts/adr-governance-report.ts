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
 * reviewer actually needs is: does this PR change a decision, does it rest on
 * one, and is that decision ratified.
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
import { parseAdrDocument, formatAdrId, normalizeAdrId } from '@seans-mfe/dsl';
import type { AdrDocument, AdrStatus } from '@seans-mfe/dsl';

const REPO_ROOT = path.resolve(__dirname, '..');
const ADR_DIR = path.join(REPO_ROOT, 'docs', 'architecture-decisions');
const BASE = process.argv[2] ?? 'origin/main';

/** Marker so the CI step can find and update its own comment instead of piling up. */
export const COMMENT_MARKER = '<!-- adr-governance-report -->';

const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.ejs', '.mjs', '.cjs']);

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

  // Decisions this PR's changed code rests on.
  const cited = new Set<number>();
  for (const file of codeFiles) {
    const full = path.join(REPO_ROOT, file);
    if (!fs.existsSync(full)) continue;
    for (const m of fs.readFileSync(full, 'utf8').matchAll(/ADR-(\d{2,4})\b/g)) {
      cited.add(Number.parseInt(m[1], 10));
    }
  }

  const out: string[] = [COMMENT_MARKER, '## 🏛 ADR governance', ''];

  if (touched.length > 0) {
    out.push('### Decisions changed by this PR', '');
    out.push('| ADR | Title | Status | Carried by |');
    out.push('| --- | --- | --- | --- |');
    for (const file of touched) {
      const id = Number.parseInt(/ADR-(\d+)/.exec(file)![1], 10);
      const doc = byId.get(id);
      if (!doc) continue;
      const fm = doc.frontmatter;
      const before = statusOnBase(file);
      const transition =
        before === 'new'
          ? '**new**'
          : before && before !== fm.status
            ? `${before} → **${fm.status}**`
            : fm.status;
      const carried =
        fm['implemented-by'].length > 0
          ? `\`${fm['implemented-by'][0]}\`${fm['implemented-by'].length > 1 ? ` +${fm['implemented-by'].length - 1}` : ''}`
          : fm.impl?.refs.length
            ? fm.impl.refs.join(', ')
            : '—';
      out.push(
        `| [ADR-${formatAdrId(id)}](./docs/architecture-decisions/${doc.path}) | ${fm.title} | ${STATUS_ICON[fm.status] ?? ''} ${transition} | ${carried} |`
      );
    }
    out.push('');
  }

  const restsOn = [...cited].filter((id) => byId.has(id)).sort((a, b) => a - b);
  if (restsOn.length > 0) {
    out.push('### Decisions this PR’s code rests on', '');
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
    '<sub>Generated from ADR frontmatter (ADR-075). ' +
      '`npm run check:adr` validates it; `npm run build:adr-index:check` proves the index matches. ' +
      '`seans-mfe-tool adr:status --outstanding` lists ratified work still to do.</sub>'
  );

  console.log(out.join('\n'));
}

main();
