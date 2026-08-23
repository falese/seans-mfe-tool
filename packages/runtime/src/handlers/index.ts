/**
 * The platform handler library.
 *
 * A manifest hook naming `handler: 'platform.validateInput'` is resolved to the
 * exported function of that literal name, through a Map built once at module
 * load. Adding a handler means exporting a function from one of these modules.
 * Nothing registers it anywhere.
 *
 * WHY (ADR-076, superseding ADR-025): the earlier design gave each handler a
 * class implementing a `PlatformHandler` interface — name, phases, errorConfig,
 * execute — registered into a `PlatformHandlerRegistry` that resolved them at
 * runtime. All of that ceremony bought nothing, because ADR-002's
 * before/main/after/error model already decides when a handler runs and what
 * happens when it throws. The registry was a second answer to a question the
 * lifecycle had already answered.
 *
 * So: plain `async (context) => unknown` functions, resolved by export name.
 * The seam for substituting one is `deps.customHandlers`, inside `executeHook`
 * — see the WHY on BaseMFE.invokeHandler for why there is exactly one.
 */

// Platform Handler Library Exports
export * from './auth';
export * from './validation';
export * from './telemetry';
export * from './caching';
export * from './rate-limiting';
export * from './error-handling';
