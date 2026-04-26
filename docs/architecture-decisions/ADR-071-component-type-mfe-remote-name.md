---
id: "0071"
title: "Component.type equals the Module Federation remote name for dynamic MFE routing"
status: Accepted
date: 2026-04-26
deciders: [falese]
enforcement: review-only
supersedes: []
superseded-by: []
tags: [module-federation, routing, registry, shell]
summary: "Registry rules emit a Component where the 'type' field equals the Module Federation remote name; the shell renderer loads that MFE with window[type].get('./App')."
rationale-summary: "Equating Component.type to the remote name eliminates a separate routing table: registry rules double as both business-logic triggers and MFE routing directives, and the renderer needs no extra configuration to resolve a remote entry."
long-form: true
enforcer-config: {}
---

# ADR-0071: `Component.type` = Module Federation remote name for dynamic MFE routing

## Context

The shell renderer (MFERenderer) receives `Component` envelopes from the daemon. It must know **which MFE to load** and **where to fetch it from**. Two strategies were considered:

| Strategy | Notes |
|---|---|
| Separate routing table (name → remoteEntry URL) | Shell config must be updated whenever a new MFE is added; static coupling |
| **`Component.type` = remote name; `Component.data.remoteEntry` = URL** | Registry rules carry both the semantic intent and the load hint in one envelope; shell needs no static config |

## Decision

### Rule contract

Registry rules generate Components with this shape:

```typescript
{
  type:      string;  // MUST equal the Module Federation global scope name
                      // e.g. 'csv-analyzer', 'report-viewer'
  data: {
    remoteEntry: string; // URL to the remote's remoteEntry.js
                         // e.g. 'http://localhost:3002/remoteEntry.js'
    // ...additional props forwarded as-is to the MFE component
  }
}
```

`type` is the same string used in the remote's `ModuleFederationPlugin` config:

```javascript
// Remote's rspack.config.js (or webpack)
new ModuleFederationPlugin({
  name: 'csv-analyzer',   // ← must match Component.type
  filename: 'remoteEntry.js',
  exposes: { './App': './src/App.tsx' },
})
```

### Renderer load sequence

`MFERenderer` executes these steps when it receives an `ActiveMFE`:

1. Inject `<script src={mfe.remoteEntry}>` into `document.head` (idempotent; skipped if URL already loaded).
2. `await __webpack_init_sharing__('default')` — initialises the shared scope.
3. `await window[mfe.type].init(__webpack_share_scopes__.default)` — registers singleton deps.
4. `const factory = await window[mfe.type].get('./App')` — fetches the component factory.
5. `const Component = factory()` — instantiate the lazy component.
6. Render inside `<Suspense>` with props from `mfe.data`.

### Fallback

If `remoteEntry` is not present in `Component.data`, the registry falls back to the `REMOTE_MFE_DEFAULT_URL` environment variable (default `http://localhost:3002/remoteEntry.js`). This allows local development without routing table config.

### Example rule

```typescript
registry.addRule('task-complete', {
  condition: (_state, action) =>
    action.actionType === 'task.complete' &&
    typeof action.data?.nextMFE === 'string',
  generate: (_state, action) => ({
    type: action.data.nextMFE,           // e.g. 'report-viewer'
    data: {
      ...action.data,
      remoteEntry: action.data.remoteEntry ??
        process.env.REMOTE_MFE_DEFAULT_URL,
    },
  }),
});
```

## Consequences

### Positive
- Registry rules are self-contained routing directives; no external routing table to synchronise.
- MFEs can be loaded at runtime from any URL without rebuilding the shell.
- The convention works with both webpack and rspack `ModuleFederationPlugin` (identical `name` field).
- `data` passthrough means registry rules can forward arbitrary props to the loaded MFE without shell involvement.

### Negative
- `Component.type` is an untyped string; a typo in a rule silently produces a runtime `window[type] is undefined` error in the browser. Mitigation: validate `type` against a registry of known remotes at rule-evaluation time (future enhancement).
- `remoteEntry` URL must be reachable from the browser; dynamic URLs that change between environments require the rule (or the remote MFE itself) to inject the correct URL via `REMOTE_MFE_DEFAULT_URL`.
- Loading a `<script>` tag from an untrusted remote is an XSS vector. Remotes must be explicitly registered; the registry should enforce an allowlist of known `remoteEntry` origins.

## Related

- ADR-007: Module Federation loading pattern (agent orchestrator design)
- ADR-069: Four-tier daemon-native control plane
- ADR-071 is the runtime routing convention that makes ADR-069's data flow complete.
- `src/codegen/templates/shell/src/shell/MFERenderer.tsx.ejs`
- `src/codegen/templates/shell/orchestration/registry/mfe-registry.ts.ejs`
