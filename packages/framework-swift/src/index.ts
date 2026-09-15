/**
 * @seans-mfe/framework-swift — the Swift native target (ADR-095/096/097).
 *
 * One plugin carrying both halves a target needs: the build lifecycle
 * (`checkEnvironment`, `buildProduction`) and, through `registerCodegen()`,
 * the file contribution. Same shape as `@seans-mfe/framework-react`; it differs
 * only in `targetId`, which puts it under `targets.swift` rather than under the
 * manifest's `framework` field.
 */
export { SwiftSpmPlugin } from './plugin';
export { SWIFT_SPECS, swiftTemplateRoot, registerSwiftCodegen, pascalCase, camelCase, moduleNameFor, bundleIdFor } from './codegen';

import { SwiftSpmPlugin } from './plugin';

/** Well-known export for loadFrameworkPlugin() / loadTargetPlugins() resolution. */
export const frameworkPlugin = new SwiftSpmPlugin();
