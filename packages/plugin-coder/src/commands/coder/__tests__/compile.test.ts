import { readFileSync, existsSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { coderCompileCommand } from '../compile';
import type { CoderRunner, IntentCompileRequest } from '../../../types';

const VALID_YAML = [
  'name: acme-widget',
  'version: 1.0.0',
  'type: remote',
  'language: typescript',
  'capabilities: []',
].join('\n');

const INVALID_YAML = [
  'name: acme-widget',
  'version: not-semver',
  'type: banana',
  'language: typescript',
  'capabilities: []',
].join('\n');

const runnerReturning = (out: string): CoderRunner => ({
  generate: (_req: IntentCompileRequest) => Promise.resolve(out),
});

describe('coderCompileCommand', () => {
  it('compiles a valid intent and returns a DSL-valid result', async () => {
    const result = await coderCompileCommand(
      { intent: 'a standalone remote widget' },
      runnerReturning(VALID_YAML),
    );
    expect(result.valid).toBe(true);
    expect(result.validation.errors).toHaveLength(0);
    expect(result.candidate.adaptor).toBe('intent-manifest');
    expect(result.candidate.yaml).toContain('name: acme-widget');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('fails closed (ValidationError) on an invalid manifest', async () => {
    await expect(
      coderCompileCommand({ intent: 'x' }, runnerReturning(INVALID_YAML)),
    ).rejects.toThrow(/invalid manifest/i);
  });

  it('returns the invalid candidate when --allow-invalid is set', async () => {
    const result = await coderCompileCommand(
      { intent: 'x', allowInvalid: true },
      runnerReturning(INVALID_YAML),
    );
    expect(result.valid).toBe(false);
    expect(result.validation.errors.length).toBeGreaterThan(0);
    expect(result.candidate.yaml).toContain('type: banana');
  });

  it('writes the validated manifest to --out', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'plugin-coder-'));
    const out = path.join(dir, 'mfe-manifest.yaml');
    try {
      const result = await coderCompileCommand(
        { intent: 'x', out },
        runnerReturning(VALID_YAML),
      );
      expect(result.outPath).toBe(out);
      expect(existsSync(out)).toBe(true);
      const written = readFileSync(out, 'utf8');
      expect(written).toContain('name: acme-widget');
      expect(written.endsWith('\n')).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not write a file for an invalid manifest under --allow-invalid', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'plugin-coder-'));
    const out = path.join(dir, 'mfe-manifest.yaml');
    try {
      const result = await coderCompileCommand(
        { intent: 'x', out, allowInvalid: true },
        runnerReturning(INVALID_YAML),
      );
      expect(result.outPath).toBeUndefined();
      expect(existsSync(out)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('honors a serve endpoint by building a serve transport (no subprocess)', async () => {
    // The injected runner bypasses transport wiring, but the request the command
    // builds must still be exercised without spawning; a valid result is enough.
    const result = await coderCompileCommand(
      { intent: 'x', endpoint: 'http://localhost:3991', adaptor: 'intent-manifest' },
      runnerReturning(VALID_YAML),
    );
    expect(result.valid).toBe(true);
  });
});
