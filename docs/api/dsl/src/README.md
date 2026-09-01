[**seans-mfe-tool API reference**](../../README.md)

***

[seans-mfe-tool API reference](../../README.md) / dsl/src

# dsl/src

## Interfaces

- [CapabilityScaffold](interfaces/CapabilityScaffold.md)
- [CompiledRegistration](interfaces/CompiledRegistration.md)
- [CompiledRoute](interfaces/CompiledRoute.md)
- [CompiledRuleDocument](interfaces/CompiledRuleDocument.md)
- [CompileInput](interfaces/CompileInput.md)
- [CompileResult](interfaces/CompileResult.md)
- [ControlPlaneFinding](interfaces/ControlPlaneFinding.md)
- [GeneratedFile](interfaces/GeneratedFile.md)
- [GenerationResult](interfaces/GenerationResult.md)
- [PlacementFinding](interfaces/PlacementFinding.md)
- [PlacementRuleDocument](interfaces/PlacementRuleDocument.md)
- [RemoteGenerateOptions](interfaces/RemoteGenerateOptions.md)
- [RemoteInitOptions](interfaces/RemoteInitOptions.md)
- [SourceFile](interfaces/SourceFile.md)
- [UnreferencedSlotFinding](interfaces/UnreferencedSlotFinding.md)
- [ValidationError](interfaces/ValidationError.md)
- [ValidationResult](interfaces/ValidationResult.md)

## Type Aliases

- [Bundler](type-aliases/Bundler.md)
- [CachingConfig](type-aliases/CachingConfig.md)
- [CapabilityConfig](type-aliases/CapabilityConfig.md)
- [CapabilityEntry](type-aliases/CapabilityEntry.md)
- [CapabilityType](type-aliases/CapabilityType.md)
- [ControlPlaneDocument](type-aliases/ControlPlaneDocument.md)
- [ControlPlaneRoute](type-aliases/ControlPlaneRoute.md)
- [ControlPlaneRule](type-aliases/ControlPlaneRule.md)
- [CustomTransform](type-aliases/CustomTransform.md)
- [DataConfig](type-aliases/DataConfig.md)
- [DataLineage](type-aliases/DataLineage.md)
- [DataPlugin](type-aliases/DataPlugin.md)
- [DataServe](type-aliases/DataServe.md)
- [DataSource](type-aliases/DataSource.md)
- [DataTransform](type-aliases/DataTransform.md)
- [Dependencies](type-aliases/Dependencies.md)
- [DSLInput](type-aliases/DSLInput.md)
- [DSLManifest](type-aliases/DSLManifest.md)
- [DSLOutput](type-aliases/DSLOutput.md)
- [FilterSchemaConfig](type-aliases/FilterSchemaConfig.md)
- [Framework](type-aliases/Framework.md)
- [Language](type-aliases/Language.md)
- [Lifecycle](type-aliases/Lifecycle.md)
- [LifecycleHook](type-aliases/LifecycleHook.md)
- [LifecycleHookEntry](type-aliases/LifecycleHookEntry.md)
- [MFEType](type-aliases/MFEType.md)
- [ObservabilityConfig](type-aliases/ObservabilityConfig.md)
- [OpenAPIHandler](type-aliases/OpenAPIHandler.md)
- [OpenTelemetryConfig](type-aliases/OpenTelemetryConfig.md)
- [PartialDSLManifest](type-aliases/PartialDSLManifest.md)
- [PerformanceConfig](type-aliases/PerformanceConfig.md)
- [Placement](type-aliases/Placement.md)
- [PrometheusConfig](type-aliases/PrometheusConfig.md)
- [ProvidedSlot](type-aliases/ProvidedSlot.md)
- [ProvidesSlots](type-aliases/ProvidesSlots.md)
- [RateLimitConfig](type-aliases/RateLimitConfig.md)

## Variables

