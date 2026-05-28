---
id: 0007
title: Authorization Expression Grammar
status: Deferred
date: 2025-12-13
deciders: [sean]
enforcement: code
supersedes: []
superseded-by: []
tags: [authorization, dsl, deferred]
summary: Authorization expressions in the DSL will support AND/OR/NOT Boolean logic with atoms for user identity, roles, permissions, and resource ownership — but this feature is deferred to a separate requirements document.
rationale-summary: The authorization expression grammar is complex enough to warrant its own requirements elicitation and design session rather than being designed as an incidental part of the DSL contract.
long-form: true
---

# ADR-007: Authorization Expression Grammar

## Context

DSL capability definitions reference authorization expressions (e.g., `authorization: user.authenticated`). A full authorization grammar supporting complex access rules (role-based, ownership-based, permission-based with Boolean composition) is needed to make the DSL authoritative for access control.

This decision is explicitly deferred — the design has not been completed.

## Decision

**DEFERRED.** This will become a separate feature with its own requirements document.

**Placeholder grammar (subject to change when the feature is designed):**

Expressions will support:

- Boolean operators: `AND`, `OR`, `NOT`
- Atoms:
  - `user.authenticated` — user has a valid session
  - `user.role.<role>` — user has a named role
  - `user.permission.<perm>` — user has a specific permission
  - `user.owns.resource` — user owns the target resource

Example (placeholder syntax):

```yaml
authorization: user.authenticated AND (user.role.admin OR user.owns.resource)
```

No implementation should proceed until the separate requirements document is completed and a new ADR is created to supersede this placeholder.

## Consequences

**Positive:**
- Complex authorization rules expressible in DSL
- Single source of truth for access control

**Negative:**
- Feature is not yet designed — implementation blocked
- Placeholder grammar may change significantly

## References

- REQ-048 (deferred)
- ADR-019: JWT-Based Authorization (current approach while this is deferred)
