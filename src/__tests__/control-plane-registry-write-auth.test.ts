/**
 * The registry accepts a write only from a caller holding its token (ADR-124).
 *
 * `POST /mfes` decides what the shell loads: the registration names the
 * script the shell injects into its own page, and the URL the daemon sends
 * each user's bearer token to. It took a registration from anyone who could
 * reach the port.
 *
 * The guard is a dependency-free module so it can be tested here, the way
 * slot-target.js is: the registry is a standalone service with its own
 * node_modules, outside this repository's jest project.
 */
import * as path from 'path';

type Guard = (req: { headers: Record<string, string | undefined> }, res: FakeRes, next: () => void) => void;
interface FakeRes {
  statusCode?: number;
  body?: unknown;
  headers: Record<string, string>;
  status(code: number): FakeRes;
  set(name: string, value: string): FakeRes;
  json(body: unknown): FakeRes;
}

/** The registry module is ESM-only JS; jest transpiles it on require. */
const { createWriteGuard, DEV_TOKEN } = require(
  path.join(__dirname, '../../packages/control-plane/registry/write-auth.js'),
) as { createWriteGuard: (env: Record<string, string | undefined>, warn?: (m: string) => void) => Guard; DEV_TOKEN: string };

function res(): FakeRes {
  const r: FakeRes = {
    headers: {},
    status(code) { r.statusCode = code; return r; },
    set(name, value) { r.headers[name] = value; return r; },
    json(body) { r.body = body; return r; },
  };
  return r;
}

const call = (guard: Guard, authorization?: string) => {
  const r = res();
  const next = jest.fn();
  guard({ headers: { authorization } }, r, next);
  return { r, next };
};

const TOKEN = 'correct-horse-battery-staple';

describe('the registry write guard', () => {
  const guard = createWriteGuard({ REGISTRY_TOKEN: TOKEN }, () => undefined);

  it('lets a write through with the token', () => {
    const { r, next } = call(guard, `Bearer ${TOKEN}`);
    expect(next).toHaveBeenCalledTimes(1);
    expect(r.statusCode).toBeUndefined();
  });

  it.each([
    ['no Authorization header', undefined],
    ['the wrong token', 'Bearer not-the-token'],
    ['a token that is a prefix of the right one', `Bearer ${TOKEN.slice(0, -1)}`],
    ['the right token with more appended', `Bearer ${TOKEN}x`],
    ['the token without the Bearer scheme', TOKEN],
    ['another scheme', `Basic ${TOKEN}`],
    ['an empty bearer', 'Bearer '],
  ])('refuses %s with 401 and does not run the handler', (_label, authorization) => {
    const { r, next } = call(guard, authorization);
    expect(next).not.toHaveBeenCalled();
    expect(r.statusCode).toBe(401);
    expect(r.headers['WWW-Authenticate']).toBe('Bearer');
    expect(JSON.stringify(r.body)).not.toContain(TOKEN);
  });
});

describe('a registry started without a token', () => {
  it('refuses every write, and says how to configure one', () => {
    const guard = createWriteGuard({}, () => undefined);
    const { r, next } = call(guard, 'Bearer anything');
    expect(next).not.toHaveBeenCalled();
    expect(r.statusCode).toBe(503);
    expect(JSON.stringify(r.body)).toContain('REGISTRY_TOKEN');
  });

  it('treats an empty token as none, rather than as a token anyone can send', () => {
    const guard = createWriteGuard({ REGISTRY_TOKEN: '' }, () => undefined);
    expect(call(guard, 'Bearer ').next).not.toHaveBeenCalled();
  });

  it('warns at startup', () => {
    const warn = jest.fn();
    createWriteGuard({}, warn);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('REGISTRY_TOKEN'));
  });
});

describe('the development token the example fleets ship with', () => {
  it('works, so a fleet runs out of the box', () => {
    const guard = createWriteGuard({ REGISTRY_TOKEN: DEV_TOKEN }, () => undefined);
    expect(call(guard, `Bearer ${DEV_TOKEN}`).next).toHaveBeenCalled();
  });

  it('is announced at startup as not a secret', () => {
    const warn = jest.fn();
    createWriteGuard({ REGISTRY_TOKEN: DEV_TOKEN }, warn);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/development token/i));
  });

  it('says nothing when a real token is set', () => {
    const warn = jest.fn();
    createWriteGuard({ REGISTRY_TOKEN: TOKEN }, warn);
    expect(warn).not.toHaveBeenCalled();
  });
});
