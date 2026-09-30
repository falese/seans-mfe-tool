/**
 * `hosts:` — the shells an MFE declares it works in (ADR-107).
 *
 * A host is named by the `namespace` its project declares in
 * `control-plane.yaml` (ADR-083 §1) — the identity the platform already treats
 * as unique per deploying project. Each entry is an object, not a bare string,
 * so a host's own access-management block can be added later without a second
 * spelling; until then any other key is rejected rather than silently stripped.
 */
import { DSLManifestSchema, HostSchema, HostsSchema } from '../schema';

const baseManifest = {
  name: 'abc-kids-flappy',
  version: '1.0.0',
  type: 'remote',
  language: 'typescript',
  capabilities: [{ PlayGame: { type: 'domain' } }],
};

describe('HostSchema (ADR-107)', () => {
  it('accepts a host named by its control-plane namespace', () => {
    expect(HostSchema.parse({ id: 'meridian' })).toEqual({ id: 'meridian' });
  });

  it('rejects an id that is not a valid namespace', () => {
    expect(HostSchema.safeParse({ id: 'meridian.station' }).success).toBe(false);
    expect(HostSchema.safeParse({ id: '9lives' }).success).toBe(false);
    expect(HostSchema.safeParse({ id: '' }).success).toBe(false);
  });

  it('rejects keys it does not define yet — IAM is reserved, not accepted', () => {
    // A stripped `auth:` block would read as configured and do nothing.
    const result = HostSchema.safeParse({ id: 'meridian', auth: { scheme: 'oidc' } });
    expect(result.success).toBe(false);
  });

  it('rejects the bare-string shorthand — one spelling only', () => {
    expect(HostSchema.safeParse('meridian').success).toBe(false);
  });
});

describe('HostsSchema (ADR-107)', () => {
  it('accepts several hosts', () => {
    expect(HostsSchema.parse([{ id: 'abc' }, { id: 'meridian' }])).toHaveLength(2);
  });

  it('rejects an empty list — declaring no host is the same as not declaring', () => {
    expect(HostsSchema.safeParse([]).success).toBe(false);
  });

  it('rejects the same host twice', () => {
    const result = HostsSchema.safeParse([{ id: 'abc' }, { id: 'abc' }]);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toContain('abc');
  });
});

describe('DSLManifestSchema — hosts', () => {
  it('keeps a declared hosts list (the manifest object is non-strict, so it must be declared)', () => {
    const parsed = DSLManifestSchema.parse({ ...baseManifest, hosts: [{ id: 'abc' }, { id: 'meridian' }] });
    expect(parsed.hosts).toEqual([{ id: 'abc' }, { id: 'meridian' }]);
  });

  it('parses a manifest without hosts — the requirement is enforced by validation, not parsing', () => {
    // Every loader in the CLI parses manifests; failing here would turn one
    // missing declaration into an unreadable manifest everywhere. mfe:validate
    // and compose report it instead, with the file and the fix.
    expect(DSLManifestSchema.safeParse(baseManifest).success).toBe(true);
  });
});
