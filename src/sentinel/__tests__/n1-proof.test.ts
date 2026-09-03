/**
 * n=1 proof (PDR-010, ADR-089).
 *
 * The kernel's reuse claim is falsifiable only if SMT's existing machinery runs
 * *through* the ports with nothing MFE-shaped leaking across them. This drives
 * real SMT artifacts through each adapter and asserts the kernel sees only its own
 * types — a verdict, a list of paths, a list of files carrying the ownership seam,
 * and a HardenedCheck the kernel's own `verify` executes.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { createMinimalManifest, serializeToYAML } from '@seans-mfe/dsl';
import { verify } from 'sentinel';
import {
  smtValidate,
  smtLocateArtifacts,
  smtMaterialize,
  smtHardenedChecks,
  smtPorts,
} from '../adapters';

function tmpdir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'sentinel-n1-'));
}

describe('validate port (wraps validateFull)', () => {
  it('passes a minimal valid manifest as a clean verdict', () => {
    const outcome = smtValidate(createMinimalManifest('proof-remote'));
    expect(outcome.valid).toBe(true);
    expect(outcome.errors).toEqual([]);
  });

  it('fails an invalid artifact and maps errors to the port shape', () => {
    const outcome = smtValidate({ name: 'Not Kebab Case', version: '1.0.0' });
    expect(outcome.valid).toBe(false);
    expect(outcome.errors.length).toBeGreaterThan(0);
    for (const error of outcome.errors) {
      expect(typeof error.path).toBe('string');
      expect(typeof error.message).toBe('string');
    }
  });
});

describe('locateArtifacts port (wraps findManifest)', () => {
  it('finds a manifest written under a root', async () => {
    const dir = tmpdir();
    const manifestPath = path.join(dir, 'mfe-manifest.yaml');
    fs.writeFileSync(manifestPath, serializeToYAML(createMinimalManifest('located')));

    const found = await smtLocateArtifacts(dir);

    expect(found).toHaveLength(1);
    expect(path.basename(found[0])).toBe('mfe-manifest.yaml');
  });

  it('returns an empty list when a root holds no artifact', async () => {
    expect(await smtLocateArtifacts(tmpdir())).toEqual([]);
  });
});

describe('materialize port (wraps generateAllFiles)', () => {
  it('returns files that carry the overwrite ownership seam through the port', async () => {
    const files = await smtMaterialize(createMinimalManifest('mat-remote'), tmpdir());

    expect(files.length).toBeGreaterThan(0);
    // The seam ADR-082/043 rests on must survive the port in both states, or the
    // kernel would have flattened SMT's most important distinction.
    expect(files.some((file) => file.overwrite === true)).toBe(true);
    expect(files.some((file) => file.overwrite === false)).toBe(true);
    for (const file of files) {
      expect(typeof file.path).toBe('string');
      expect(typeof file.content).toBe('string');
    }
  });

  it('is present on SMT ports — SMT is a generating host, not audit-only', () => {
    expect(typeof smtPorts.materialize).toBe('function');
  });
});

describe('HardenedCheck port (wraps PLATFORM_MIGRATIONS, run by the kernel verify)', () => {
  it('exposes the whole SMT migration registry as kernel HardenedChecks', () => {
    expect(smtHardenedChecks.length).toBeGreaterThan(0);
    for (const check of smtHardenedChecks) {
      expect(check.pattern).toBeInstanceOf(RegExp);
      expect(check.enforces).toMatch(/^ADR-/);
      expect(check.fix.length).toBeGreaterThan(0);
    }
  });

  it('fires the typed-errors check on offending source and stays quiet on clean source', () => {
    const typedErrors = smtHardenedChecks.find((check) => check.id === 'typed-errors');
    expect(typedErrors).toBeDefined();

    const dirty = verify(typedErrors!, {
      path: 'feature.ts',
      text: 'function go() {\n  throw new Error("boom");\n}',
    });
    expect(dirty).toEqual([{ line: 2, text: 'throw new Error("boom");' }]);

    const clean = verify(typedErrors!, {
      path: 'feature.ts',
      text: 'throw new ValidationError("bad");',
    });
    expect(clean).toEqual([]);
  });
});
