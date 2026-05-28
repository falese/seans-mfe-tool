---
id: 0011
title: GeneratedFrom Traceability
status: Implemented
date: 2025-12-13
deciders: [sean]
enforcement: code
supersedes: []
superseded-by: []
tags: [dsl, data, traceability, lineage]
summary: The DSL data section includes a generatedFrom field that records the source API specifications and versions that the data types were derived from, enabling impact analysis and regeneration workflows.
rationale-summary: Tracking data lineage in the DSL enables the registry to answer dependency questions (which MFEs use this API?) and supports automated regeneration when upstream APIs change.
long-form: true
---

# ADR-011: GeneratedFrom Traceability

## Context

MFE data types are often generated from upstream API specifications (OpenAPI, GraphQL SDL, Protobuf). Without recording the source, there is no way to answer "which MFEs are affected by a change to the Orders API?" or to regenerate a MFE's types when an API version changes.

## Decision

The DSL `data:` section includes an optional `generatedFrom` array. Each entry records the specification type, file path or URL, the upstream service name, and the version.

```yaml
data:
  generatedFrom:
    - openapi: ./specs/api.yaml
      service: analysis-api
      version: 2.1.0
    - openapi: https://orders.internal/swagger.json
      service: orders-api
      version: 3.0.0
```

**Registry use cases enabled:**

- "Which MFEs use this API?" — query by `service` name
- "Which MFEs share data sources?" — query by `openapi` path
- Impact analysis when an API changes
- Triggering regeneration workflows for affected MFEs

## Consequences

**Positive:**
- Registry can answer upstream dependency questions
- Enables automated regeneration workflows
- Provides data lineage documentation in the manifest itself

**Negative:**
- Teams must keep `generatedFrom` in sync with their actual source specifications
- Version fields require discipline to keep accurate

## References

- DEC-024
- REQ-053
- ADR-012: GraphQL Mesh BFF Layer (BFF uses `generatedFrom` to track OpenAPI sources)
- ADR-008: Data Type Metadata
