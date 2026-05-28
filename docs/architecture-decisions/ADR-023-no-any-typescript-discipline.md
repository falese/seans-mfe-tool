---
id: 0023
title: No-any TypeScript discipline — use unknown and narrow
status: Accepted
date: 2026-04-18
deciders: [sean]
enforcement: convention
supersedes: []
superseded-by: []
tags: [typescript, type-safety, contracts, code-quality]
summary: The any type is forbidden in all src/ and packages/ code; unknown is used at system boundaries and narrowed via type guards or Zod parse before use.
rationale-summary: any types propagate unsafety silently — a single any can suppress errors across an entire call chain; unknown forces explicit narrowing at the boundary and keeps the type system honest everywhere else.
long-form: false
---

# ADR-023: No-any TypeScript discipline — use unknown and narrow

## Context

The TypeScript configs use `"strict": false` to allow gradual migration from the legacy JavaScript codebase (ADR-014). However, `strict: false` still allows `any`, which defeats much of TypeScript's value. The codebase defines a stricter convention than the compiler enforces.

## Decision

In all `src/` and `packages/` TypeScript code:

- `any` is forbidden — the linter flags it, code review rejects it
- At system boundaries (external API responses, `process.env`, `JSON.parse`): use `unknown`, then narrow with a Zod schema or type guard
- Zod is the primary narrowing tool for user-facing inputs and external data
- Internal code that is fully typed never needs `any`

Example:
```typescript
// Wrong
const result: any = JSON.parse(stdout);

// Right
const raw: unknown = JSON.parse(stdout);
const result = CommandResultSchema.parse(raw); // Zod throws if invalid
```

Exception: `// eslint-disable-next-line @typescript-eslint/no-explicit-any` with a comment explaining why is permitted for unavoidable interop with legacy JS modules (rare).

## Consequences

**Positive:**
- Type errors surface at narrow points (boundaries), not silently downstream
- Zod parse at boundaries provides runtime validation and compile-time types simultaneously
- AI agents reading the code see full types everywhere — no hidden `any` gaps

**Negative:**
- More upfront work to narrow types at boundaries
- Some third-party library types leak `any` — those require explicit casts at the interop boundary

## References

- `packages/contracts/src/` (all types are explicit)
- ADR-017: Typed error hierarchy (same discipline applied to errors)
