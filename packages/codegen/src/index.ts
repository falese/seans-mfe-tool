/**
 * @seans-mfe/codegen — the manifest -> files MFE generator.
 *
 * Public surface: generateAllFiles / writeGeneratedFiles (plan -> render ->
 * emit), extractManifestVars, the injected FrameworkVariant + its built-in
 * default (deriveBuiltinVariant, ADR-061), the GeneratedFile shape, and the
 * dependency/plugin/transform constants the CLI's bff:init reads.
 */
export * from './unified-generator';
