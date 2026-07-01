# Platform Architecture Comparison

**Audience:** Engineers in alignment sessions. Reference during debate — point at rows, not paragraphs.

---

## Section 1: The Three Approaches (What You Get and What You Give Up)

| Property | iframes / web components | Module Federation in-tree (shared reconciler) | This platform |
|---|---|---|---|
| **Isolation** | ✅ Full browser isolation — a crash in one frame cannot reach the parent page | ❌ Shared reconciler — an uncaught throw in any MFE can tear down the entire host tree if there is no boundary in exactly the right place | ✅ Separate React roots (islands) — a crash inside one slot cannot cascade to siblings; they share no reconciler |
| **Shared context** | ❌ Context (theme, locale, auth) does not cross frame boundaries automatically; must be manually posted and re-hydrated, leading to drift | ✅ Host `<ThemeProvider>` / `<IntlProvider>` propagates naturally because every MFE is inside the same tree | ✅ Values injected as data (`props.hostContext`); each MFE re-provides its own framework context from those values — same outcome, no shared tree |
| **Polyglot / multi-version** | ✅ Each frame is a separate execution environment; React 17 and Angular can coexist | ❌ Singleton constraint — all in-tree MFEs and the host must agree on one React version; upgrading any participant blocks the others | ✅ Each island has its own framework instance; React 17 and React 19 coexist in the same shell; the host may be Angular or plain HTML |
| **Self-healing** | ⚠️ Browser kills the frame process but the host page has limited visibility; there is no programmatic "re-resolve this slot" path | ⚠️ Error boundaries can recover within-tree, but a boundary must be placed correctly per-team; a missing boundary lets the error propagate to the host root | ✅ Slot-scoped fallback on any lifecycle or render error; `SLOT_ERROR` escalation to the registry triggers re-resolution to an alternate MFE; blast radius is always one slot |
| **Independent deploy** | ✅ Each MFE is a URL; shell and MFE deploy independently with no shared build | ❌ Shared React singleton means any React version bump in any participant must be coordinated; true independent deploy is fiction | ✅ Each MFE has its own framework instance and version; shell and MFE deploy on independent schedules with no negotiation |
| **Generic host** | ✅ Host is just an HTML page with `<iframe>` elements | ❌ Host must be React to own the shared context tree; an Angular or plain-HTML host cannot be the root of a React provider tree | ✅ Host is framework-neutral; LayoutManager has zero UI-framework imports; a React shell, an Angular shell, or a plain HTML page can all host MFEs equally |

---

## Section 2: Before → After (What Changes)

| Concern | React-only / in-tree (old model) | Target architecture (Contextualized VM) |
|---|---|---|
| **How context reaches an MFE** | MFE is rendered inside the host's React tree; `useTheme()`, `useIntl()`, `useAuth()` read from the host's providers automatically | Host injects plain-data values as `props.hostContext`; MFE re-establishes its own `<ThemeProvider>` / `<IntlProvider>` from those values inside its own isolated root |
| **What React version an MFE uses** | Must match the host's singleton React version; upgrading is a cross-team coordination event | The MFE's own version; bumping from React 18 to React 19 is the MFE team's decision, requires no shell change, and takes effect on the MFE's next deploy |
| **What happens when an MFE crashes** | Propagates up the shared reconciler tree until an error boundary catches it; if no boundary is correctly placed, the whole host crashes | The island's own error boundary catches it; reports out via `reportError`; LayoutManager tears down that slot and renders a neutral fallback; siblings are untouched |
| **How a new framework is added** | Not possible without a different architectural approach; Angular MFE inside a React host requires separate composition machinery | Publish a new framework plugin package (`@seans-mfe/framework-<name>`); implement the imperative `mount(element, props) → unmount` handle; no core platform change |
| **What the shell imports from an MFE** | The MFE's React components, directly; the shell renders them inside its own tree | Nothing from the MFE at compile time; the shell receives a `remoteEntryUrl` from the registry at runtime and loads the MFE's bootstrap dynamically |
| **Who handles theme / locale / auth** | The host's shared providers handle all of it; MFEs are consumers of the host's tree | The host supplies values; each MFE owns its own providers; the MFE author is responsible for reading `hostContext` and re-providing inside their root |
| **How loading / error states are shown** | React `<Suspense>` boundaries and error boundary components, which must be inside the shared tree | `data-slot-state` attribute on each slot (`pending` / `ready` / `error`); host chrome reads this to show skeletons or fallbacks; no React Suspense required at the composition layer |

---

## Section 3: The Four Things That Cross the Boundary (and Nothing Else)

