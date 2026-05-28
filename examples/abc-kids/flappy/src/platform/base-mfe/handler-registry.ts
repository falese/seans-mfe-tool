
import { detectExecutionContext } from '../../handlers/detectExecutionContext';
import type { Context } from '@seans-mfe-tool/runtime';

/**
 * Handler functions sourced from external modules per the DSL manifest.
 * Injected into the MFE via `super(manifest, { customHandlers: handlerRegistry })`.
 */
export const handlerRegistry: Record<string, (context: Context) => Promise<unknown>> = {
  detectExecutionContext: detectExecutionContext as (context: Context) => Promise<unknown>,
};
