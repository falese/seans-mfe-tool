
import { Context } from '../base-mfe';
import jwt from 'jsonwebtoken';

/**
 * Validates JWT in context and sets context.user
 * Emits telemetry events for success/failure
 * @param context - request context
 * @throws Error if JWT is missing, invalid, or secret is not set
 */
export async function validateJWT(context: Context): Promise<void> {
  const token = context.jwt;
  const emit = typeof context.emit === 'function' ? context.emit : undefined;
  const secret = process.env.JWT_SECRET;
  if (!token) {
    if (emit) {
      await emit({
        name: 'auth.jwt.validation',
        capability: context.capability || 'unknown',
        phase: context.phase || 'unknown',
        status: 'error',
        metadata: { source: 'platform.validateJWT', error: 'JWT token required', severity: 'error' },
        timestamp: new Date(),
      });
    }
    throw new Error('JWT token required');
  }
  if (!secret) {
    if (emit) {
      await emit({
        name: 'auth.jwt.validation',
        capability: context.capability || 'unknown',
        phase: context.phase || 'unknown',
        status: 'error',
        metadata: { source: 'platform.validateJWT', error: 'JWT secret missing', severity: 'error' },
        timestamp: new Date(),
      });
    }
    throw new Error('JWT secret missing');
  }
  try {
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
    context.user = decoded;
    if (emit) {
      await emit({
        name: 'auth.jwt.validation',
        capability: context.capability || 'unknown',
        phase: context.phase || 'unknown',
        status: 'success',
        metadata: { source: 'platform.validateJWT', user: decoded, severity: 'info' },
        timestamp: new Date(),
      });
    }
  } catch (error) {
    if (emit) {
      await emit({
        name: 'auth.jwt.validation',
        capability: context.capability || 'unknown',
        phase: context.phase || 'unknown',
        status: 'error',
        metadata: {
          source: 'platform.validateJWT',
          error: (error as Error).message,
          token,
          severity: 'error',
        },
        timestamp: new Date(),
      });
    }
    throw new Error('Invalid JWT token: ' + (error as Error).message);
  }
}

/**
 * Checks if context.user has required roles
 * Emits telemetry for success/failure
 * @param context - request context
 * @param requiredRoles - array of required roles (any match)
 * @throws Error if user lacks required roles
 */
export async function checkPermissions(context: Context, requiredRoles: string[]): Promise<void> {
  const emit = typeof context.emit === 'function' ? context.emit : undefined;
  const userRoles = Array.isArray(context.user?.roles) ? context.user.roles : [];
  // Any required role suffices (documented)
  const hasPermission = requiredRoles.some(role => userRoles.includes(role));
  if (!hasPermission) {
    if (emit) {
      await emit({
        name: 'auth.permissions.check',
        capability: context.capability || 'unknown',
        phase: context.phase || 'unknown',
        status: 'failure',
        metadata: {
          source: 'platform.checkPermissions',
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
      name: 'auth.permissions.check',
      capability: context.capability || 'unknown',
      phase: context.phase || 'unknown',
      status: 'success',
      metadata: {
        source: 'platform.checkPermissions',
        required: requiredRoles,
        actual: userRoles,
        user: context.user,
        severity: 'info',
      },
      timestamp: new Date(),
    });
  }
}
