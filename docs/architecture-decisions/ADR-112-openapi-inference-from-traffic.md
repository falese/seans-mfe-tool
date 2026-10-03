---
id: 0112
title: >-
  When a backend has no spec, the toolchain infers an OpenAPI document from recorded traffic and
  client code, marks it inferred, and the BFF consumes it like any other source
status: Proposed
date: 2026-10-03
deciders: [sean]
area: Decomposition / BFF / specs
enforcement: tooling
tags: [decomposition, openapi, bff, inference, mesh]
relates-to: [52, 92, 109, 110]
supersedes: []
superseded-by: []
implements-pdr: [11]
implemented-by: []
verified-by: []
tracked-by: ["#410", "#415", "#418"]
summary: >-
  BFF generation consumes OpenAPI specs through the manifest's `data.sources`; nothing in the
  toolchain produces one. For each backend observed in the evidence bundle, `decompose:propose`
  infers an OpenAPI 3 document from the recorded requests and responses, refined by the
  monolith's client code (paths, parameters, types). The document is marked inferred and
  carries the observations it came from. An existing real spec always wins over an inferred one.
rationale-summary: >-
  Monolith backends often have no spec or a stale one, and the BFF cannot be generated without
  one. Inferring from observed traffic gives a spec that matches what the app actually uses,
  which is also exactly what the contract tests must hold the BFF to.
long-form: true
---

## Context

`@seans-mfe/plugin-bff` builds the mesh from OpenAPI `data.sources`. `api` and `bff:*` consume
specs; no command emits one. PDR-011 decomposes apps whose backends are rarely specified.

## Decision

### 1. Infer per observed backend

Group recorded calls by origin and path template; derive operations, parameters and schemas
from observed requests and responses; refine with types and paths read from client code.

### 2. Mark it inferred and keep provenance

The document carries an `x-smt-inferred` marker and references to the bundle observations
behind each operation, so a reviewer can see what is guessed and from what.

### 3. A real spec wins

If the backend publishes a spec, it is used and the inferred one only reports differences.

### 4. Contract tests hold the BFF to the observations

Recorded traffic plus the inferred spec generate BFF connector tests (ADR-113).

## Boundaries

- Only operations the journeys exercised are inferred; the spec is a lower bound.
- Inference does not rename or reshape backend APIs; taming them is the BFF's job (PDR-007).

## Consequences

BFFs can be generated for unspecified backends, with specs grounded in real use. The cost is
inference quality on sparse samples, which the provenance markers make visible.

## References

- PDR-011 — the product decision this serves.
- ADR-052 — recorded responses also feed the mock switch.
- ADR-092 — how mesh sources are classified and resolved.
- ADR-109 — the recorded traffic this reads.
- #415, #418 — propose and the contract tests.