| Name | Direction | What it is | What it is NOT |
|---|---|---|---|
| **Capability contract** | Control plane → MFE | The ten neutral lifecycle methods: `load`, `authorize`, `render`, `health`, `emit`, `query`, `describe`, `schema`, `updateControlPlaneState`. The platform calls these; the MFE implements them. | A React API, an Angular API, or anything framework-specific. The contract has no UI framework imports. An Angular MFE and a React MFE satisfy the same contract. |
| **Presentation handle** | MFE → host provider | The imperative `mount(element, props) → unmount` function. Every MFE exposes this as the guaranteed floor. An optional `NativeComponentHandle` (framework-tagged component) is a latent type; it is not built and is not the integration strategy. | An exported React component the host renders inside its own tree. Receiving the handle does not give the host access to the MFE's internals. The host never calls `createRoot`; the MFE's `mount` does. |
| **Injected values (`props.hostContext`)** | Host → MFE | Plain data: theme tokens, locale string, auth claims, feature flags, router state. Arrives as a prop at the MFE's mount point. The MFE reads and re-provides inside its own root. | A React context object, a shared provider reference, or anything that implies a shared reconciler. It is a plain JavaScript object — a configmap, not a tree injection. |
| **Error reports** | MFE → LayoutManager | A neutral `reportError(error, { phase })` callback injected by the host adaptor. The MFE's framework error boundary routes here; the manager receives a plain Error and phase string. | A framework error boundary wrapping the MFE from the outside. The manager never imports React's `ErrorBoundary`; it only receives the neutral report after the MFE's own boundary has caught and processed the error. |

---

## Section 4: The Escalation Chain (Self-Healing Sequence)

What happens, step by step, when an MFE slot errors:

1. The MFE throws mid-render (either during a lifecycle capability call, or inside its own component tree after mount). If it is a post-mount render throw, the island's own framework error boundary catches it — it cannot cascade to sibling slots because the islands are separate roots.

2. The island emits the error via `reportError(error, { phase })`. This is a framework-neutral callback; no React types cross the boundary. The MFE's `doEmit()` routes there through `BaseMFE.emit()`.

3. The LayoutManager receives the report. It tears down the failing slot's mount. It renders a neutral fallback element into that slot only. The fallback is the adaptor's neutral output — no framework dependency. Sibling slots are untouched.

4. The slot is marked `data-slot-state="error"`. Host chrome that watches this attribute can show a skeleton, a "temporarily unavailable" message, or any framework-neutral replacement without needing React Suspense.

5. The LayoutManager emits a `SLOT_ERROR` action up the control plane, via the `BaseControlPlane` integration point, if the slot has not yet reached the escalation cap (default: 3 attempts). The cap prevents unbounded re-resolution storms on a persistently failing MFE.

6. The registry receives the `SLOT_ERROR` action. It may re-resolve the slot to an alternate MFE — a different game, a fallback experience, or a "try something else" prompt — and relay the new resolution back down.

7. On successful `mount()` of the alternate MFE: the slot transitions to `data-slot-state="ready"` and the escalation count for that slot resets.

At every step, the blast radius is exactly one slot. The header, sidebar, navigation, and any other slots are unaffected by any failure in this chain.

---

## Section 5: What You Do Differently as an MFE Author

| Concern | Old way | New way |
|---|---|---|
| **Getting theme** | Call `useTheme()` — reads from the host's `<ThemeProvider>` via the shared React context | Read `props.hostContext.theme` in your root component; pass it to your own `<ThemeProvider theme={hostContext.theme}>` inside your root |
| **Getting locale** | Call `useIntl()` or `useTranslation()` — reads from the host's `<IntlProvider>` | Read `props.hostContext.locale`; wrap your root in your own `<IntlProvider locale={hostContext.locale}>` |
| **Getting auth** | Call a shared auth hook (`useAuth()`) that reads from the host's auth context | Read `props.hostContext.authClaims`; pass to your own `<AuthProvider claims={hostContext.authClaims}>` or read directly where needed |
| **Handling a render crash** | Optionally place a React `<ErrorBoundary>` inside your component tree; if missing, the error propagates to the host | Your root must have an error boundary; it calls `reportError(error, { phase: 'render' })` — the codegen template wires this; you add domain-specific recovery logic in `doEmit()` |
| **Loading states** | Leverage React `<Suspense>` boundaries inside your tree; host may also wrap you in a `<Suspense>` | Your MFE emits loading state changes through the lifecycle (`pending` while `load()` / `render()` are in flight); the host tracks `data-slot-state`; within your own root you use `<Suspense>` normally |
| **Framework choice** | React, with the same major version as the host | Any framework that can produce an imperative `mount(element, props) → unmount` handle; React version is your own |
| **React version** | Pinned to the host's singleton version; upgrade requires cross-team coordination | Owned by your team; upgrade on your own schedule; the host does not need to know |

---

*References: ADR-041, ADR-042, ADR-055, ADR-056, ADR-058, ADR-060*
