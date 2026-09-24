/**
 * @seans-mfe/framework-rust — the Rust native target (ADR-095/097/099).
 *
 * One plugin carrying both halves a target needs: the build lifecycle
 * (`checkEnvironment`, `buildProduction`) and, through `registerCodegen()`,
 * the file contribution. Same shape as `@seans-mfe/framework-swift`; it differs
 * only in `targetId`, which puts it under `targets.rust`.
 */
export { RustCargoPlugin } from './plugin';
export {
  RUST_SPECS,
  rustSpecs,
  rustTemplateRoot,
  registerRustCodegen,
  pascalCase,
  snakeCase,
  crateNameFor,
  libNameFor,
  typePrefixFor,
  rustText,
} from './codegen';

import { RustCargoPlugin } from './plugin';

/** Well-known export for loadFrameworkPlugin() / loadTargetPlugins() resolution. */
export const frameworkPlugin = new RustCargoPlugin();
