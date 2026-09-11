/**
 * The variant registry (ADR-091).
 *
 * Two built-ins today. A third framework is a new module here plus a template
 * directory — not an edit to the generator, which is the property the Phase 4
 * acceptance test pins.
 */

export * from './types';
export * from './shared';
export { reactRspack } from './react-rspack';
export { angularWebpack } from './angular-webpack';

import type { CodegenVariant } from './types';
import { reactRspack } from './react-rspack';
import { angularWebpack } from './angular-webpack';

export const BUILTIN_VARIANTS: readonly CodegenVariant[] = [reactRspack, angularWebpack];

/**
 * Variants registered beyond the built-ins.
 *
 * The seam a third framework arrives through: a plugin ships a template
 * directory and a `CodegenVariant`, registers it, and the generator emits from
 * it without an edit. That property is pinned by
 * `__tests__/third-variant.test.ts`.
 */
const registered = new Map<string, CodegenVariant>();

/** Register a variant, replacing any previous registration of the same id. */
export function registerVariant(variant: CodegenVariant): void {
  registered.set(variant.id, variant);
}

/** Forget a registered variant. Built-ins are unaffected. */
export function unregisterVariant(id: string): void {
  registered.delete(id);
}

/** Look up a variant by id — registered first, then built-in. */
export function findVariant(id: string): CodegenVariant | undefined {
  return registered.get(id) ?? BUILTIN_VARIANTS.find((v) => v.id === id);
}
