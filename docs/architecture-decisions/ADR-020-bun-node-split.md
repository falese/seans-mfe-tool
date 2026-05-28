---
id: 0020
title: Bun for dev entry, Node for published entry — permanent split
status: Accepted
date: 2026-04-17
deciders: [sean]
enforcement: code
supersedes: []
superseded-by: []
tags: [cli, bun, node, dev-experience, publish]
summary: bin/dev.ts runs under Bun for zero-transpile development iteration; bin/run.js is the pure-Node published entry that loads compiled dist/ — these two entry points are a permanent architectural split.
rationale-summary: Bun's direct TypeScript execution eliminates the build-then-run loop during development, but the published npm package must run on Node ≥18 without requiring Bun in consumer environments.
long-form: false
---

# ADR-020: Bun for dev entry, Node for published entry — permanent split

## Context

During oclif migration (ADR-015), development velocity was slowed by needing to run `tsc` before testing CLI changes. Bun can execute TypeScript directly with no build step, but the published package targets Node.js users who may not have Bun installed.

## Decision

Maintain two permanent entry points:

- **`bin/dev.ts`** — Bun entry. Runs `src/commands/**/*.ts` directly via Bun's TypeScript runtime. Used only during local development (`bun bin/dev.ts <cmd>`). Never published.
- **`bin/run.js`** — Node entry. Loads compiled `dist/commands/**/*.js`. This is the published entry point (declared as `bin` in `package.json`).

`package.json` oclif config:
```json
{
  "bin": { "seans-mfe-tool": "./bin/run.js" },
  "oclif": { "bin": "seans-mfe-tool" }
}
```

The `bun bin/dev.ts` command is used in all local development, CI only uses `bin/run.js` after `npm run build`.

## Consequences

**Positive:**
- Zero-transpile development loop — edit a command file, run it immediately
- Published package has zero Bun dependency
- `bun bin/dev.ts` and `seans-mfe-tool` behave identically (same source, different runner)

**Negative:**
- Two entry points must stay in sync; forgetting to build before publishing breaks consumers
- `npm run build` must be run in the verification gate before every push

## References

- `bin/dev.ts`, `bin/run.js`
- ADR-015: oclif migration
