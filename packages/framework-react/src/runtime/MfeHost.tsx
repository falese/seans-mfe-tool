/**
 * React composition provider (ADR-056) — the host-side controller for React
 * shells. `<MfeHost>` / `useMfe` own a React-managed slot element and drive an
 * MFE's presentation handle through React's own lifecycle (effect mount,
 * cleanup unmount). This is the "React API for the lifecycle" surface: the
 * shell composes MFEs declaratively; the MFE stays a sealed VM consumed only
 * through its handle.
 *
 * Scope (structural fix): the imperative handle — an isolated island the
 * provider mounts into the ref'd element. The in-tree native-component path
 * (single root, host context/Suspense spanning the boundary) is the deferred
 * follow-up; it will consume `handles.native` here without changing this API.
 *
 * This module imports React by design — it is boundary layer 3 (host-side),
 * deliberately outside the ADR-056 neutral set. React is a peer dependency.
 */
import * as React from 'react';
import {
  isImperativeMountHandle,
  type ImperativeMountHandle,
  type ImperativeUnmount,
  type PresentationHandles,
} from '@seans-mfe/contracts';

/** Accept either the full handle bundle or just the imperative handle. */
export type MfeHandleInput = PresentationHandles | ImperativeMountHandle;

function resolveImperative(input: MfeHandleInput): ImperativeMountHandle | null {
  if (isImperativeMountHandle(input)) return input;
  const bundle = input as PresentationHandles;
  return isImperativeMountHandle(bundle?.imperative) ? bundle.imperative : null;
}

export interface UseMfeOptions {
  /** Which named domain capability to render (multi-capability MFEs). Omit to
   *  use the handle's bound default. */
  capability?: string;
  props?: Record<string, unknown>;
  onError?: (error: unknown) => void;
}

/**
 * Mount an MFE's imperative handle into a React-managed element. Returns the
 * ref to attach. Re-mounts when the handle identity or props change; unmounts
 * on cleanup — React owns the element, the MFE owns its island.
 */
export function useMfe<E extends HTMLElement = HTMLDivElement>(
  handles: MfeHandleInput,
  options: UseMfeOptions = {}
): React.RefObject<E> {
  const ref = React.useRef<E>(null);
  const { capability, props, onError } = options;

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const handle = resolveImperative(handles);
    if (!handle) {
      onError?.(new Error('useMfe: input exposes no imperative-dom handle to mount'));
      return undefined;
    }

    let cancelled = false;
    let unmount: ImperativeUnmount | undefined;

    Promise.resolve(handle.mount(element, { capability, props }))
      .then((teardown) => {
        if (cancelled) {
          void teardown?.();
        } else {
          unmount = teardown ?? undefined;
        }
      })
      .catch((error) => onError?.(error));

    return () => {
      cancelled = true;
      void unmount?.();
    };
  }, [handles, capability, props, onError]);

  return ref;
}

export interface MfeHostProps extends UseMfeOptions {
  handles: MfeHandleInput;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Declarative wrapper: drop `<MfeHost handles={…} capability="PlayGame" />`
 * into a React shell and the MFE mounts into the rendered element, torn down
 * on unmount.
 */
export const MfeHost: React.FC<MfeHostProps> = ({ handles, capability, props, onError, className, style }) => {
  const ref = useMfe<HTMLDivElement>(handles, { capability, props, onError });
  return <div ref={ref} className={className} style={style} data-mfe-host="" />;
};
