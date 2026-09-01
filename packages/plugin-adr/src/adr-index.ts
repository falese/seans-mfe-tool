/**
 * Internal barrel for the ADR schema and rules.
 *
 * These used to live in `@seans-mfe/dsl` and be re-exported from its public
 * barrel, which put ADR governance inside the package that defines the MFE
 * manifest language — two unrelated domains sharing a name. Only ADR tooling
 * ever imported them (ADR-075).
 */
export * from './adr-schema';
export * from './adr-validation';
