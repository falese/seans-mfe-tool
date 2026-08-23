[**seans-mfe-tool API reference**](../../README.md)

***

[seans-mfe-tool API reference](../../README.md) / codegen/src

# codegen/src

## Interfaces

- [DeclaredSlotIdSource](interfaces/DeclaredSlotIdSource.md)
- [DriftEntry](interfaces/DriftEntry.md)
- [DriftResult](interfaces/DriftResult.md)
- [FrameworkVariant](interfaces/FrameworkVariant.md)
- [GenerateAllFilesResult](interfaces/GenerateAllFilesResult.md)
- [GeneratedFile](interfaces/GeneratedFile.md)
- [MfeValidationInput](interfaces/MfeValidationInput.md)
- [MfeValidationResult](interfaces/MfeValidationResult.md)
- [MigrationHit](interfaces/MigrationHit.md)
- [PackageDependencyDiffEntry](interfaces/PackageDependencyDiffEntry.md)
- [PlatformMigration](interfaces/PlatformMigration.md)
- [RenderCapability](interfaces/RenderCapability.md)
- [RenderHandlerSource](interfaces/RenderHandlerSource.md)
- [RenderLifecycleHook](interfaces/RenderLifecycleHook.md)
- [SharedEntry](interfaces/SharedEntry.md)
- [SourceLike](interfaces/SourceLike.md)
- [UnresolvableHookHandler](interfaces/UnresolvableHookHandler.md)
- [ValidationIssue](interfaces/ValidationIssue.md)
- [ValidationResult](interfaces/ValidationResult.md)

## Type Aliases

- [DriftReason](type-aliases/DriftReason.md)
- [PackageDependencySection](type-aliases/PackageDependencySection.md)
- [ValidationRule](type-aliases/ValidationRule.md)
- [ValidationSeverity](type-aliases/ValidationSeverity.md)

## Variables

- [DEFAULT\_MESH\_PLUGINS](variables/DEFAULT_MESH_PLUGINS.md)
- [DEFAULT\_MESH\_TRANSFORMS](variables/DEFAULT_MESH_TRANSFORMS.md)
- [DEPENDENCY\_VERSIONS](variables/DEPENDENCY_VERSIONS.md)
- [KNOWN\_MESH\_PLUGINS](variables/KNOWN_MESH_PLUGINS.md)
- [KNOWN\_MESH\_TRANSFORMS](variables/KNOWN_MESH_TRANSFORMS.md)
- [OPTIONAL\_PUBLIC\_ASSETS](variables/OPTIONAL_PUBLIC_ASSETS.md)
- [PLATFORM\_MIGRATIONS](variables/PLATFORM_MIGRATIONS.md)

## Functions

- [capabilityImplemented](functions/capabilityImplemented.md)
- [compareVersions](functions/compareVersions.md)
- [deriveBuiltinVariant](functions/deriveBuiltinVariant.md)
- [diffGeneratedOwned](functions/diffGeneratedOwned.md)
- [diffPackageDependencies](functions/diffPackageDependencies.md)
- [extractManifestVars](functions/extractManifestVars.md)
- [findMigrationHits](functions/findMigrationHits.md)
- [findOrphanedGeneratedFiles](functions/findOrphanedGeneratedFiles.md)
- [findUnresolvableLifecycleHooks](functions/findUnresolvableLifecycleHooks.md)
- [generateAllFiles](functions/generateAllFiles.md)
- [isError](functions/isError.md)
- [parseFederationSharedEntries](functions/parseFederationSharedEntries.md)
- [parseHandlerSource](functions/parseHandlerSource.md)
- [renderJsonDependencyLines](functions/renderJsonDependencyLines.md)
- [renderSharedEntries](functions/renderSharedEntries.md)
- [renderTemplate](functions/renderTemplate.md)
- [resolveClientDependencies](functions/resolveClientDependencies.md)
- [resolveDesignSystemDeps](functions/resolveDesignSystemDeps.md)
- [resolveNeededMeshPluginsAndTransforms](functions/resolveNeededMeshPluginsAndTransforms.md)
- [resolveReactSharedDeps](functions/resolveReactSharedDeps.md)
- [resolveRuntimeExtraDeps](functions/resolveRuntimeExtraDeps.md)
- [severityFor](functions/severityFor.md)
- [toDeclaredSlotIdUnion](functions/toDeclaredSlotIdUnion.md)
- [validateManifestConfiguration](functions/validateManifestConfiguration.md)
- [validateManifestPlugins](functions/validateManifestPlugins.md)
- [validateManifestTransforms](functions/validateManifestTransforms.md)
- [validateMfeConsistency](functions/validateMfeConsistency.md)
- [writeGeneratedFiles](functions/writeGeneratedFiles.md)
