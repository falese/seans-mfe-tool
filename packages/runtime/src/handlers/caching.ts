
import { Context } from '../base-mfe';

/** Cache control metadata this handler owns on the context. */
export interface CacheState {
  key?: string;
  hit?: boolean;
  ttl?: number;
  fromCache?: boolean;
}

/** Typed accessor for the cache state this handler owns on a context. */
export function getCacheState(context: Context): CacheState | undefined {
  return context.cache as CacheState | undefined;
}

export async function cacheResult(context: Context, options?: { ttl?: number }): Promise<void> {
  // Example: cache result in context (stub)
  // Real implementation would use Redis or other cache
  const emit = typeof context.emit === 'function' ? context.emit : undefined;
  if (emit) {
    await emit({
      name: 'caching.result.cache',
      capability: context.capability || 'unknown',
      phase: context.phase || 'unknown',
      status: 'success',
      metadata: { source: 'platform.cacheResult', ttl: options?.ttl, severity: 'info' },
      timestamp: new Date(),
    });
  }
}
