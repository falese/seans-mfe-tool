/**
 * DeclaredSlotId derivation (ADR-072).
 *
 * ADR-067 mirrored the manifest's `providesSlots` into code as *data*
 * (`PROVIDED_SLOTS`), which left app code re-typing the ids as bare strings —
 * so a manifest rename regenerated cleanly, kept `tsc` green, and broke only at
 * runtime. This module turns the same declarations into a TypeScript
 * template-literal union, which the generated `DeclaredSlot` uses as its `id`
 * prop type. A rename then fails the build at every use site.
 *
 * The union is deliberately looser than the runtime matcher: `berth.${string}`
 * also admits `berth.a.b`, which `createSlotContract` rejects because a
 * `{param}` segment matches exactly one segment (ADR-069). TypeScript cannot
 * express "any string without a dot"; `assertDeclared()` remains the backstop
 * for that residue.
 */
import { isSlotParamSegment } from '@seans-mfe/contracts';

/** The manifest shape this module needs — `providesSlots[]` entries. */
export interface DeclaredSlotIdSource {
  id: string;
}

/**
 * Render one declared id as a union member: a literal id becomes a
 * string-literal type, an id with `{param}` segments becomes a template
 * literal with `${string}` in each param position.
 *
 * Ids are constrained by the ADR-069 grammar to `[A-Za-z0-9_-]` literals and
 * `{param}` placeholders, so no quote or backtick escaping is possible here.
 */
function toUnionMember(id: string): string {
  const segments = id.split('.');
  if (!segments.some(isSlotParamSegment)) return `'${id}'`;
  const body = segments.map((segment) => (isSlotParamSegment(segment) ? '${string}' : segment));
  return '`' + body.join('.') + '`';
}

/**
 * The right-hand side of `export type DeclaredSlotId = …`, in manifest order.
 * `never` when nothing is declared — an MFE with no slots may register none.
 */
export function toDeclaredSlotIdUnion(declarations: readonly DeclaredSlotIdSource[]): string {
  if (declarations.length === 0) return 'never';
  return declarations.map((declaration) => toUnionMember(declaration.id)).join(' | ');
}