- [BundlerSchema](variables/BundlerSchema.md)
- [CachingConfigSchema](variables/CachingConfigSchema.md)
- [CapabilityConfigSchema](variables/CapabilityConfigSchema.md)
- [CapabilityEntrySchema](variables/CapabilityEntrySchema.md)
- [CapabilityTypeSchema](variables/CapabilityTypeSchema.md)
- [ControlPlaneDocumentSchema](variables/ControlPlaneDocumentSchema.md)
- [ControlPlaneRouteSchema](variables/ControlPlaneRouteSchema.md)
- [CustomTransformSchema](variables/CustomTransformSchema.md)
- [DataConfigSchema](variables/DataConfigSchema.md)
- [DataLineageSchema](variables/DataLineageSchema.md)
- [DataPluginSchema](variables/DataPluginSchema.md)
- [DataServeSchema](variables/DataServeSchema.md)
- [DataSourceSchema](variables/DataSourceSchema.md)
- [DataTransformSchema](variables/DataTransformSchema.md)
- [DependenciesSchema](variables/DependenciesSchema.md)
- [DSLInputSchema](variables/DSLInputSchema.md)
- [DSLManifestSchema](variables/DSLManifestSchema.md)
- [DSLOutputSchema](variables/DSLOutputSchema.md)
- [FilterSchemaConfigSchema](variables/FilterSchemaConfigSchema.md)
- [FrameworkSchema](variables/FrameworkSchema.md)
- [KNOWN\_BUNDLERS](variables/KNOWN_BUNDLERS.md)
- [KNOWN\_FRAMEWORKS](variables/KNOWN_FRAMEWORKS.md)
- [LanguageSchema](variables/LanguageSchema.md)
- [LifecycleHookEntrySchema](variables/LifecycleHookEntrySchema.md)
- [LifecycleHookSchema](variables/LifecycleHookSchema.md)
- [LifecycleSchema](variables/LifecycleSchema.md)
- [MANIFEST\_FILENAMES](variables/MANIFEST_FILENAMES.md)
- [MFETypeSchema](variables/MFETypeSchema.md)
- [MockSwitchSchema](variables/MockSwitchSchema.md)
- [ObservabilityConfigSchema](variables/ObservabilityConfigSchema.md)
- [OpenAPIHandlerSchema](variables/OpenAPIHandlerSchema.md)
- [OpenTelemetryConfigSchema](variables/OpenTelemetryConfigSchema.md)
- [PartialDSLManifestSchema](variables/PartialDSLManifestSchema.md)
- [PerformanceConfigSchema](variables/PerformanceConfigSchema.md)
- [PLACEHOLDER](variables/PLACEHOLDER.md)
- [PlacementSchema](variables/PlacementSchema.md)
- [PrometheusConfigSchema](variables/PrometheusConfigSchema.md)
- [ProvidedSlotSchema](variables/ProvidedSlotSchema.md)
- [ProvidesSlotsSchema](variables/ProvidesSlotsSchema.md)
- [RateLimitConfigSchema](variables/RateLimitConfigSchema.md)
- [VALID\_CAPABILITY\_TYPES](variables/VALID_CAPABILITY_TYPES.md)
- [VALID\_LANGUAGES](variables/VALID_LANGUAGES.md)
- [VALID\_MFE\_TYPES](variables/VALID_MFE_TYPES.md)
- [WELL\_KNOWN\_PATH](variables/WELL_KNOWN_PATH.md)

## Functions

- [addCapability](functions/addCapability.md)
- [compileControlPlane](functions/compileControlPlane.md)
- [createMinimalManifest](functions/createMinimalManifest.md)
- [deriveRegistration](functions/deriveRegistration.md)
- [findManifest](functions/findManifest.md)
- [findUnreferencedSlots](functions/findUnreferencedSlots.md)
- [formatErrorsForCLI](functions/formatErrorsForCLI.md)
- [generateEndpoints](functions/generateEndpoints.md)
- [getCapabilityNames](functions/getCapabilityNames.md)
- [getDomainCapabilities](functions/getDomainCapabilities.md)
- [getErrorSummary](functions/getErrorSummary.md)
- [hasDataLayer](functions/hasDataLayer.md)
- [parseAndValidateDirectory](functions/parseAndValidateDirectory.md)
- [parseAndValidateFile](functions/parseAndValidateFile.md)
- [parseManifestFile](functions/parseManifestFile.md)
- [parseManifestFromDirectory](functions/parseManifestFromDirectory.md)
- [parseYAML](functions/parseYAML.md)
- [serializeToYAML](functions/serializeToYAML.md)
- [validateCapabilities](functions/validateCapabilities.md)
- [validateDataConfig](functions/validateDataConfig.md)
- [validateFull](functions/validateFull.md)
- [validateManifest](functions/validateManifest.md)
- [validatePartialManifest](functions/validatePartialManifest.md)
- [validatePlacementRules](functions/validatePlacementRules.md)
- [validateSemantics](functions/validateSemantics.md)
- [writeManifest](functions/writeManifest.md)

## References

### PLATFORM\_CAPABILITIES

Re-exports [PLATFORM_CAPABILITIES](../../contracts/src/variables/PLATFORM_CAPABILITIES.md)

***

### PLATFORM\_WRAPPER\_METHODS

Re-exports [PLATFORM_WRAPPER_METHODS](../../contracts/src/variables/PLATFORM_WRAPPER_METHODS.md)

***

### PlatformCapability

Re-exports [PlatformCapability](../../contracts/src/type-aliases/PlatformCapability.md)
