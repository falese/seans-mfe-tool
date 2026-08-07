import { childStdio, JSON_MODE_ENV } from '../child-stdio';

describe('childStdio (ADR-018)', () => {
  it('inherits stdout normally, so human output is unchanged', () => {
    // [0, 1, 2] is exactly what stdio: 'inherit' does. Human mode must not
    // change at all — this fix is only about --json.
    expect(childStdio({})).toEqual([0, 1, 2]);
  });

  it('routes the child stdout to fd 2 under --json', () => {
    // The whole point: the parent cannot patch a file descriptor a *different*
    // process writes to, so the redirect has to happen when the child is
    // created. fd 2 keeps the output visible without polluting the envelope.
    expect(childStdio({ [JSON_MODE_ENV]: '1' })).toEqual([0, 2, 2]);
  });

  it('always leaves stderr on fd 2', () => {
    for (const env of [{}, { [JSON_MODE_ENV]: '1' }]) {
      expect(childStdio(env)[2]).toBe(2);
    }
  });

  it('always leaves stdin on fd 0', () => {
    // Not 'ignore': bff:dev is long-running and stdin-inheriting today, and
    // silently changing that is a behaviour change this fix has no business
    // making.
    for (const env of [{}, { [JSON_MODE_ENV]: '1' }]) {
      expect(childStdio(env)[0]).toBe(0);
    }
  });

  it('treats an empty marker as not set', () => {
    // `env: { ...process.env }` spreads an unset variable as undefined, and
    // some shells hand through an empty string. Neither means json mode.
    expect(childStdio({ [JSON_MODE_ENV]: '' })).toEqual([0, 1, 2]);
  });

  it('reads process.env when given no argument', () => {
    const previous = process.env[JSON_MODE_ENV];
    try {
      process.env[JSON_MODE_ENV] = '1';
      expect(childStdio()).toEqual([0, 2, 2]);
      delete process.env[JSON_MODE_ENV];
      expect(childStdio()).toEqual([0, 1, 2]);
    } finally {
      if (previous === undefined) delete process.env[JSON_MODE_ENV];
      else process.env[JSON_MODE_ENV] = previous;
    }
  });
});
