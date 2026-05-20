import { validateJWT } from '../auth-context';

describe('runtime.auth-context.validateJWT', () => {
  it('should throw if no JWT token is present', async () => {
    const context = { emit: jest.fn() } as any;
    await expect(validateJWT(context)).rejects.toThrow('JWT token required');
    expect(context.emit).toHaveBeenCalledWith(expect.objectContaining({
      name: 'auth.jwt.validation',
      status: 'error',
      metadata: expect.objectContaining({ source: 'runtime.auth-context' }),
    }));
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
    expect(emitMock).toHaveBeenCalledWith(expect.objectContaining({
      name: 'auth.jwt.validation',
      status: 'success',
      metadata: expect.objectContaining({ source: 'runtime.auth-context' }),
    }));
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
