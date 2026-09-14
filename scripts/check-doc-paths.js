#!/usr/bin/env node
/**
 * check-doc-paths.js — verify that repository paths cited in docs still exist.
 *
 *   node scripts/check-doc-paths.js
 *
 * `check-doc-links.js` covers links BETWEEN documents. This covers the other
 * half: a doc that points at `src/dsl/schema.ts` after the monorepo split sends
 * the reader somewhere that is not there, and nothing noticed until someone
 * went looking.
 *
 * Scope: backticked strings that start with a real top-level repository
 * directory. A path is reported when it does not resolve and is not on one of
 * the allow-lists below.
 *
 * Build output is out of scope. A clean checkout has no `dist/`, so judging one
 * would make this gate pass on a developer's machine and fail in CI — the
 * failure mode it exists to prevent, in itself.
 *
 * Plain Node with no dependencies, so it runs before `npm ci` if it has to.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

/** Top-level directories whose paths this script is willing to judge. */
const ROOTS = ['src/', 'packages/', 'scripts/', 'schemas/', 'examples/', 'bin/', 'docs/'];

/**
 * Documents that describe the repository as it was, not as it is.
 *
 * A decision record states what was true when the decision was made, and a plan
 * states what was true when the plan was written. Rewriting their paths would
 * make them claim a history they do not have, so they are out of scope rather
 * than exempt: CLAUDE.md forbids editing a shipped ADR at all.
 */
const HISTORICAL = [
  /^docs\/architecture-decisions\//,
  /^docs\/product-decisions\//,
  /^docs\/requirements\//,
  /^docs\/archive\//,
  /^docs\/(MERGE-PLAN|RESTRUCTURE-PLAN|generator-extraction-plan)\.md$/,
  /^docs\/(bff-refactor-analysis|gate-self-verification-audit)\.md$/,
  /^docs\/coder-intent-manifest-adaptor-spec\.md$/,
  /^docs\/lifecycle-engine-analysis\.md$/,
];

/**
 * Paths that are correct without existing here.
 *
 * Most are inside a GENERATED MFE: `src/features/Dashboard/` is a real address
 * in every scaffolded project and in none of this repository. The rest are
 * illustrative placeholders in prose about conventions, or addresses in
 * another repository — the coder adaptor specs cite `src/adaptors/`, which is
 * real in Falese/coder.
 */
const NOT_IN_THIS_REPO = [
  /^src\/features\//,
  /^src\/platform\//,
  /^src\/slots\.(ts|tsx)$/,
  /^src\/(index|App|remote|main|bootstrap)\.(ts|tsx)$/,
  /^src\/app\//,
  /^src\/commands\/topic\//,           // the naming convention, spelled out
  /^packages\/(config|telemetry)$/,     // proposed, not yet created
  /^src\/adaptors\//,                   // coder's tree, not this one
];

/**
 * Build output. Absent from a clean checkout and present after a build, so its
 * existence says nothing about whether a citation is correct — and checking it
 * would make this gate pass locally and fail in CI, which is the one thing a
 * gate must never do.
 */
const BUILD_OUTPUT = /(^|\/)(dist|node_modules|coverage|_site|out-tsc|\.mesh)(\/|$)/;

const CITATION = /`([^`\n]+)`/g;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

/** Strip what a citation may carry beyond the path itself. */
function normalize(raw) {
  let p = raw.trim();
  p = p.split(/[\s(]/)[0];          // "src/x.ts (see …)"
  p = p.split('#')[0];              // "docs/spec.md#adr-index"
  p = p.replace(/:[0-9–\-,]+$/, ''); // "src/x.ts:382–416"
  p = p.replace(/[.,;:]$/, '');
  return p;
}

/**
 * A citation using <angle brackets> is naming a convention, not a file:
 * `src/commands/<topic>/<cmd>.ts` is how command sources are laid out, and no
 * such file is meant to exist.
 */
function isPlaceholder(p) {
  return p.includes('<') || p.includes('>');
}

/** A brace expansion names several real paths: `templates/{a,b}/`. */
function expand(p) {
  const m = p.match(/^(.*)\{([^}]+)\}(.*)$/);
  if (!m) return [p];
  return m[2].split(',').map((part) => `${m[1]}${part.trim()}${m[3]}`);
}

function resolves(p) {
  if (p.includes('*')) {
    // A glob is satisfied when the directory it globs inside exists. Cut at the
    // last separator before the wildcard, so `templates/base-mfe/slots.*.ejs`
    // asks about `templates/base-mfe` rather than about `…/slots.`.
    const head = p.split('*')[0];
    const base = head.slice(0, head.lastIndexOf('/')).replace(/\/$/, '');
    return base === '' || fs.existsSync(path.join(repoRoot, base));
  }
  return fs.existsSync(path.join(repoRoot, p.replace(/\/$/, '')));
}

const problems = [];
let checked = 0;

for (const file of walk(path.join(repoRoot, 'docs'))) {
  const rel = path.relative(repoRoot, file);
  if (HISTORICAL.some((re) => re.test(rel))) continue;

  const text = fs.readFileSync(file, 'utf8');
  const seen = new Set();
  let m;
  CITATION.lastIndex = 0;
  while ((m = CITATION.exec(text)) !== null) {
    for (const candidate of expand(normalize(m[1]))) {
      if (!ROOTS.some((r) => candidate.startsWith(r))) continue;
      if (isPlaceholder(candidate)) continue;
      if (BUILD_OUTPUT.test(candidate)) continue;
      if (NOT_IN_THIS_REPO.some((re) => re.test(candidate))) continue;
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      checked += 1;
      if (!resolves(candidate)) problems.push(`${rel}: ${candidate}`);
    }
  }
}

if (problems.length > 0) {
  console.error(`check-doc-paths: ${problems.length} citation(s) point at paths that do not exist\n`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error(
    '\nEither correct the path, or — if it is a path inside a generated MFE rather ' +
      'than in this repository — add it to NOT_IN_THIS_REPO in scripts/check-doc-paths.js.\n',
  );
  process.exit(1);
}

console.log(`check-doc-paths: OK — ${checked} repository path citation(s) checked, 0 broken.`);
