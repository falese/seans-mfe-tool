/**
 * How a capability name becomes a Rust module name (ADR-099).
 *
 * Here rather than in `@seans-mfe/framework-rust` because two sides must agree
 * on it and the dependency runs one way: the Rust contributor emits
 * `rust/src/features/<snake>_query.rs`, and `validate.ts` looks for exactly
 * that file. A copy on each side would be the drift the rule exists to catch.
 */

/** `CrewRoster` / `authorizeAccess` → `crew_roster` / `authorize_access`. */
export function snakeCase(name: string): string {
  const out = name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
  // A leading digit is not a legal identifier start.
  return /^[0-9]/.test(out) ? `mfe_${out}` : out || 'mfe';
}
