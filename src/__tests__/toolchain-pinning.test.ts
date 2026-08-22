/**
 * ADR-045 — Package Manager and Local Runtime Pinning.
 *
 * ADR-045 carries `enforcement: code`, but for three months nothing checked
 * it: the repo declared npm, shipped a pnpm workspace file it never used, and
 * pinned no local Node version. The decision was correct and simply unenforced
 * — the same shape as ADR-077 §2, where `--no-interactive` was absent for
 * three months because no test iterated the command registry.
 *
 * These assertions are what make the ADR's `enforcement: code` true.
 */

import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const readJson = (p: string): Record<string, unknown> =>
  JSON.parse(fs.readFileSync(path.join(REPO_ROOT, p), 'utf8'));

describe('ADR-045 toolchain pinning', () => {
  it('declares npm as the authoritative package manager', () => {
    const pkg = readJson('package.json');
    expect(String(pkg.packageManager)).toMatch(/^npm@/);
  });

  it('carries no pnpm workspace metadata', () => {
    // ADR-045 Decision Outcome: "Any leftover pnpm-specific workspace metadata
    // must either be removed or explicitly documented as non-authoritative."
    expect(fs.existsSync(path.join(REPO_ROOT, 'pnpm-workspace.yaml'))).toBe(false);
    expect(fs.existsSync(path.join(REPO_ROOT, 'pnpm-lock.yaml'))).toBe(false);
  });

  it('defines the workspace through npm', () => {
    const pkg = readJson('package.json');
    expect(Array.isArray(pkg.workspaces)).toBe(true);
  });

  it('pins a local Node line in a checked-in runtime version file', () => {
    const nvmrc = path.join(REPO_ROOT, '.nvmrc');
    expect(fs.existsSync(nvmrc)).toBe(true);
    expect(fs.readFileSync(nvmrc, 'utf8').trim()).toMatch(/^\d+/);
  });

  it('declares an engines range, and the pinned line satisfies it', () => {
    const pkg = readJson('package.json');
    const engines = pkg.engines as Record<string, string> | undefined;
    expect(engines?.node).toBeDefined();

    const pinned = Number(
      fs.readFileSync(path.join(REPO_ROOT, '.nvmrc'), 'utf8').trim().split('.')[0],
    );
    const floor = Number(/(\d+)/.exec(engines!.node)![1]);
    // A pin below the declared floor would tell contributors to install a
    // runtime the package itself refuses.
    expect(pinned).toBeGreaterThanOrEqual(floor);
  });

  it('pins a Node line that CI actually validates', () => {
    // Claiming support for an untested runtime is the class of unverified
    // assertion this repo keeps getting caught by.
    const ci = fs.readFileSync(path.join(REPO_ROOT, '.github/workflows/test.yml'), 'utf8');
    const matrix = /node-version:\s*\[([^\]]+)\]/.exec(ci);
    expect(matrix).not.toBeNull();
    const tested = matrix![1].split(',').map((v) => v.trim().replace(/['"]/g, '').split('.')[0]);
    const pinned = fs.readFileSync(path.join(REPO_ROOT, '.nvmrc'), 'utf8').trim().split('.')[0];
    expect(tested).toContain(pinned);
  });
});
