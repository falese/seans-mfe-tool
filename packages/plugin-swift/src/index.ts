/**
 * @seans-mfe/plugin-swift — the Swift native target generator (ADR-095, ADR-096).
 *
 * The contributor registers itself as an import side effect, the same way the
 * BFF's does, so a host opts in with `import '@seans-mfe/plugin-swift/codegen'`
 * rather than threading a parameter through every call site.
 */
export { SWIFT_SPECS, swiftTemplateRoot, pascalCase, camelCase, moduleNameFor, bundleIdFor } from './codegen';
