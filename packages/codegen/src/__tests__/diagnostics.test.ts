/**
 * The generator reports; it does not print (ADR-092).
 *
 * `@seans-mfe/codegen` wrote to stdout and stderr — missing-template warnings,
 * a "Preserved (already implemented)" line, and emoji headings from manifest
 * validation. A library that prints is not embeddable: every consumer had to
 * muzzle it (the characterization harness saves and restores three console
 * methods purely for this), it collides with the JSON-envelope contract under
 * which stdout carries exactly one `CommandResult` line (ADR-018), and it
 * duplicated output the CLI already produced from the returned value.
 *
 * These tests pin the replacement: diagnostics come back on the result, and
 * the process's console is left alone.
 */

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import type { DSLManifest } from '@seans-mfe/dsl';
import { generateAllFiles } from '../unified-generator';
import { validateManifestConfiguration } from '../manifest-validation';

const baseManifest = {
  name: 'diag-demo',
  version: '1.0.0',
  type: 'remote',
  language: 'typescript',
  capabilities: [{ Thing: { type: 'domain', description: 'a thing' } }],
} as unknown as DSLManifest;

/** Capture anything written to the console during `fn`. */
async function captureConsole(fn: () => Promise<void>): Promise<string[]> {
  const written: string[] = [];
  const real = { log: console.log, warn: console.warn, error: console.error };
  console.log = (...a: unknown[]) => void written.push(`log: ${a.join(' ')}`);
  console.warn = (...a: unknown[]) => void written.push(`warn: ${a.join(' ')}`);
  console.error = (...a: unknown[]) => void written.push(`error: ${a.join(' ')}`);
  try {
    await fn();
  } finally {
    Object.assign(console, real);
  }
  return written;
}

describe('generateAllFiles', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'diag-'));
  });
  afterEach(async () => {
    await fs.remove(dir);
  });

  it('writes nothing to the console', async () => {
    const written = await captureConsole(async () => {
      await generateAllFiles(baseManifest, dir);
    });
    expect(written).toEqual([]);
  });

  it('returns diagnostics on the result', async () => {
    const result = await generateAllFiles(baseManifest, dir);
    expect(Array.isArray(result.diagnostics)).toBe(true);
  });

  it('reports a manifest-validation warning instead of printing it', async () => {
    const manifest = { ...baseManifest, transforms: ['notARealTransform'] } as DSLManifest;

    const written = await captureConsole(async () => {
      const result = await generateAllFiles(manifest, dir);
      expect(result.diagnostics.some((d) => d.message.includes('notARealTransform'))).toBe(true);
    });
    expect(written).toEqual([]);
  });

  it('reports preserved capabilities through the result, not a printed line', async () => {
    // The CLI already prints this from `preservedCapabilities`. The generator
    // printing it too produced the line twice on every run that preserved
    // anything.
    await generateAllFiles(baseManifest, dir);
    const featureDir = path.join(dir, 'src', 'features', 'Thing');
    await fs.outputFile(path.join(featureDir, 'Thing.tsx'), 'export const Thing = () => null;\n');

    const written = await captureConsole(async () => {
      const result = await generateAllFiles(baseManifest, dir);
      expect(result.preservedCapabilities).toEqual(['Thing']);
    });
    expect(written).toEqual([]);
  });
});

describe('validateManifestConfiguration', () => {
  it('returns its findings rather than printing them', async () => {
    const written = await captureConsole(async () => {
      const result = validateManifestConfiguration(baseManifest);
      expect(result.ok).toBe(true);
      expect(result.diagnostics).toEqual([]);
    });
    expect(written).toEqual([]);
  });

  it('reports a misclassified entry as an error diagnostic', () => {
    // `filterSchema` is a transform; declaring it as a plugin is the
    // misclassification ADR-027 exists to catch and ADR-090 single-sourced.
    const manifest = {
      ...baseManifest,
      plugins: { filterSchema: {} },
    } as unknown as DSLManifest;

    const result = validateManifestConfiguration(manifest);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.severity === 'error')).toBe(true);
  });

  it('still refuses to generate from a misconfigured manifest', async () => {
    // Reporting instead of printing does not mean reporting instead of
    // refusing: ADR-027's point is that generating from a bad configuration
    // and failing later, in a container, is the outcome to prevent.
    const manifest = {
      ...baseManifest,
      plugins: { filterSchema: {} },
    } as unknown as DSLManifest;

    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'diag-bad-'));
    try {
      await expect(generateAllFiles(manifest, dir)).rejects.toThrow(/validation failed/i);
    } finally {
      await fs.remove(dir);
    }
  });
});
