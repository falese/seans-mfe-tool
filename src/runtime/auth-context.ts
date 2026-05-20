/**
 * Authentication boundary — turns a JWT into ctx.user.
 *
 * Lives outside the platform handler library on purpose: authentication is a
 * runtime boundary concern (host shell or a runtime interceptor populates
 * ctx.user once before any capability runs). The platform handler library
 * itself stays in the realm of authorization (see ./handlers/authz.ts).
 *
 * See ADR-069.
 */

import jwt from 'jsonwebtoken';
import { Context } from './base-mfe';

/**
 * Validates context.jwt and sets context.user. Throws on missing/invalid token
 * or missing JWT_SECRET. Emits an auth.jwt.validation telemetry event tagged
 * with source 'runtime.auth-context'.
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
        metadata: { source: 'runtime.auth-context', error: 'JWT token required', severity: 'error' },
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
        metadata: { source: 'runtime.auth-context', error: 'JWT secret missing', severity: 'error' },
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
        metadata: { source: 'runtime.auth-context', user: decoded, severity: 'info' },
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
          source: 'runtime.auth-context',
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
