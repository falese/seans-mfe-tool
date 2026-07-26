/**
 * buildArgv turns a tool call into CLI argv, which means it has to know which
 * inputs the command takes positionally and which are flags.
 *
 * It used to guess from a hardcoded `new Set(['name', 'spec'])`. `spec` is not
 * a positional on any command — `api` declares it as `--spec` — so an agent
 * calling `mfe:api` with a spec produced `["api", "myapi", "./s.yaml"]`, a
 * second positional that a `strict: true` command rejects.
 *
 * The command's own arg declarations are now carried in the schema as
 * `x-positional` (see src/oclif/schema-derivation.ts) and used here.
 *
 * Refs #139 · ADR-019 · ADR-077
 */

import { buildArgv } from '../tool-registry';

describe('buildArgv positional handling', () => {
  it('places declared args positionally and everything else as flags', () => {
    const argv = buildArgv(
      'mfe:api',
      { name: 'harbormaster', spec: './specs/h.yaml', database: 'sqlite' },
      ['name'],
    );
    expect(argv[0]).toBe('api');
    expect(argv[1]).toBe('harbormaster');
    expect(argv).toContain('--spec');
    expect(argv[argv.indexOf('--spec') + 1]).toBe('./specs/h.yaml');
    expect(argv).toEqual(expect.arrayContaining(['--database', 'sqlite']));
  });

  it('does NOT treat spec as a positional — the bug this replaces', () => {
    const argv = buildArgv('mfe:api', { name: 'x', spec: './s.yaml' }, ['name']);
    // 'api', 'x', then flags — './s.yaml' must never sit in positional slot 2.
    expect(argv[2]).not.toBe('./s.yaml');
    expect(argv.slice(0, 2)).toEqual(['api', 'x']);
  });

  it('honours declaration order for multiple positionals', () => {
    const argv = buildArgv('mfe:x', { second: 'b', first: 'a' }, ['first', 'second']);
    expect(argv.slice(0, 3)).toEqual(['x', 'a', 'b']);
  });

  it('omits a positional the caller did not supply', () => {
    const argv = buildArgv('mfe:x', { second: 'b' }, ['first', 'second']);
    expect(argv.slice(0, 2)).toEqual(['x', 'b']);
  });

  it('still never forwards the reserved cwd', () => {
    const argv = buildArgv('mfe:remote:generate', { cwd: '/tmp/x', force: true }, []);
    expect(argv).toEqual(['remote:generate', '--force', '--json']);
  });

  it('falls back to `name` when a tool declares no positionals (third-party plugin schemas)', () => {
    const argv = buildArgv('mfe:bff:init', { name: 'svc', port: 3000 });
    expect(argv.slice(0, 2)).toEqual(['bff:init', 'svc']);
    expect(argv).toEqual(expect.arrayContaining(['--port', '3000']));
  });

  it('always terminates with --json', () => {
    expect(buildArgv('mfe:x', {}, []).at(-1)).toBe('--json');
  });

  it('expands repeatable values into repeated flags', () => {
    const argv = buildArgv('mfe:bff:init', { specs: ['a.yaml', 'b.yaml'] }, ['name']);
    expect(argv).toEqual(['bff:init', '--specs', 'a.yaml', '--specs', 'b.yaml', '--json']);
  });

  it('omits false booleans and includes true ones', () => {
    const argv = buildArgv('mfe:x', { force: true, quiet: false }, []);
    expect(argv).toContain('--force');
    expect(argv).not.toContain('--quiet');
  });
});
