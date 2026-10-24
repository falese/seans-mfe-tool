---
id: 0115
title: >-
  design:export renders a running UI, folds it into a normalized design tree, and emits a
  data-driven Figma plugin; the capture follows what the browser renders, not the raw DOM
status: Implemented
date: 2026-10-24
deciders: [sean]
area: Design / capture / Figma
enforcement: code
tags: [design, figma, capture, playwright, decomposition]
relates-to: [17, 109]
supersedes: []
superseded-by: []
implements-pdr: [11]
implemented-by:
  - src/commands/design/export.ts
  - src/design/page-serializer.ts
  - src/design/design-tree.ts
  - src/design/figma-plugin.ts
  - src/design/dom-capture.ts
verified-by:
  - src/design/__tests__/page-serializer.test.ts
  - src/design/__tests__/design-tree.test.ts
  - src/design/__tests__/figma-plugin.test.ts
  - src/design/__tests__/dom-capture.test.ts
tracked-by: ["#406", "#409", "#434"]
summary: >-
  `design:export <url>` loads the page in headless Chromium, serializes it in-page into flat
  records, folds them into a design tree in Node, and writes `design.json`, a reference
  screenshot, and a Figma plugin whose `code.js` replays a precomputed op list. The capture
  walks what renders — open shadow roots and slotted content, through `display: contents`
  wrappers — and keeps only what the screenshot shows. Flex layouts become auto-layout only where
  Figma can express them exactly; everything else keeps absolute coordinates.
rationale-summary: >-
  The Figma overlay that carries a decomposition proposal (PDR-011) and any later design
  capture need a faithful picture of the running UI. Keeping the in-page half dumb and every
  mapping decision in pure Node code makes the fidelity rules unit-testable, and falling back to
  absolute coordinates whenever auto-layout would be wrong trades editability for a design that
  looks like the page.
long-form: true
---

## Context

PR #406 proved the direction as a POC with no ADR: Playwright capture, a normalized tree, and
a Figma plugin. A local run against edge-case pages then confirmed eight capture and fidelity
bugs (#409): subtrees lost under `display: contents`, shadow DOM invisible, wrapped and
reversed flex rows mis-laid, opacity applied twice to text, `--no-full-page` not limiting the
capture, and a quadratic tree build. Decomposition (PDR-011, ADR-109) makes the unstamped page
capture a primary input, so these rules need to be recorded, not left in a POC.

## Decision

### 1. Three stages, one judgment layer

- **In-page serializer** (`page-serializer.ts`): self-contained, shipped via
  `fn.toString()`. It emits flat records — elements and text runs in document order, linked
  by `parentIndex` — and makes no design decisions. Its result crosses back to Node as one
  JSON string, which is an order of magnitude faster than Playwright's value-by-value transfer.
- **Design tree** (`design-tree.ts`): pure functions over the records. Culling, node kinds,
  fills, strokes, shadows, auto-layout and font collection are decided here, in one linear
  pass.
- **Figma plugin** (`figma-plugin.ts`): the tree is flattened to an op list in Node; `code.js`
  is a small generic executor over that data. The manifest declares `documentAccess:
  dynamic-page` and `networkAccess` (image fills load the page's own image URLs).

### 2. Capture what renders

- An element with an open shadow root contributes its shadow tree, not its light DOM. A
  `<slot>` contributes its assigned nodes, or its fallback content when none are assigned.
  Closed shadow roots are unreachable and stay opaque.
- Every record is `keep`, `transparent` or `cull`. A record with no box (a
  `display: contents` wrapper, a slot) or wholly outside the capture area is
  **transparent**: its children are handed to the nearest kept ancestor, in document order,
  carrying its opacity. A box that clips is culled with its subtree when it is empty or off
  screen, because nothing under it can show.
- The design holds what the screenshot shows: the viewport, or with `--full-page` the page up
  to 16,000px, with a warning when the page is taller.

### 3. Auto-layout only where it is exact

A flex container becomes Figma auto-layout when every element child flows (static or
relative, no margins). A wrapping row becomes wrapping auto-layout with `row-gap` as
counter-axis spacing. A reversed container lists its children in visual order and swaps the
flex-relative alignment keywords. Wrapping columns, `wrap-reverse`, grid and everything else
keep absolute coordinates, which is lossless.

### 4. Styles belong to the node that has them

A text run carries its typography but not its parent's opacity: the parent's frame applies it.

## Boundaries

- The plugin has run against a stub of the Figma API only. Running it in Figma desktop is
  still owed (#434).
- Gradients and multi-layer backgrounds flatten to the background color; only the first
  `box-shadow` layer is kept; `svg`, `canvas`, `iframe` and `video` are labeled placeholder
  rectangles.
- Images fill from their URL only when Figma can reach it.
- This ADR does not cover boundary attribution. Stamped regions (`data-smt-*`, #408) and the
  decomposition evidence bundle are ADR-109's.

## Consequences

`design:export` is a supported command rather than a POC, and its fidelity rules are tested
in Node without a browser. The cost is a second walk of the DOM to maintain beside the
decomposition capture; the evidence bundle (ADR-109) is expected to reuse this serializer
rather than grow its own.

## References

- PDR-011 — agent-driven monolith decomposition; the proposal's Figma overlay builds on this.
- ADR-109 — the decomposition evidence bundle.
- ADR-017 — typed errors; the generated plugin code is kept within it.
- #406 — the POC; #409 — the confirmed fidelity bugs this fixes.
