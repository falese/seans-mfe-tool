# Platform Architecture Brief: Contextualized VM Composition

**Audience:** Engineers familiar with micro-frontend lifecycle concepts who have not been brought up to the current platform design. Read this before the alignment sessions begin.

**Purpose:** Replace the "React components loaded from a remote URL" mental model with the model the platform actually uses — and explain why the difference matters.

---

## Why We're Here

The business requirement driving this platform can be stated in three properties:

1. **Independent deployability.** Different teams deploy their micro-frontends (MFEs) on their own schedules. A release by the games team must not require the shell team to redeploy, and vice versa.

2. **Shared context.** Every MFE must receive — and visually reflect — the shell's theme (light/dark mode, brand tokens), locale (en-AU, en-GB), and authentication (current user identity, JWT, roles). A child MFE that looks detached from the host or that cannot gate itself on permissions is a failed product.

3. **Framework and version agnosticism.** Different teams have different technology choices. One team is on React 19, one is on Angular 19, one is on an older React version they cannot upgrade yet because of a third-party dependency. The platform must not force them onto the same framework or the same major version.

These three properties are in direct tension with each other. Every conventional approach in the industry manages to satisfy two of them and silently sacrifices the third. The entire design history of this platform is a search for the architectural move that lets all three coexist.

Understanding why conventional approaches fail is not a history lesson — it is the prerequisite for understanding why this platform is built the way it is. Every structural decision that might otherwise look like over-engineering was made to avoid a specific failure mode from that list.

---

## The Trap: How the Industry Handles This (and Why It Fails Us)

### Pattern 1: iframes and web components

The oldest strategy: put each MFE in a hard boundary — either an HTML `<iframe>` element or a Custom Element (web component) — so that the host page and each MFE are genuinely isolated from each other. A crash inside an iframe cannot touch the parent page. An Angular MFE can live next to a React MFE because they have no shared execution environment.

This gives you independent deployability (each MFE is its own URL) and framework agnosticism (the host does not care how the MFE is built). But it breaks shared context almost completely.

An `<iframe>` is a separate browsing context. The host page's JavaScript objects — including its theme, its locale, its authentication state — do not cross the frame boundary automatically. You can post messages across, but every MFE must implement its own listener, its own re-hydration of that data into its own framework's provider system. In practice this is fragile and leaky. Themes drift. Auth state gets stale. The MFE looks like a foreign widget inserted into the host.

Web components help somewhat — they share the JavaScript environment — but context from React's `<ThemeProvider>` or `<IntlProvider>` still does not flow into a web component unless you explicitly wire it. The component is not inside the React tree; it sits beside it.

**What you get:** isolation, framework agnosticism. **What you sacrifice:** shared context.

### Pattern 2: Module Federation in a shared React tree

Module Federation (MF), shipped by Webpack and now Rspack, allows a host application to load JavaScript modules from remote servers at runtime. When configured with `singleton: true` for shared dependencies like React, all MFEs and the host share one instance of React in memory — one reconciler, one component tree.

This is how most production Module Federation implementations work, and it is the pattern teams often describe as "proper" MFE. It feels clean to develop in: the host passes React context down through its normal `<ThemeProvider>` and `<IntlProvider>` tree, and the remote MFE just reads `useTheme()` and `useIntl()` like any other component in the tree. Auth context flows naturally. Error boundaries work normally.

But look closely at what "shared singleton React" actually means:

- Every MFE must use the same major version of React as the host. You cannot have React 17 in one MFE and React 19 in another if they share a reconciler. If the shell upgrades React, every MFE must be compatible before the shell can deploy. Independent deployability becomes a fiction: it is coordinated-deployability with extra steps.
- A runtime error inside a remote MFE — an uncaught exception during a render — propagates into the shared React reconciler. If there is no error boundary at exactly the right place in exactly the right tree, the entire host application can be torn down by a crash in a single game or widget. One module crashing takes down the sidebar, the header, and the navigation.
- The MFE's framework is not truly an internal detail. The host has to understand it, negotiate with it, and satisfy its singleton version constraint. Adding an Angular MFE requires a fundamentally different approach; you cannot just slot it in.

This is the pattern we call the "React-only, one-tree" trap. It is used widely because it genuinely solves context sharing — and while solving that, it quietly destroys isolation and framework agnosticism. It trades two of our three properties to get one.

### Pattern 3: Shared design system SPA (single-page application)

