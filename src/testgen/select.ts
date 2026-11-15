/**
 * Which part of a captured page belongs to a capability (ADR-129 §2).
 *
 * A capture records regions, one per rendered component instance, nested by
 * their `parent` (ADR-109 §2). A capability's view is its root regions — the
 * instances of its component, or the regions carrying its `data-smt-capability`
 * boundary stamp (#408) — and everything nested in them, down to the root of
 * another *placed* capability: what a shell draws in a slot is not the shell's.
 * Those boundaries' rectangles are kept, so a visual baseline can blank them.
 *
 * Pure: regions in, a view out.
 */

import type { Region } from '../decompose/regions';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CapabilityRef {
  /** The manifest's capability name. */
  name: string;
  /** The component that renders it, as React names it in a development build. */
  component: string;
}

export interface CapabilityView {
  /** The capability's regions: roots first, then what they draw, in capture order. */
  regions: Region[];
  /** The union of its root regions' rectangles, or null when it is not on screen. */
  rect: Rect | null;
  /** Rectangles of other placed capabilities drawn inside it. */
  exclude: Rect[];
}

const STAMP = 'data-smt-capability';

function union(a: Rect | null, b: Rect): Rect {
  if (!a) return { ...b };
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y };
}

/**
 * `boundaries` names the components that are capabilities placed by a
 * composition. One of them nested in `cap`'s tree is another placement, so the
 * walk stops there.
 */
export function capabilityView(regions: Region[], cap: CapabilityRef, boundaries: Set<string>): CapabilityView {
  const isRoot = (r: Region) => r.component === cap.component || r.data?.[STAMP] === cap.name;
  const children = new Map<string, Region[]>();
  for (const r of regions) {
    if (r.parent === null) continue;
    const list = children.get(r.parent) ?? [];
    list.push(r);
    children.set(r.parent, list);
  }
  const inView = new Set<string>();
  const exclude: Rect[] = [];
  let rect: Rect | null = null;
  // A root nested in another root of the same capability is already reached from it.
  const roots = regions.filter((r) => isRoot(r));
  const rootIds = new Set(roots.map((r) => r.id));
  const byId = new Map(regions.map((x) => [x.id, x]));
  const ancestorIsRoot = (r: Region): boolean => {
    for (let p = r.parent; p !== null; p = byId.get(p)?.parent ?? null) if (rootIds.has(p)) return true;
    return false;
  };
  for (const root of roots.filter((r) => !ancestorIsRoot(r))) {
    rect = union(rect, root.rect);
    const stack = [root];
    while (stack.length > 0) {
      const r = stack.pop() as Region;
      inView.add(r.id);
      for (const c of [...(children.get(r.id) ?? [])].reverse()) {
        if (!isRoot(c) && boundaries.has(c.component)) {
          exclude.push({ ...c.rect });
          continue;
        }
        stack.push(c);
      }
    }
  }
  return { regions: regions.filter((r) => inView.has(r.id)), rect, exclude };
}

/** A rectangle rounded outwards to whole pixels and clipped to the viewport; null when nothing is left. */
export function rectIn(r: Rect, viewport: { width: number; height: number }): Rect | null {
  const x = Math.max(0, Math.floor(r.x));
  const y = Math.max(0, Math.floor(r.y));
  const right = Math.min(viewport.width, Math.ceil(r.x + r.width));
  const bottom = Math.min(viewport.height, Math.ceil(r.y + r.height));
  if (right <= x || bottom <= y) return null;
  return { x, y, width: right - x, height: bottom - y };
}
