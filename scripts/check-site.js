#!/usr/bin/env node
/**
 * check-site.js — verify an assembled static site before it is published.
 *
 * Run against the directory that will become the GitHub Pages site:
 *
 *   node scripts/check-site.js _site
 *
 * Two failure modes matter for a project page served from a sub-path
 * (https://<user>.github.io/<repo>/), and this catches both:
 *
 *   1. Root-relative or broken in-site links. `/system-map.html` resolves to the
 *      user's Pages root, not the project's — so any `href`/`src` starting with
 *      `/` is rejected, and every relative link must resolve to a real file.
 *
 *   2. Externally-loaded assets. Stylesheets, scripts, images, fonts and frames
 *      must be inlined or local; a remote asset is one outage (or one blocked
 *      request) away from an unstyled page. Ordinary `<a href>` links to other
 *      sites are fine and are not checked.
 *
 * Exits non-zero with a list of problems, or prints a one-line summary.
 *
 * Plain Node with no dependencies on purpose: the Pages workflow publishes
 * static HTML and never runs `npm ci`.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(process.argv[2] || '_site');

if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
  console.error(`check-site: not a directory: ${root}`);
  process.exit(1);
}

/** Attributes that pull in an asset the browser must fetch to render the page. */
const ASSET_ATTR = /<(link|script|img|source|iframe|embed|video|audio|object)\b[^>]*?\b(?:href|src|data)\s*=\s*["']([^"']+)["']/gi;
/** Every href/src in the document, for in-site link resolution. */
const ANY_REF = /\b(?:href|src)\s*=\s*["']([^"']+)["']/gi;

const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:)?\/\//i;
const IGNORED_SCHEME = /^(?:mailto:|tel:|data:|javascript:|#)/i;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(root);
const htmlFiles = files.filter((f) => f.toLowerCase().endsWith('.html'));

if (htmlFiles.length === 0) {
  console.error(`check-site: no HTML files found under ${root}`);
  process.exit(1);
}

const problems = [];
let linksChecked = 0;
let assetsChecked = 0;

for (const file of htmlFiles) {
  const rel = path.relative(root, file);
  const html = fs.readFileSync(file, 'utf8');

  // 1. No externally-fetched assets.
  let m;
  ASSET_ATTR.lastIndex = 0;
  while ((m = ASSET_ATTR.exec(html)) !== null) {
    const [, tag, ref] = m;
    if (IGNORED_SCHEME.test(ref)) continue;
    assetsChecked += 1;
    if (EXTERNAL.test(ref)) {
      problems.push(`${rel}: <${tag}> loads an external asset — inline it instead: ${ref}`);
    }
  }

  // 2. In-site links must be relative and must resolve.
  ANY_REF.lastIndex = 0;
  while ((m = ANY_REF.exec(html)) !== null) {
    const ref = m[1];
    if (IGNORED_SCHEME.test(ref) || EXTERNAL.test(ref)) continue;

    if (ref.startsWith('/')) {
      problems.push(
        `${rel}: root-relative link "${ref}" breaks under a project-pages sub-path — make it relative`,
      );
      continue;
    }

    const target = ref.split('#')[0].split('?')[0];
    if (!target) continue; // pure fragment or query

    linksChecked += 1;
    const resolved = path.resolve(path.dirname(file), decodeURIComponent(target));
    const candidate = resolved.endsWith('/') ? path.join(resolved, 'index.html') : resolved;

    const exists =
      fs.existsSync(candidate) ||
      (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory() &&
        fs.existsSync(path.join(resolved, 'index.html')));

    if (!exists) {
      problems.push(`${rel}: link "${ref}" does not resolve to a published file`);
    }
  }
}

if (problems.length > 0) {
  console.error(`check-site: ${problems.length} problem(s) in ${root}\n`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error('');
  process.exit(1);
}

console.log(
  `check-site: OK — ${htmlFiles.length} page(s), ${linksChecked} in-site link(s), ` +
    `${assetsChecked} asset reference(s), 0 problems`,
);
