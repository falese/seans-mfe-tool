/**
 * The one classification of GraphQL Mesh plugins and transforms (ADR-092).
 *
 * WHY THIS IS IN `contracts` AND NOT IN THE GENERATOR: it is manifest
 * vocabulary. The DSL schema validates against it, the DSL validator classifies
 * against it, and codegen renders from it — three packages, one fact, so it
 * belongs at the root of the dependency graph like the platform capability set
 * (ADR-080, the same reasoning applied to the same shape of problem).
 *
 * WHAT IT REPLACES: four copies of this knowledge existed, with three different
 * spellings and no agreement on contents —
 *
 *   packages/codegen/src/catalog.ts    13 plugins / 15 transforms, camelCase
 *   packages/dsl/src/validator.ts       8 plugins /  9 transforms, kebab-case
 *   packages/dsl/src/schema.ts          9 plugins / 12 transforms, camelCase,
 *                                       different contents again
 *   src/utils/manifestValidator.js      a fourth copy, orphaned (deleted, A2)
 *
 * Two of them read the same `manifest.transforms` field and contradicted each
 * other. Measured: `transforms: [filterSchema]` was REJECTED by the DSL
 * validator (`valid=false`) and accepted by codegen; `transforms:
 * [filter-schema]` was accepted by the DSL validator and warned on by codegen.
 * Whichever spelling an author picked, one half of the platform objected — and
 * the rejected one is the spelling `DEFAULT_MESH_TRANSFORMS` actually generates.
 *
 * CANONICAL FORM IS THE MESH CONFIG KEY. `.meshrc.yaml` is keyed
 * `filterSchema`, `rateLimit`, `resolversComposition`; the kebab-case spellings
 * are the npm package suffixes (`@graphql-mesh/transform-filter-schema`). Both
 * reach manifests, so both resolve here, and the config key wins as canonical
 * because it is what the generator emits.
 */

/**
 * Mesh plugins — `@graphql-mesh/plugin-*`, configured under the manifest's
 * `performance` / `data.plugins` sections and rendered into `.meshrc.yaml`
 * under `plugins:`.
 */
export const MESH_PLUGINS = [
  'responseCache',
  'prometheus',
  'opentelemetry',
  'newrelic',
  'statsd',
  'datadog',
  'liveQuery',
  'deferStream',
  'meshHttp',
  'httpDetails',
  'operationFieldPermissions',
  'jwtAuth',
  'hmac',
  'useMaskedErrors',
  'usePersistedOperations',
] as const;

/**
 * Mesh transforms — `@graphql-mesh/transform-*`, declared in the manifest's
 * top-level `transforms` array or per-source `data.sources[].transforms`, and
 * rendered into `.meshrc.yaml` under `transforms:`.
 */
export const MESH_TRANSFORMS = [
  'namingConvention',
  'rateLimit',
  'filterSchema',
  'resolversComposition',
  'cache',
  'prefix',
  'rename',
  'encapsulate',
  'federation',
  'extend',
  'replace',
  'typeMerging',
  'hoistField',
  'bare',
] as const;

/**
 * Names Mesh ships in BOTH positions, so neither "this is a transform, not a
 * plugin" nor its converse is ever true of them.
 *
 * Every previous copy of this table handled these by listing them in both sets,
 * which quietly disabled its own misclassification check for exactly the names
 * that most needed thought. Naming the ambiguity is the fix; listing twice was
 * a bug wearing the shape of completeness.
 */
export const MESH_AMBIGUOUS = ['mock', 'snapshot'] as const;

export type MeshPlugin = (typeof MESH_PLUGINS)[number];
export type MeshTransform = (typeof MESH_TRANSFORMS)[number];

/**
 * npm-package spelling → Mesh config key.
 *
 * Only entries whose two spellings genuinely differ. A name that is identical
 * either way (`prometheus`, `cache`, `federation`) needs no row.
 */
// Null-prototype, because this table is indexed by a name a MANIFEST supplies
// and a plain object literal answers for every key on Object.prototype as well
// as its own. `ALIASES['toString']` returned a FUNCTION — out of a `: string`
// signature, past a `?? name` guard that only catches nullish — and that value
// went on to be classified and rendered; `__proto__` returned the prototype
// object itself. The value type is `string | undefined` so the `??` below is a
// real check rather than one the compiler believes can never fire.
const ALIASES: Readonly<Record<string, string | undefined>> = Object.assign(Object.create(null), {
  'response-cache': 'responseCache',
  'filter-schema': 'filterSchema',
  'rate-limit': 'rateLimit',
  'resolvers-composition': 'resolversComposition',
  'naming-convention': 'namingConvention',
  'type-merging': 'typeMerging',
  'live-query': 'liveQuery',
  'defer-stream': 'deferStream',
  'mesh-http': 'meshHttp',
  'http-details': 'httpDetails',
  'hoist-field': 'hoistField',
  'operation-field-permissions': 'operationFieldPermissions',
  'jwt-auth': 'jwtAuth',
});

/**
 * Resolve a manifest-written name to its canonical Mesh config key.
 *
 * An unrecognised name is returned unchanged rather than transformed: the
 * platform accepts unknown plugins and transforms with a warning (the same
 * open-world policy ADR-036 applies to `framework` and `bundler`), so guessing
 * a canonical form for something we do not know would corrupt it.
 */
export function canonicalMeshName(name: string): string {
  return ALIASES[name] ?? name;
}

/** What a manifest-declared Mesh entry is. */
export type MeshEntryKind = 'plugin' | 'transform' | 'ambiguous' | 'unknown';

/**
 * Classify a manifest-declared Mesh entry, resolving aliases first.
 *
 * `unknown` is not an error — callers warn and carry on, because Mesh has more
 * plugins than this table will ever track. `ambiguous` means the name is valid
 * in either position and no misclassification should be reported.
 */
export function classifyMeshEntry(name: string): MeshEntryKind {
  const canonical = canonicalMeshName(name);
  if ((MESH_AMBIGUOUS as readonly string[]).includes(canonical)) return 'ambiguous';
  if ((MESH_PLUGINS as readonly string[]).includes(canonical)) return 'plugin';
  if ((MESH_TRANSFORMS as readonly string[]).includes(canonical)) return 'transform';
  return 'unknown';
}
