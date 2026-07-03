[**seans-mfe-tool API reference**](../../README.md)

***

[seans-mfe-tool API reference](../../README.md) / runtime/src

# runtime/src

## Classes

- [BaseControlPlane](classes/BaseControlPlane.md)
- [BaseMFE](classes/BaseMFE.md)
- [ContextFactory](classes/ContextFactory.md)
- [ContextValidator](classes/ContextValidator.md)
- [DaemonChannel](classes/DaemonChannel.md)
- [GraphQLTransportWsDaemonTransport](classes/GraphQLTransportWsDaemonTransport.md)
- [GraphQLWebSocketClient](classes/GraphQLWebSocketClient.md)
- [LayoutManager](classes/LayoutManager.md)
- [RemoteMFE](classes/RemoteMFE.md)

## Interfaces

- [AdaptorHelpers](interfaces/AdaptorHelpers.md)
- [CacheState](interfaces/CacheState.md)
- [ChannelTransport](interfaces/ChannelTransport.md)
- [Context](interfaces/Context.md)
- [ControlPlaneConfig](interfaces/ControlPlaneConfig.md)
- [ControlPlaneHealth](interfaces/ControlPlaneHealth.md)
- [ControlPlaneStateResult](interfaces/ControlPlaneStateResult.md)
- [DaemonEnvelope](interfaces/DaemonEnvelope.md)
- [DaemonTransport](interfaces/DaemonTransport.md)
- [DaemonWebSocketClient](interfaces/DaemonWebSocketClient.md)
- [DescribeResult](interfaces/DescribeResult.md)
- [EmitResult](interfaces/EmitResult.md)
- [ErrorHandlingState](interfaces/ErrorHandlingState.md)
- [ExperienceAdaptor](interfaces/ExperienceAdaptor.md)
- [HealthResult](interfaces/HealthResult.md)
- [ImperativeHandleOptions](interfaces/ImperativeHandleOptions.md)
- [LayoutHostLike](interfaces/LayoutHostLike.md)
- [LayoutManagerConfig](interfaces/LayoutManagerConfig.md)
- [LoadResult](interfaces/LoadResult.md)
- [ModuleFederationContainer](interfaces/ModuleFederationContainer.md)
- [MountableLifecycle](interfaces/MountableLifecycle.md)
- [QueryInput](interfaces/QueryInput.md)
- [QueryResult](interfaces/QueryResult.md)
- [RenderResult](interfaces/RenderResult.md)
- [SchemaResult](interfaces/SchemaResult.md)
- [SlotElementLike](interfaces/SlotElementLike.md)
- [SlotErrorInfo](interfaces/SlotErrorInfo.md)
- [TelemetryEvent](interfaces/TelemetryEvent.md)
- [UserContext](interfaces/UserContext.md)
- [ValidationError](interfaces/ValidationError.md)
- [ValidationState](interfaces/ValidationState.md)
- [WebSocketLike](interfaces/WebSocketLike.md)

## Type Aliases

- [ControlPlaneStatus](type-aliases/ControlPlaneStatus.md)
- [MFEState](type-aliases/MFEState.md)
- [TransportStatus](type-aliases/TransportStatus.md)
- [UnmountFn](type-aliases/UnmountFn.md)

## Variables

- [htmlAdaptor](variables/htmlAdaptor.md)
- [jsonAdaptor](variables/jsonAdaptor.md)
- [moduleFederationAdaptor](variables/moduleFederationAdaptor.md)
- [VALID\_TRANSITIONS](variables/VALID_TRANSITIONS.md)

## Functions

- [cacheResult](functions/cacheResult.md)
- [checkPermissions](functions/checkPermissions.md)
- [createImperativeHandle](functions/createImperativeHandle.md)
- [getCacheState](functions/getCacheState.md)
- [getErrorHandlingState](functions/getErrorHandlingState.md)
- [getValidationState](functions/getValidationState.md)
- [handleError](functions/handleError.md)
- [isBaseControlPlane](functions/isBaseControlPlane.md)
- [logTelemetry](functions/logTelemetry.md)
- [rateLimitCheck](functions/rateLimitCheck.md)
- [sanitizeInputs](functions/sanitizeInputs.md)
- [validateInputs](functions/validateInputs.md)
- [validateJWT](functions/validateJWT.md)
