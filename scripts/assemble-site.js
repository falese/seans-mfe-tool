#!/usr/bin/env node
/**
 * assemble-site.js — build the GitHub Pages payload from docs/.
 *
 *   node scripts/assemble-site.js _site
 *
 * Run this AFTER the slide deck build, so it can see whether the deck was
 * actually produced.
 *
 * The system map is the point of the site; the slide deck is a bonus that
 * needs a third-party CLI (Marp) and a headless browser to produce. Those are
 * the most failure-prone steps in the pipeline, and they must not be able to
 * take the map down with them. So:
 *
 *   - The map and the landing page are copied unconditionally.
 *   - If the deck is missing, the landing page's deck card is removed rather
 *     than left pointing at a file that was never published. A dangling link
 *     would fail check-site.js — correctly, since it would 404 for readers.
 *
 * The card is delimited in docs/index.html by <!-- deck-card:start --> and
 * <!-- deck-card:end -->; the markers are always stripped from the output.
 *
 * Plain Node with no dependencies on purpose: the Pages workflow publishes
 * static HTML and never runs `npm ci`.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const outDir = path.resolve(process.argv[2] || '_site');
const docs = path.join(repoRoot, 'docs');

const DECK = 'slides/platform-architecture.html';
const START = '<!-- deck-card:start -->';
const END = '<!-- deck-card:end -->';

/** GitHub Actions renders these as annotations; harmless locally. */
const warn = (msg) => console.log(`::warning::${msg}`);

fs.mkdirSync(path.join(outDir, 'slides'), { recursive: true });

// ---- the system map: copied verbatim, always ----
fs.copyFileSync(path.join(docs, 'system-map.html'), path.join(outDir, 'system-map.html'));

// ---- the landing page: deck card kept only if the deck exists ----
let landing = fs.readFileSync(path.join(docs, 'index.html'), 'utf8');

const startAt = landing.indexOf(START);
const endAt = landing.indexOf(END);
if (startAt === -1 || endAt === -1 || endAt < startAt) {
  console.error(
    `assemble-site: docs/index.html is missing the ${START} / ${END} markers ` +
      'around the slide-deck card. Restore them, or update this script.',
  );
  process.exit(1);
}

const deckBuilt = fs.existsSync(path.join(outDir, DECK));

if (deckBuilt) {
  // Keep the card, drop only the markers.
  landing = landing.replace(START, '').replace(END, '');
} else {
  // Drop the card entirely so the published page has no link to a 404.
  landing = landing.slice(0, startAt) + landing.slice(endAt + END.length);
  warn(
    'Slide deck was not built — publishing the docs site without it. ' +
      'The system map is unaffected; check the "Build slides" step for the cause.',
  );
}

fs.writeFileSync(path.join(outDir, 'index.html'), landing);

// A mistyped URL lands on the landing page instead of GitHub's generic 404.
fs.writeFileSync(path.join(outDir, '404.html'), landing);

// Nothing else should be left in slides/ if the deck failed midway.
if (!deckBuilt) {
  const slidesDir = path.join(outDir, 'slides');
  for (const entry of fs.readdirSync(slidesDir)) {
    fs.rmSync(path.join(slidesDir, entry), { recursive: true, force: true });
  }
  fs.rmdirSync(slidesDir);
}

console.log(
  `assemble-site: OK — system map + landing page published to ${path.relative(repoRoot, outDir)}; ` +
    `slide deck ${deckBuilt ? 'included' : 'OMITTED (build failed or skipped)'}`,
);
