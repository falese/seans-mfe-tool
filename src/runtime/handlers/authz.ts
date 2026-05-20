/**
 * Authorization platform handlers.
 *
 * These handlers assume context.user has already been populated by the
 * authentication boundary (src/runtime/auth-context.ts). They only make
 * permission decisions; they do not validate JWTs.
 *
 * See ADR-069.
 */

import { Context } from '../base-mfe';

/**
 * Throws if context.user.roles does not include at least one of requiredRoles.
 * Emits authz.permissions.check telemetry tagged with source
 * 'platform.authz.checkPermissions'.
 */
export async function checkPermissions(context: Context, requiredRoles: string[]): Promise<void> {
  const emit = typeof context.emit === 'function' ? context.emit : undefined;
  const userRoles = Array.isArray(context.user?.roles) ? context.user.roles : [];
  const hasPermission = requiredRoles.some(role => userRoles.includes(role));
  if (!hasPermission) {
    if (emit) {
      await emit({
        name: 'authz.permissions.check',
        capability: context.capability || 'unknown',
        phase: context.phase || 'unknown',
        status: 'failure',
        metadata: {
          source: 'platform.authz.checkPermissions',
          required: requiredRoles,
          actual: userRoles,
          user: context.user,
          severity: 'warn',
        },
        timestamp: new Date(),
      });
    }
    throw new Error(`Insufficient permissions: required=${requiredRoles.join(',')}, actual=${userRoles.join(',')}`);
  }
  if (emit) {
    await emit({
      name: 'authz.permissions.check',
      capability: context.capability || 'unknown',
      phase: context.phase || 'unknown',
      status: 'success',
      metadata: {
        source: 'platform.authz.checkPermissions',
        required: requiredRoles,
        actual: userRoles,
        user: context.user,
        severity: 'info',
      },
      timestamp: new Date(),
    });
  }
}
