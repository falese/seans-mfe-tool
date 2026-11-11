/**
 * Who may write to the registry (ADR-124).
 *
 * A registration decides what the shell loads. It names the script the shell
 * injects into its own page and the URL the daemon sends each user's bearer
 * token to. So a write is accepted only from a caller holding the registry's
 * token, `REGISTRY_TOKEN`, sent as `Authorization: Bearer <token>`.
 *
 * One shared secret for the fleet: enough to stop anything else on the network
 * registering an MFE, and no more. It does not say WHICH MFE is registering.
 *
 * Reads stay open. `GET /mfes` and `GET /rules` are how the daemon and the
 * design-time checks see what is placed where.
 *
 * Dependency-free on purpose, like slot-target.js: the registry is a
 * standalone service, and this file is tested from the repository's own jest
 * project (src/__tests__/control-plane-registry-write-auth.test.ts).
 */

import { timingSafeEqual, createHash } from 'node:crypto';

/**
 * The token the example fleets' compose files and register scripts default
 * to, so a fleet runs with one command. It is in a public repository and is
 * therefore not a secret. The registry says so every time it starts with it.
 */
export const DEV_TOKEN = 'local-dev-only';

/** Equal without the comparison's duration depending on where they differ. */
function sameToken(given, expected) {
  // Hashing first makes both sides the same length, which timingSafeEqual
  // requires, without revealing the expected length through an early return.
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * Express middleware for the registry's write routes.
 *
 * With no token configured every write is refused with 503: an unconfigured
 * registry fails closed and says what to set, rather than quietly accepting
 * registrations from anyone.
 */
export function createWriteGuard(env = process.env, warn = console.warn) {
  const expected = env.REGISTRY_TOKEN || '';

  if (!expected) {
    warn('⚠️  Registry: REGISTRY_TOKEN is not set — every write (POST /mfes, POST /render) will be refused. Set it and send it as "Authorization: Bearer <token>".');
  } else if (expected === DEV_TOKEN) {
    warn(`⚠️  Registry: running with the development token "${DEV_TOKEN}". It is published in the repository and is not a secret. Set REGISTRY_TOKEN before this registry is reachable by anything you do not trust.`);
  }

  return function writeGuard(req, res, next) {
    if (!expected) {
      res.status(503).json({
        success: false,
        error: 'This registry has no REGISTRY_TOKEN configured, so it accepts no writes.',
      });
      return;
    }

    const header = req.headers.authorization || '';
    const given = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
    if (!given || !sameToken(given, expected)) {
      res.status(401).set('WWW-Authenticate', 'Bearer').json({
        success: false,
        error: 'A registry write needs "Authorization: Bearer <REGISTRY_TOKEN>".',
      });
      return;
    }

    next();
  };
}
