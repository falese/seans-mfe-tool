
import type { Context } from '../context';
import { SecurityError } from '@seans-mfe/contracts';

/**
 * Who an auth event is about, as telemetry may carry it: the subject id and
 * nothing else. Telemetry leaves the process, so it never carries the bearer
 * token (a credential wherever the events are stored) or the decoded claims
 * (personal data). `sub` is the JWT subject; `id`/`userId` cover claims that
 * name it differently.
 */
function subjectOf(user: unknown): string | undefined {
  if (typeof user !== 'object' || user === null) return undefined;
  const claims = user as Record<string, unknown>;
  for (const key of ['sub', 'id', 'userId']) {
    const value = claims[key];
    if (typeof value === 'string' || typeof value === 'number') return String(value);
  }
  return undefined;
}

/**
 * Validates JWT in context and sets context.user
 * Emits telemetry events for success/failure
 *
 * `jsonwebtoken` is loaded dynamically so it stays out of any browser bundle
 * that imports the runtime package — validation only ever runs server-side
 * (BFF handler) where the dynamic require is satisfied by Node.
 *
 * @param context - request context
 * @throws Error if JWT is missing, invalid, or secret is not set
 */
export async function validateJWT(context: Context): Promise<void> {
  const token = context.jwt;
  const emit = typeof context.emit === 'function' ? context.emit : undefined;
  const secret = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.JWT_SECRET;
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
    throw new SecurityError('JWT token required');
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
    throw new SecurityError('JWT secret missing');
  }
  try {
    // Lazy require — keeps `jsonwebtoken` (and its `jws`/`crypto`/`stream`
    // transitive deps) out of the browser bundle. validateJWT only runs
    // server-side; the require is satisfied by Node (and by Jest, which is
    // CommonJS-based) at runtime.
    //
    // Direct `eval` (not indirect `(0, eval)`) preserves the CommonJS
    // closure so `require` is in scope under both Node and Jest. The eval
    // string defeats rspack/webpack static analysis, so the bundler never
    // walks the jsonwebtoken module graph (which would pull in stream/util/
    // buffer/crypto and require browser stubs to compile).
    const jwt = eval('require')('jsonwebtoken');
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
    context.user = decoded;
    if (emit) {
      await emit({
        name: 'auth.jwt.validation',
        capability: context.capability || 'unknown',
        phase: context.phase || 'unknown',
        status: 'success',
        metadata: { source: 'platform.validateJWT', subject: subjectOf(decoded), severity: 'info' },
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
          severity: 'error',
        },
        timestamp: new Date(),
      });
    }
    throw new SecurityError('Invalid JWT token: ' + (error as Error).message);
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
  const userRoles = Array.isArray(context.user?.roles) ? context.user!.roles : [];
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
          subject: subjectOf(context.user),
          severity: 'warn',
        },
        timestamp: new Date(),
      });
    }
    throw new SecurityError(
      `Insufficient permissions: required=${requiredRoles.join(',')}, actual=${userRoles.join(',')}`
    );
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
        subject: subjectOf(context.user),
        severity: 'info',
      },
      timestamp: new Date(),
    });
  }
}
