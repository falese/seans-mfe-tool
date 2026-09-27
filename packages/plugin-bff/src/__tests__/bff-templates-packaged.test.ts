/**
 * BFF generation works from what this package ships, not from where it sits
 * in a checkout (#332).
 *
 * `packages/codegen` used to reach `../../../packages/bff-plugin/templates` by
 * relative path, so a published `@seans-mfe/codegen` resolved that to nothing
 * and BFF generation only worked from a monorepo checkout. The BFF plugin now
 * contributes its own template root (ADR-094); these pin that the root is
 * inside this package, inside what its `files` publishes, and that nothing in
 * codegen has gone back to finding it by path.
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import { generateAllFiles } from '@seans-mfe/codegen';
import type { DSLManifest } from '@seans-mfe/dsl';
import { BFF_SPECS, bffTemplateRoot } from '../codegen';

const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');
const CODEGEN_SRC = path.resolve(PACKAGE_ROOT, '..', 'codegen', 'src');

const manifest = {
  name: 'crew-services',
  version: '1.0.0',
  type: 'remote',
  language: 'typescript',
  framework: 'react',
  bundler: 'rspack',
  endpoint: 'http://localhost:5005',
  remoteEntry: 'http://localhost:5005/remoteEntry.js',
  capabilities: [{ PayStatus: { type: 'domain' } }],
  data: {
    sources: [{ name: 'Ledger', handler: { openapi: { source: './ledger.yaml' } } }],
    serve: { endpoint: '/graphql', playground: true },
  },
} as DSLManifest;

describe('BFF templates are resolved from the published package (#332)', () => {
  it('the template root sits inside a directory this package publishes', () => {
    const pkg = fs.readJsonSync(path.join(PACKAGE_ROOT, 'package.json')) as { files: string[] };
    const rel = path.relative(PACKAGE_ROOT, bffTemplateRoot);
    expect(rel.startsWith('..')).toBe(false);
    expect(pkg.files).toContain(rel.split(path.sep)[0]);
  });

  it('every required BFF template exists under that root', () => {
    const missing = BFF_SPECS.filter((s) => !s.optional)
      .map((s) => s.template)
      .filter((t) => !fs.existsSync(path.join(bffTemplateRoot, t)));
    expect(missing).toEqual([]);
  });

  it('generateAllFiles renders the BFF from that root', async () => {
    const { files } = await generateAllFiles(manifest, '/out');
    const bff = files.find((f) => f.path === path.join('/out', 'src/platform/bff/bff.ts'));
    // Rendered, not copied: the manifest's name reached the template.
    expect(bff?.content).toContain('crew-services BFF client connector');
    expect(bff?.content).toContain('export async function query');
  });

  it('codegen source never reaches into a sibling package by path', () => {
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== '__tests__') walk(full);
        } else if (entry.name.endsWith('.ts')) {
          fs.readFileSync(full, 'utf8')
            .split('\n')
            .forEach((line, i) => {
              const code = line.replace(/\/\/.*$|^\s*\*.*$/, '');
              if (/['"`][^'"`]*\.\.\/\.\.\/\.\.\/|['"`][^'"`]*packages\/(plugin-bff|bff-plugin)/.test(code)) {
                offenders.push(`${path.relative(CODEGEN_SRC, full)}:${i + 1}`);
              }
            });
        }
      }
    };
    walk(CODEGEN_SRC);
    expect(offenders).toEqual([]);
  });
});
