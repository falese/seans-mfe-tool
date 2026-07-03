[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / moduleFederationAdaptor

# Variable: moduleFederationAdaptor

> `const` **moduleFederationAdaptor**: [`ExperienceAdaptor`](../interfaces/ExperienceAdaptor.md)

Defined in: [packages/runtime/src/layout-adaptors.ts:223](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-adaptors.ts#L223)

module-federation — the imperative-island provider (ADR-056). Loads the
remote container, then composes via the MFE's **presentation handle**: it
consumes the sealed port (`handle.mount(element, props) → unmount`) and
owns the slot element and teardown. The MFE no longer decides where it
renders. Framework-independent: any remote (React, Angular) that exposes
the imperative handle mounts here as an isolated island.

Resolution order for what the remote exposes:
  1. `handles` (PresentationHandles) — consume `handles.imperative`
  2. `mount` (ImperativeMountHandle) — consume it directly
  3. legacy `{ mfe, mfeReady }` bootstrap — adapted in place (migration)

(The optional native-component handle is consumed by the React in-tree
provider, a deferred follow-up — not by this island provider.)
