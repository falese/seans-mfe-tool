/**
 * @seans-mfe/plugin-coder — the first-party in-repo coder seam (ADR-088).
 *
 * Public surface:
 *  - the intent-compilation contract types (ADR-085 §1);
 *  - the out-of-process coder invocation (`compileIntent` + transports);
 *  - the DSL eval oracle (`validateManifestText`, re-exporting `@seans-mfe/dsl`).
 *
 * The `coder:*` oclif commands are discovered from `dist/commands` by oclif and
 * are not part of this module's exports.
 */

export * from './types';
export * from './oracle';
export * from './coder-service';
export { coderCompileCommand } from './commands/coder/compile';
export type { CoderCompileOptions } from './commands/coder/compile';