The third common pattern abandons the pretense of true independence and ships what is effectively a monolith that has been carved into directories. Each "MFE" is a React component that lives in a shared repository, is built together as a single bundle, and is deployed together. A design system team owns the component library, and every team contributes their slice.

This can look like micro-frontends from the outside. Context sharing is complete (everything is in one tree). Visual consistency is enforced by the shared library. But there is no meaningful isolation, and no independent deployment: releasing any MFE means rebuilding and releasing the entire application.

It is a monolith wearing MFE clothes.

### The trap statement

What these three patterns have in common is that "shared context" almost always means "put the MFE inside the host's framework tree." Putting the MFE in the host's tree solves context instantly — and silently destroys both isolation and framework agnosticism, because those properties require that the MFE be *outside* the host's tree, not inside it.

The key question this platform had to answer is: can you have shared context without shared tree?

---

## The Mental Model: Pods and a Scheduler

The mental model that makes this platform coherent is Kubernetes.

In Kubernetes, a workload runs in a **pod** — a sealed, independently deployable unit. The cluster's **control plane** (the scheduler, the API server, the kubelet) decides where pods run, on what node, under what conditions. The control plane reads the pod's health probes, restarts it if it fails, and routes network traffic to it. But it never reaches inside the container to look at how the application is built, what language it runs in, or what version of any library it uses. The container exposes a thin standard interface (health check ports, lifecycle hooks); the control plane speaks only that interface.

Now map this to the platform:

