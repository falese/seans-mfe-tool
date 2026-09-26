/**
 * sentinel:validate — the kernel run end to end, through SMT's ports (#384).
 *
 * n1-proof.test.ts shows each port in isolation. This drives all four the way
 * a host would: locate the artifact, validate it, materialize it to learn which
 * files the generator owns, then run every HardenedCheck through the kernel's
 * own `verify` over the files the generator does NOT own.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { createMinimalManifest, serializeToYAML } from '@seans-mfe/dsl';
import { ValidationError } from '@seans-mfe/contracts';
import { smtMaterialize } from '../adapters';
import { sentinelValidate } from '../validate';

function mfeDir(manifest: unknown = createMinimalManifest('sentinel-probe')): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sentinel-validate-'));
  fs.writeFileSync(path.join(dir, 'mfe-manifest.yaml'), serializeToYAML(manifest as never));
  return dir;
}

function write(dir: string, rel: string, text: string): void {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), text);
}

describe('sentinelValidate', () => {
  it('passes a valid artifact with clean sources', async () => {
    const dir = mfeDir();
    write(dir, 'src/features/Board.tsx', 'export const Board = () => null;\n');

    const result = await sentinelValidate(dir);

    expect(result.ok).toBe(true);
    expect(result.artifacts).toEqual([
      { path: 'mfe-manifest.yaml', valid: true, errors: [] },
    ]);
    expect(result.hits).toEqual([]);
    expect(result.checks).toBeGreaterThan(0);
  });

  it('reports a hardened-check hit in developer-owned code with its line and fix', async () => {
    const dir = mfeDir();
    write(dir, 'src/features/Board.tsx', 'export function f() {\n  throw new Error("x");\n}\n');

    const result = await sentinelValidate(dir);

    expect(result.ok).toBe(true); // hits advise; they do not fail the run
    expect(result.hits).toEqual([
      expect.objectContaining({
        check: 'typed-errors',
        enforces: 'ADR-017',
        location: 'src/features/Board.tsx:2',
        fix: expect.any(String),
      }),
    ]);
  });

  it('does not scan files the materialize port says the generator owns', async () => {
    const manifest = createMinimalManifest('sentinel-owned');
    const dir = mfeDir(manifest);
    const owned = (await smtMaterialize(manifest, dir))
      .filter((f) => f.overwrite && /\.(ts|tsx)$/.test(f.path))
      .map((f) => path.relative(dir, f.path))
      .find((rel) => rel.startsWith('src'));
    expect(owned).toBeDefined();
    write(dir, owned as string, 'throw new Error("generator-owned");\n');

    const result = await sentinelValidate(dir);

    expect(result.hits).toEqual([]);
  });

  it('fails an invalid artifact with the validate port’s errors', async () => {
    const dir = mfeDir({ name: 'Not Kebab Case', version: '1.0.0' });

    await expect(sentinelValidate(dir)).rejects.toBeInstanceOf(ValidationError);
  });

  it('fails when the locate port finds no artifact', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sentinel-empty-'));

    await expect(sentinelValidate(dir)).rejects.toThrow(/No artifact/);
  });
});
