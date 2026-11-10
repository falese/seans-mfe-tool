/**
 * Names in a manifest become paths and identifiers in the generated project:
 * the MFE name is a package and image name, and a capability name is a
 * directory under src/features and a class. A manifest is no longer only
 * hand-written — coder:compile and the decomposition flow produce them — so a
 * name is held to a grammar that cannot carry a path or a line of code.
 */
import { DSLManifestSchema } from '../schema';

const manifest = (over: Record<string, unknown>) => ({
  name: 'crew-services',
  version: '1.0.0',
  type: 'remote',
  language: 'typescript',
  capabilities: [{ PayStatus: { type: 'domain' } }],
  ...over,
});

describe('manifest name', () => {
  it.each(['crew-services', 'abc_kids.home', 'App2', 'a'])('accepts %j', (name) => {
    expect(DSLManifestSchema.safeParse(manifest({ name })).success).toBe(true);
  });

  it.each(['../escape', 'a/b', 'a b', 'x; rm -rf', '-flag', '.hidden', 'a\\b', ''])('refuses %j', (name) => {
    const result = DSLManifestSchema.safeParse(manifest({ name }));
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('name');
  });
});

describe('capability name', () => {
  it.each(['PayStatus', 'load', 'Docking_Board', 'cargo-manifest', 'A1'])('accepts %j', (name) => {
    expect(DSLManifestSchema.safeParse(manifest({ capabilities: [{ [name]: { type: 'domain' } }] })).success).toBe(true);
  });

  it.each(['../../etc/x', 'a/b', 'a b', "x'); process.exit(", '1st', '-x', 'a.b', ''])('refuses %j', (name) => {
    const result = DSLManifestSchema.safeParse(manifest({ capabilities: [{ [name]: { type: 'domain' } }] }));
    expect(result.success).toBe(false);
  });
});
