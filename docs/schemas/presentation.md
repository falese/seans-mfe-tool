# Presentation Handle Contracts

Source of truth: `packages/contracts/src/presentation.ts`.

Refs: ADR-056 (thin waist), ADR-036 (open-string framework).

---

## Purpose

The presentation handle is the **framework-neutral port** between an MFE and its host.
It solves the polyglot problem: a React shell must be able to mount an Angular MFE
without knowing Angular, and vice versa. The contracts module imports nothing
framework-specific.

The protocol has a guaranteed **floor** and an optional **upgrade**:

- **`imperative-dom`** — every client MFE exposes exactly one. The host hands it a
  DOM element; the MFE mounts and returns its own teardown. Always available,
  always polyglot.
- **native component** — opt-in. A framework-tagged, opaque artifact that a
  matching-framework provider may compose in-tree (single root, shared context),
  accepting framework-singleton coupling.

---

## HandleKind

```typescript
type HandleKind = 'imperative-dom' | 'react-component' | 'web-component' | string;
```

An open string (ADR-036). `'imperative-dom'` is the only guaranteed kind. All others
are opt-in upgrades that require a matching Framework Provider.

---

## ImperativeMountHandle

The universal, guaranteed port. Every client MFE exposes exactly one.

```typescript
interface ImperativeMountHandle {
  kind: 'imperative-dom';
  framework?: string;       // observability/negotiation metadata only
  mount: ImperativeMount;
}

type ImperativeMount = (
  element: MountElement,
  options?: MountOptions,
) => ImperativeUnmount | Promise<ImperativeUnmount>;

type ImperativeUnmount = () => void | Promise<void>;
```

| Property | Required | Description |
|---|---|---|
| `kind` | yes | Always `'imperative-dom'`. |
| `framework` | no | Framework tag for observability. The host does NOT need this to call `mount`. |
| `mount` | yes | The mount function. |

**`mount(element, options?)`**

| Parameter | Type | Description |
|---|---|---|
| `element` | `MountElement` | Host-owned element to mount into. |
| `options.capability` | `string` | Which named domain capability to render. Omit to use the handle's bound default. |
| `options.props` | `Record<string, unknown>` | Props forwarded to the capability inputs. |

Returns a teardown function (synchronous or async) that unmounts and cleans up. The
teardown is **idempotent by contract** — calling it multiple times must be safe.

**MountElement** is defined structurally (not tied to any DOM lib):

```typescript
interface MountElement {
  appendChild(child: unknown): unknown;
}
```

---

## NativeComponentHandle

An opt-in, framework-native artifact. The `component` field is opaque to the core —
only a Framework Provider for the matching `framework` knows its shape.

```typescript
interface NativeComponentHandle {
  kind: Exclude<HandleKind, 'imperative-dom'>;  // anything but 'imperative-dom'
  framework: string;
  component: unknown;
}
```

| Property | Required | Description |
|---|---|---|
| `kind` | yes | Framework-specific kind, e.g. `'react-component'`, `'web-component'`. |
| `framework` | yes | Framework name — used for matching during negotiation. |
| `component` | yes | Opaque artifact (e.g. a React component function). |

---

## PresentationHandle union

```typescript
type PresentationHandle = ImperativeMountHandle | NativeComponentHandle;
```

Discriminate on `kind === 'imperative-dom'` to tell the two apart.

---

## PresentationHandles bundle

What an MFE exposes across the waist. The imperative floor is mandatory; native handles
are optional integration upgrades.

```typescript
interface PresentationHandles {
  imperative: ImperativeMountHandle;
  native?: NativeComponentHandle[];
}
```

| Property | Required | Description |
|---|---|---|
| `imperative` | **yes** | The polyglot floor. An MFE without this cannot be composed. |
| `native` | no | Zero or more framework-native handles for in-tree composition. |

---

## Negotiation

### selectHandle

The single place where the host/MFE framework match is decided. Pure and
framework-neutral.

```typescript
function selectHandle(
  handles: PresentationHandles,
  hostFramework?: string,
): PresentationHandle
```

Logic:
1. If `hostFramework` is provided and a native handle with matching `framework` exists
   in `handles.native`, return it (framework-native in-tree composition).
2. Otherwise return `handles.imperative` (isolated island, polyglot).

### assertPresentationHandles

Validates a handle bundle at a service/runtime boundary. Throws `TypeError` if the
guaranteed imperative floor is missing or if `native` is not an array.

```typescript
function assertPresentationHandles(value: unknown): asserts value is PresentationHandles
```

---

## Guards

| Guard | What it checks |
|---|---|
| `isImperativeMountHandle(value)` | `kind === 'imperative-dom'` and `mount` is a function |
| `isNativeComponentHandle(value)` | `kind !== 'imperative-dom'`, `framework` is a string, `component` present |

---

## Design constraints

- `presentation.ts` imports only `HandleKind` from `./presentation` (a self-reference);
  it imports nothing from any framework library or DOM implementation.
- `component` on `NativeComponentHandle` is typed as `unknown` deliberately — the
  contracts layer never inspects it. Only a Framework Provider casts it to the
  concrete framework type.
- `MountElement` is structural, not `HTMLElement`, so the module can be used in
  non-browser environments (e.g. SSR, test environments that do not have a global
  `document`).
