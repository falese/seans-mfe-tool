import { checkPermissions } from '../authz';

describe('platform.authz.checkPermissions', () => {
  it('should throw and emit warn if user lacks required roles', async () => {
    const emitMock = jest.fn();
    const context = { user: { roles: ['user'] }, emit: emitMock } as any;
    await expect(checkPermissions(context, ['admin'])).rejects.toThrow(/Insufficient permissions/);
    expect(emitMock).toHaveBeenCalledWith(expect.objectContaining({
      name: 'authz.permissions.check',
      status: 'failure',
      metadata: expect.objectContaining({ source: 'platform.authz.checkPermissions' }),
    }));
  });

  it('should emit info if user has required roles', async () => {
    const emitMock = jest.fn();
    const context = { user: { roles: ['admin'] }, emit: emitMock } as any;
    await checkPermissions(context, ['admin']);
    expect(emitMock).toHaveBeenCalledWith(expect.objectContaining({
      name: 'authz.permissions.check',
      status: 'success',
      metadata: expect.objectContaining({ source: 'platform.authz.checkPermissions' }),
    }));
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
