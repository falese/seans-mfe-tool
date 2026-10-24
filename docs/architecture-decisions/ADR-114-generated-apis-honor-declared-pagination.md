---
id: 0114
title: >-
  A generated list endpoint pages the way its spec declares — the page-size parameter, its
  default, and offset or 1-based page — and keeps the old behavior only where the spec is silent
status: Implemented
date: 2026-10-12
deciders: [sean]
area: API generation / controllers / pagination
enforcement: code
tags: [api-generation, openapi, pagination, plugin-api, correctness]
relates-to: [63]
supersedes: []
superseded-by: []
implements-pdr: [1]
implemented-by:
  - packages/plugin-api/src/APIGenerator/ControllerGenerator/adapters/DatabaseAdapter.js
  - packages/plugin-api/src/APIGenerator/ControllerGenerator/generators/ImplementationGenerator.js
verified-by:
  - packages/plugin-api/src/APIGenerator/ControllerGenerator/__tests__/DatabaseAdapter.test.js
  - packages/plugin-api/src/APIGenerator/ControllerGenerator/__tests__/ImplementationGenerator.test.js
tracked-by: ["#428"]
summary: >-
  The API generator emitted `parseInt(req.query.limit) || 10` for every list operation, in both
  database adapters, without reading the operation. Specs that declared a different default, a
  page-size parameter not named `limit`, or 1-based page numbering were silently ignored, and
  lists were cut at 10 rows. The generator now reads each list operation's query parameters: a
  page-size parameter (`limit`, `pageSize`, `page_size`, `per_page`) with its declared default,
  and either an offset (`offset`, `skip`) or a 1-based page (`page`) turned into an offset. Where
  the spec declares nothing, the emitted query is unchanged.
rationale-summary: >-
  The spec is the contract the generator exists to implement. Hardcoding a page size the spec
  does not state broke it silently: four of meridian-station's lists lost rows with every gate
  green. Honoring only what the spec says, and changing nothing where it is silent, fixes those
  without changing any API whose spec never mentioned paging.
long-form: true
---

## Context

`DatabaseAdapter.generateFindQuery` received only the path, so it could not see the
operation's parameters. Both adapters emitted the same list query:

```js
limit: parseInt(req.query.limit) || 10,   // SQLite
.limit(parseInt(req.query.limit) || 10)   // Mongo
```

meridian-station's three backends declare paging three ways, and none was honored:

| Backend | Spec declares | Generated |
|---|---|---|
| Harbormaster | `limit` default 50, `offset` | `limit \|\| 10` |
| StationOS | `PageSize` default 20, `Page` (1-based) | `limit \|\| 10` |
| StellarLedger | `pageSize` default 25 | `limit \|\| 10` |

Dockings (12 rows), charges (12), certifications (12) and telemetry (16) all came back as 10.
The traffic log, the docking board's amounts due, the crew roster and the life-support
screens each lost data, and the decomposition reference app (#412) inherited it (#428).

## Decision

### 1. The operation reaches the adapter

`ImplementationGenerator.generate` passes the operation to `generateFindQuery`, which reads
its `in: query` parameters. Item lookups (paths with a parameter) are unaffected.

### 2. Recognized parameters

Names match case-insensitively:

- **page size:** `limit`, `pageSize`, `page_size`, `per_page`, `perPage`
- **offset:** `offset`, `skip`
- **1-based page:** `page`, `page_number`, `pageNumber`

### 3. Emitted query

- Page size: the declared parameter, falling back to its declared `default`.
- Offset: the declared offset parameter with its default, or `(page - 1) * size` for a
  declared page parameter (default 1).

### 4. Silence means unchanged

- No page-size parameter declared: the old query, byte for byte.
- A page size with no default: falls back to 10.
- A page size but no offset or page parameter: offset is still read from `offset`, as before,
  so callers relying on it are not broken.

## Boundaries

- Cursor pagination is not implemented. A spec declaring a cursor gets offset-free first-page
  behavior; the cursor itself is the API author's to implement.
- Response envelopes are hand-written per API (meridian's are deliberately inconsistent,
  PDR-007) and are not generated or touched here.
- Already-generated APIs do not change by themselves. This change updated meridian's three APIs
  and the petstore example to the new output.

## Consequences

Generated list endpoints now match their specs, and meridian shows complete data. Because a
silent spec keeps the old query, the cost is a narrow behavior change: only APIs whose specs
declare paging are affected.

## References

- ADR-063 — API generation as a plugin axis; this corrects what that plugin emits.
- #428 — the bug, with the measured impact on meridian-station.
