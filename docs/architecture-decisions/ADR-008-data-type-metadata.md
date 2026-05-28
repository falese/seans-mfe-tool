---
id: 0008
title: Data Type Metadata
status: Implemented
date: 2025-12-13
deciders: [sean]
enforcement: code
supersedes: []
superseded-by: []
tags: [dsl, types, metadata, registry]
summary: DSL type definitions carry owner and tags metadata fields to support registry search, documentation tooling, and future access control.
rationale-summary: Owner attribution and custom tags enable registry-based discovery of types by owning team and semantic category, which is the primary value driver for a shared type system.
long-form: true
---

# ADR-008: Data Type Metadata

## Context

In a multi-team platform, types defined in one MFE may be consumed by others. Without metadata, it is impossible to answer "who owns this type?", "which types are PII?", or "find all GDPR-relevant types". Registry search is only as useful as the metadata attached to types.

## Decision

All custom type definitions in the DSL `types:` section include optional `owner` and `tags` metadata. Tags are team-defined vocabulary strings.

```yaml
types:
  - CustomerRecord:
      owner: customer-team
      tags: [pii, gdpr-relevant]
      fields:
        - id: ID!
        - email: email
        - name: string
```

**Primary use cases for metadata:**

1. Registry search — find all types tagged `pii`
2. Impact analysis — find all MFEs using types owned by `customer-team`
3. Future ACL — use `owner` to restrict which teams can modify the type

## Consequences

**Positive:**
- Registry search enables type discovery across the platform
- Owner attribution enables future access control and impact analysis
- Tags are flexible — teams define their own vocabulary

**Negative:**
- Metadata is only as valuable as the discipline teams apply in tagging
- `owner` field is informational only until ACL is implemented

## References

- DEC-021
- REQ-049
- ADR-006: Unified Type System
- ADR-007: Authorization Expression Grammar (future ACL using owner)