- An MFE is a pod. It is a sealed container. Inside it: a framework, a React or Angular version, domain code, a component tree. These are internal details. The platform has no visibility into them and no coupling to them.
- The control plane — comprising the daemon (which routes actions to the registry), the registry (which resolves which MFE should handle which user's action), and the LayoutManager (which places resolved MFEs into host slots) — is the scheduler. It decides which MFE runs in which slot, for which user, under which conditions.
- Between the pod and the scheduler there is a **thin standard interface**: the neutral capability contract.

The design test for any decision is: *would Kubernetes reach into the container to do this?* If the answer is no, the platform should not either.

Here is what lives where:

| Inside the pod (MFE internals — opaque) | Across the interface (the only things that cross) |
|---|---|
| React version | Neutral capability contract: `load`, `authorize`, `render`, `health`, `emit`, `query`, `describe`, `schema`, `updateControlPlaneState` |
| Angular bootstrap | Presentation handle: `mount(element, props) → unmount` |
| Component tree structure | Injected values: `props.hostContext` (theme, locale, auth) |
| Internal state management | Error reports: `reportError(error, { phase })` |
| Bundler configuration | |
| Internal dependencies | |
| CSS / style approach | |

The host never imports the MFE's components directly. It does not call `createRoot` on the MFE's behalf. It does not pass a React context object. It calls `mount(element, props)` and gets back an `unmount` function. Everything else is the MFE's business.

This is not puritanism. It is the only design that allows a React 17 MFE and a React 19 MFE to coexist in the same shell without either blocking the other's deploy.

---

## The Key Move: Context as Data, Not as a Shared Tree

This is the hinge of the whole design, and it is worth working through carefully.

The problem of shared context is real. An MFE that cannot read the current theme looks broken. An MFE that cannot read the current locale serves the wrong strings. An MFE that cannot read the current user's identity cannot gate itself on permissions. These are not nice-to-haves; they are product requirements.

The naive solution is exactly what Module Federation's shared singleton enables: the host has a `<ThemeProvider value={theme}>` somewhere up in its React tree, the MFE is rendered as a component inside that tree, and `useTheme()` inside the MFE reads the value. It works. It is simple.

But to render the MFE inside the host's React tree, the MFE must be a React component in the same reconciler. Same reconciler means same React version, same error propagation domain, same render cycle. You have sealed the fate of framework agnosticism and multi-version coexistence.

The platform's solution is different: **the host passes the values, not the tree**.

The LayoutManager configuration carries a `providerValues` object — a plain data structure containing what the host wants to share: `{ theme: 'dark', locale: 'en-AU', authClaims: { sub: 'user-123', roles: ['member'] }, featureFlags: { ... } }`. This object is threaded through the adaptor layer and arrives at each MFE as `props.hostContext`.

Inside the MFE — inside its own isolated root — the code reads these values and reconstitutes its own context providers:

```tsx
// Inside the MFE's root, in its own React reconciler
function AppRoot({ hostContext }) {
  return (
    <IntlProvider locale={hostContext.locale}>
      <ThemeProvider theme={hostContext.theme}>
        <AuthProvider claims={hostContext.authClaims}>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </IntlProvider>
  );
}
```

The user's experience is identical: every MFE is themed, localized, and authenticated. The MFE author's experience is nearly identical: they call `useTheme()` and it works. The difference is invisible to the end user and to the component author.

What changed? The providers are the MFE's own providers, not the host's. The React instance inside the MFE's root is the MFE's own React instance. When the host upgrades React from 18 to 19, the MFE's root is unaffected until the MFE team chooses to upgrade. When the MFE's root throws, the host's reconciler is untouched.

This is what makes a React 17 MFE and a React 19 MFE coexist in the same shell. The host could be Angular, and it would work the same way: the Angular shell passes `hostContext` as plain data; the React MFE reads it and provides its own React context.

The Kubernetes mapping for this is exact: *configmap / values: session + props injection — data in, never code reaching in.*

---

## Self-Healing: Error Boundaries and Suspense Without React

Every MFE already implements an `error` lifecycle phase. The platform builds on that to deliver fault isolation and recovery that works across React, Angular, and plain HTML — without requiring a shared reconciler.

Two classes of error can occur.

**Lifecycle errors** happen during the awaited phases: `load`, `authorize`, `render`. These are already wrapped in try/catch inside `BaseMFE` (the abstract base class). When a capability fails, `BaseMFE` runs the MFE's `error` lifecycle phase — which can attempt retry/backoff (ADR-030) — then re-throws. The rejection surfaces to the LayoutManager, which is awaiting the promise.

**Post-mount render errors** happen asynchronously, inside the island's own render loop after the mount promise has resolved. These throws are caught by the island's own framework error boundary (`createErrorBoundary`). They physically cannot cascade to sibling slots because the islands are separate roots. An uncaught throw inside a React 19 island cannot reach the React 17 island — they do not share a reconciler. The error boundary reports out through a neutral `reportError(error, { phase })` sink: framework-specific catching stays inside the island; the LayoutManager only sees a neutral report.

When the LayoutManager receives an error — either from a lifecycle rejection or from a `reportError` call — it:

1. Tears down the failing slot's mount.
2. Renders a neutral fallback into that slot only. The slot beside it, the header above it, and the sidebar next to it are untouched.
3. Marks the slot `data-slot-state="error"`, so host chrome can display a skeleton or "unavailable" message without React Suspense.

This delivers error-boundary and loading-state semantics uniformly across frameworks, built on the lifecycle contract rather than on React primitives.

The "bigger door" goes further. When a slot fails and does not recover, the LayoutManager emits a `SLOT_ERROR` action up the control plane. The registry receives this and may re-resolve that slot to a different MFE — a "game unavailable, try another" experience delivered automatically, without user action. Failure becomes a composition input. An escalation cap (default: 3 attempts per slot) prevents the system from storming the registry on a persistently broken MFE; after the cap is reached, the slot settles on its neutral fallback.

Blast radius is always bounded to one slot. This is not a soft goal or a best-effort property; it is a structural consequence of separate roots.

---

## What This Means for the Team

The shift from the "one-tree" model to the "Contextualized VM" model changes some things and leaves others untouched. Here is the concrete list.

**Things that are now true that were not true before:**

- "I own my MFE's React version." Bumping from React 18 to React 19 in your MFE is your team's decision. You do not need to coordinate with the shell team or with any other MFE team. You do not need to audit the shared singleton config. You build, test, deploy, and the shell continues to work.

- "My MFE gets the host's theme, locale, and auth." It does — via `props.hostContext`. Read the values, pass them into your own `<ThemeProvider>` and `<IntlProvider>` inside your own root. The values are available from the first render.

- "If my MFE crashes, I am isolated." The platform puts a fence around your slot. A throw inside your component tree cannot kill the sidebar or the header. A failed `load()` gets caught by the LayoutManager and turns into a slot-level fallback, not a whole-page crash.

- "I can build my MFE in Angular if React is the wrong tool for my use case." The platform speaks to your MFE through the neutral lifecycle contract, not through a React-specific API. An Angular MFE exposes the same `mount(element, props) → unmount` handle; the LayoutManager mounts it the same way.

**Things that have not changed:**

The lifecycle contract itself — `load`, `authorize`, `render`, `health`, `emit`, `query`, `describe`, `schema`, `updateControlPlaneState` — is unchanged. These are the ten capabilities every MFE exposes, backed by the corresponding `do*()` abstract methods you implement. If you have written an MFE on this platform before, your `doLoad()`, `doRender()`, etc. are still the right place to put your code.

How you handle props: props still arrive at your MFE's entry point and flow into your component tree.

How you register capabilities in the DSL manifest: unchanged.

**What is new for MFE authors:**

- Where you get context from: it comes in through `props.hostContext`, not from the host's shared provider tree. Read the values; re-provide them inside your own root.
- What you do when you error: emit through `reportError(error, { phase })`. Your framework error boundary should route there; codegen template changes will wire this automatically.

---

## The Deliberate Trade

Architectural honesty requires acknowledging what this design gives up. There are two things it does not do, and they are not oversights.

**No sub-MFE streaming Suspense across slot boundaries.** React's streaming Suspense (the ability to start rendering a component tree and stream updates as data loads) is a reconciler feature. It requires the component that suspends and the component that provides the suspense boundary to be in the same React tree. Because MFEs are separate roots, there is no single reconciler spanning multiple slots. You get slot-granularity loading states — the slot is pending, the slot is ready, the slot is in error — not fine-grained within-MFE streaming propagated upward.

Slot-granularity loading states are the right granularity for composition. You know that a slot is loading; you can render a skeleton in its place. What you cannot do is have a React Suspense boundary in the shell that catches a suspend thrown inside an MFE's isolated root.

**No single host error boundary wrapping multiple MFEs.** A React error boundary `<ErrorBoundary>` can only catch errors from components rendered in its subtree, inside its reconciler. If three MFEs are in three separate roots, you cannot wrap all three in one host error boundary. Each slot has its own error domain.

If you find yourself needing a single boundary over three related MFEs, that is a signal about slot grouping and composition — perhaps those three should be one MFE, or one slot that contains a sub-layout. It is not an error-boundary problem that can be solved by making the MFEs share a reconciler.

These are trades made on purpose. The two things you give up are exactly the things that require a shared reconciler. The shared reconciler is exactly what would destroy multi-version React coexistence and independent deployability. The trade buys the other properties, and those properties are what make the platform worth having.

---

## The Path Forward

**What is built.** The runtime plumbing is in place: the LayoutManager (`src/runtime/layout-manager.ts`) with `providerValues` threading, `reportError` sink, slot-scoped fallback, `data-slot-state` markers, and `SLOT_ERROR` escalation with bounded retry. The neutral capability contract (`BaseMFE`, the ten `do*()` methods, the state machine) is in `packages/runtime`. The `BaseControlPlane` abstraction (`packages/runtime`) provides the host integration point. The `@seans-mfe/contracts` package carries the protocol types, the presentation handle shape, and the `hostContext` injection contract.

**What is next.** Two tracked follow-ups are outstanding:

1. *Codegen template changes.* The generated MFE templates need to be updated so that the island's error boundary routes to `emit` → `reportError`, and so that `props.hostContext` is read and re-provided inside the root. When this lands, MFEs generated by `remote:generate` will be correctly wired without manual author steps. This is a tracked follow-up to ADR-060, not in the current change.

2. *ABC Kids end-to-end demonstration.* The ABC Kids example shell (`examples/abc-kids/`) will be migrated to use the new host-side composition path, demonstrating a real shell running both React and Angular MFEs receiving shared context via value-injection.

**What is not built, by design.** The "native in-tree handle" — a React-specific shared-reconciler integration where a React MFE runs inside the host's React tree — has types reserved in `@seans-mfe/contracts` (`NativeComponentHandle`, `selectHandle`) as a latent optional. It is not implemented, and it is not the platform's integration strategy. Value-injection is the strategy. The latent types exist in case a narrow, explicitly scoped exception is ever needed; they will never be the default path.

The alignment sessions this week should be read against this background. Decisions about slot vocabulary, about how `hostContext` is structured, about how teams adopt the new template conventions — these all sit inside the model described here. The questions that do not fit the model (for example: "can we have the shell's React error boundaries catch MFE errors?") are not questions to be answered by finding the right API — they are questions to be answered by understanding the trade in section 7, and then deciding whether the trade is the right one for this platform.

---

*ADR references: ADR-041 (BaseMFE capability contract), ADR-042 (lifecycle state machine), ADR-054 (control-plane protocol), ADR-055 (LayoutManager / daemon-driven shells), ADR-056 (MFE presentation boundary), ADR-058 (slot-provider MFEs), ADR-060 (Contextualized VM composition — value-injection + slot-scoped self-healing).*
