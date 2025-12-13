import { validateJWT, checkPermissions } from '../auth';

describe('platform.validateJWT', () => {
  it('should throw if no JWT token is present', async () => {
    const context = { emit: jest.fn() } as any;
    await expect(validateJWT(context)).rejects.toThrow('JWT token required');
    expect(context.emit).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'error' }));
  });

  it('should throw if JWT secret is missing', async () => {
    const emitMock = jest.fn();
    const context = { jwt: 'sometoken', emit: emitMock } as any;
    const oldSecret = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    await expect(validateJWT(context)).rejects.toThrow('JWT secret missing');
    expect(emitMock).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'error' }));
    process.env.JWT_SECRET = oldSecret;
  });

  it('should emit error and throw if JWT is invalid', async () => {
    const emitMock = jest.fn();
    const context = { jwt: 'badtoken', emit: emitMock } as any;
    process.env.JWT_SECRET = 'testsecret';
    jest.spyOn(require('jsonwebtoken'), 'verify').mockImplementation(() => { throw new Error('bad jwt'); });
    await expect(validateJWT(context)).rejects.toThrow(/Invalid JWT token: bad jwt/);
    expect(emitMock).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'error' }));
  });

  it('should set user and emit info if JWT is valid', async () => {
    const emitMock = jest.fn();
    const decoded = { sub: '123', username: 'test', roles: ['admin'] };
    const context = { jwt: 'goodtoken', emit: emitMock } as any;
    process.env.JWT_SECRET = 'testsecret';
    jest.spyOn(require('jsonwebtoken'), 'verify').mockReturnValue(decoded);
    await validateJWT(context);
    expect(context.user).toEqual(decoded);
    expect(emitMock).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'info' }));
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
    expect(emitMock).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'warn' }));
  });

  it('should emit info if user has required roles', async () => {
    const emitMock = jest.fn();
    const context = { user: { roles: ['admin'] }, emit: emitMock } as any;
    await checkPermissions(context, ['admin']);
    expect(emitMock).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'info' }));
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
