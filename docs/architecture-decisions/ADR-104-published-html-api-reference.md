---
id: 0104
title: >-
  The docs site publishes an HTML API reference under /api/, built at publish time from the same
  TypeDoc config as the committed Markdown, which stays the version reviewed in pull requests
status: Implemented
date: 2026-09-25
deciders: [sean]
area: Docs / tooling / publishing
enforcement: tooling
tags: [docs, api, typedoc, pages, publishing]
relates-to: [65]
supersedes: [65]
superseded-by: []
implements-pdr: []
implemented-by:
  - typedoc.html.json
  - scripts/assemble-site.js
  - .github/workflows/pages.yml
  - docs/index.html
verified-by:
  - scripts/__tests__/assemble-site.test.ts
  - scripts/check-site.js
summary: >-
  The Pages workflow now builds TypeDoc's HTML theme into /api/ and the landing page links to it,
  so the API reference is browsable and searchable on the published site. It is generated from
  typedoc.json through typedoc.html.json, which only swaps the Markdown plugin for the HTML theme,
  so it cannot describe a different API from docs/api. The HTML is built at publish time and never
  committed. The committed Markdown and its drift gate are unchanged and remain what a pull request
  diffs. The build is non-fatal: if it fails, assemble-site.js drops the API card, as it already
  does for the slide deck, and check-site.js verifies every generated page like any other.
rationale-summary: >-
  ADR-065 rejected TypeDoc HTML "for now" because it is not diffable and needs hosting, and noted
  that HTML "can be layered on later from the same config". Hosting now exists: the Pages site
  publishes the system map, the architecture pages and the deck, and it had no API reference. The
  diffability concern is met by not committing the HTML at all. Generating it at publish time
  keeps review on the Markdown and adds nothing to the repository.
long-form: true
---

## Context

ADR-065 generates the API reference for `contracts`, `dsl`, `codegen` and `runtime` as Markdown in
`docs/api/`, gated in CI so it cannot go stale. It considered TypeDoc's HTML output and rejected it
for two reasons: HTML is not diffable in a pull request, and it needs somewhere to be hosted. It
left the door open: "HTML can be layered on later from the same config."

Since then the repository gained a GitHub Pages site (`pages.yml`, `assemble-site.js`,
`check-site.js`) with a landing page linking the system map, the architecture schematics and the
slide deck. The API reference was not on it. A reader of the published site had no way to reach it
except by leaving for the repository and reading Markdown without search.

## Decision

**The published site carries an HTML API reference at `/api/`, generated in the Pages workflow from
the same TypeDoc configuration as `docs/api/`, and never committed.**

### 1. One configuration, two renderers

`typedoc.html.json` extends `typedoc.json` and changes only what differs for the web: no Markdown
plugin (so TypeDoc's HTML theme applies), and navigation links back to the site. Entry points,
exclusions and source links are inherited, so the HTML and the Markdown always describe the same
exports. `npm run build:docs:html` builds it locally into `_site/api/` (gitignored).

### 2. Built at publish time, not committed

The Pages workflow installs dependencies, builds the workspace packages (as `api-docs.yml` does) and
runs TypeDoc into `_site/api/`. The HTML never enters the repository, which answers ADR-065's
diffability concern: pull requests still review the Markdown, and `build:docs:check` still gates it.

### 3. Optional, like the deck

The three steps are non-fatal. `assemble-site.js` keeps the landing page's API card only when
`api/index.html` exists, using the same marker mechanism as the deck card, generalised to a list of
optional cards. A TypeDoc failure publishes the site without the card instead of blocking the
system map, and never publishes a link to a missing page.

### 4. Checked like every other page

`check-site.js` walks every generated page: no externally loaded asset and no broken in-site link.
TypeDoc's HTML theme ships its own CSS, JS and search index, so it passes as generated. Its
navigation links are absolute URLs to the published site because TypeDoc repeats them verbatim on
pages at every depth, where a relative link breaks. The checker caught that on the first build.

## Boundaries

- **This supersedes ADR-065 in part.** Only its rejection of TypeDoc HTML is
  replaced; ADR-065 stays `Implemented`, and its Markdown reference, drift gate
  and workflow stand unchanged. ADR-065 records the link back (`superseded-by`
  and a note under that alternative), following the ADR-056 / ADR-060 precedent.
- **The Markdown stays the reviewed artifact.** Nothing here changes `docs/api/`, `build:docs`, its
  drift gate or the API-docs workflow.
- **Same packages as ADR-065.** Adding a package to the reference is a `typedoc.json` change and
  reaches both outputs.
- **No versioned reference.** `/api/` always shows the current `main`.
- **Local previews link to the live site.** The navigation links are absolute, so "Documentation
  home" in a local build opens the published site.

## Consequences

Better: the API reference is one click from the landing page, searchable and cross-linked, and it
cannot drift from the code or from the committed Markdown.

Worse, and accepted:

- **A slower Pages job.** It now runs `npm ci`, `build:packages` and TypeDoc, about a minute, where
  it previously installed only Marp.
- **More published pages.** About 420 HTML pages and 8.5 MB, all checked by `check-site.js` on
  every publish.
- **The Pages workflow runs on more changes.** Changes to the four packages' sources and the TypeDoc
  configs now trigger it, so the published reference follows the code.

## References

- ADR-065 — the generated API reference; superseded in part: its "HTML rejected for now" is what this replaces, from the same config.
