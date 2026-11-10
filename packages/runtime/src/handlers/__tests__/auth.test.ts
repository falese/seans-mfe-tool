import { validateJWT, checkPermissions } from '../auth';

describe('platform.validateJWT', () => {
  it('should throw if no JWT token is present', async () => {
    const context = { emit: jest.fn() } as any;
    await expect(validateJWT(context)).rejects.toThrow('JWT token required');
    expect(context.emit).toHaveBeenCalledWith(expect.objectContaining({ name: 'auth.jwt.validation', status: 'error' }));
  });

  it('should throw if JWT secret is missing', async () => {
    const emitMock = jest.fn();
    const context = { jwt: 'sometoken', emit: emitMock } as any;
    const oldSecret = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    await expect(validateJWT(context)).rejects.toThrow('JWT secret missing');
    expect(emitMock).toHaveBeenCalledWith(expect.objectContaining({ name: 'auth.jwt.validation', status: 'error' }));
    process.env.JWT_SECRET = oldSecret;
  });

  it('should emit error and throw if JWT is invalid', async () => {
    const emitMock = jest.fn();
    const context = { jwt: 'badtoken', emit: emitMock } as any;
    process.env.JWT_SECRET = 'testsecret';
    jest.spyOn(require('jsonwebtoken'), 'verify').mockImplementation(() => { throw new Error('bad jwt'); });
    await expect(validateJWT(context)).rejects.toThrow(/Invalid JWT token: bad jwt/);
    expect(emitMock).toHaveBeenCalledWith(expect.objectContaining({ name: 'auth.jwt.validation', status: 'error' }));
  });

  it('should set user and emit info if JWT is valid', async () => {
    const emitMock = jest.fn();
    const decoded = { sub: '123', username: 'test', roles: ['admin'] };
    const context = { jwt: 'goodtoken', emit: emitMock } as any;
    process.env.JWT_SECRET = 'testsecret';
    jest.spyOn(require('jsonwebtoken'), 'verify').mockReturnValue(decoded);
    await validateJWT(context);
    expect(context.user).toEqual(decoded);
    expect(emitMock).toHaveBeenCalledWith(expect.objectContaining({ name: 'auth.jwt.validation', status: 'success' }));
  });

  it('should work if emit is missing', async () => {
    const decoded = { sub: '123', username: 'test', roles: ['admin'] };
    const context = { jwt: 'goodtoken' } as any;
    process.env.JWT_SECRET = 'testsecret';
    jest.spyOn(require('jsonwebtoken'), 'verify').mockReturnValue(decoded);
    await expect(validateJWT(context)).resolves.toBeUndefined();
    expect(context.user).toEqual(decoded);
  });

  it('should work if emit is not a function', async () => {
    const decoded = { sub: '123', username: 'test', roles: ['admin'] };
    const context = { jwt: 'goodtoken', emit: 42 } as any;
    process.env.JWT_SECRET = 'testsecret';
    jest.spyOn(require('jsonwebtoken'), 'verify').mockReturnValue(decoded);
    await expect(validateJWT(context)).resolves.toBeUndefined();
    expect(context.user).toEqual(decoded);
  });
});

describe('platform.checkPermissions', () => {
  it('should throw and emit warn if user lacks required roles', async () => {
    const emitMock = jest.fn();
    const context = { user: { roles: ['user'] }, emit: emitMock } as any;
    await expect(checkPermissions(context, ['admin'])).rejects.toThrow(/Insufficient permissions/);
    expect(emitMock).toHaveBeenCalledWith(expect.objectContaining({ name: 'auth.permissions.check', status: 'failure' }));
  });

  it('should emit info if user has required roles', async () => {
    const emitMock = jest.fn();
    const context = { user: { roles: ['admin'] }, emit: emitMock } as any;
    await checkPermissions(context, ['admin']);
    expect(emitMock).toHaveBeenCalledWith(expect.objectContaining({ name: 'auth.permissions.check', status: 'success' }));
  });

  it('should work if emit is missing', async () => {
    const context = { user: { roles: ['admin'] } } as any;
    await expect(checkPermissions(context, ['admin'])).resolves.toBeUndefined();
  });

  it('should work if emit is not a function', async () => {
    const context = { user: { roles: ['admin'] }, emit: 42 } as any;
    await expect(checkPermissions(context, ['admin'])).resolves.toBeUndefined();
  });

  it('should default userRoles to empty array if not present', async () => {
    const context = { user: {}, emit: jest.fn() } as any;
    await expect(checkPermissions(context, ['admin'])).rejects.toThrow(/Insufficient permissions/);
  });

  it('should throw if requiredRoles is empty', async () => {
    const context = { user: { roles: ['admin'] }, emit: jest.fn() } as any;
    await expect(checkPermissions(context, [])).rejects.toThrow(/Insufficient permissions/);
  });
});

/**
 * Telemetry leaves the process. A bearer token in it is a credential in
 * whatever stores the events, and the decoded claims are personal data; the
 * event needs neither to say who failed and why.
 */
describe('auth telemetry carries no credential and no claims', () => {
  const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1LTEifQ.c2lnbmF0dXJl';
  const CLAIMS = { sub: 'u-1', email: 'person@example.com', roles: ['viewer'], iat: 1 };
  const emitted = (emit: jest.Mock): string => JSON.stringify(emit.mock.calls);

  beforeEach(() => {
    process.env.JWT_SECRET = 'testsecret';
  });

  it('does not emit the token when validation fails', async () => {
    const emit = jest.fn();
    jest.spyOn(require('jsonwebtoken'), 'verify').mockImplementation(() => { throw new Error('jwt expired'); });
    await expect(validateJWT({ jwt: TOKEN, emit } as any)).rejects.toThrow(/jwt expired/);
    expect(emitted(emit)).not.toContain(TOKEN);
    expect(emit.mock.calls[0][0].metadata).not.toHaveProperty('token');
  });

  it('emits the subject, not the claims, when validation succeeds', async () => {
    const emit = jest.fn();
    jest.spyOn(require('jsonwebtoken'), 'verify').mockReturnValue(CLAIMS);
    await validateJWT({ jwt: TOKEN, emit } as any);
    const { metadata } = emit.mock.calls[0][0];
    expect(metadata).not.toHaveProperty('user');
    expect(metadata.subject).toBe('u-1');
    expect(emitted(emit)).not.toContain('person@example.com');
    expect(emitted(emit)).not.toContain(TOKEN);
  });

  it.each([
    ['denied', ['admin']],
    ['granted', ['viewer']],
  ])('emits the subject, not the claims, when permission is %s', async (_outcome, required) => {
    const emit = jest.fn();
    const run = checkPermissions({ user: CLAIMS, emit } as any, required);
    await (required[0] === 'admin' ? expect(run).rejects.toThrow(/Insufficient permissions/) : run);
    const { metadata } = emit.mock.calls[0][0];
    expect(metadata).not.toHaveProperty('user');
    expect(metadata.subject).toBe('u-1');
    expect(emitted(emit)).not.toContain('person@example.com');
  });
});
