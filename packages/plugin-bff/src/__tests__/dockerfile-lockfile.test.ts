/**
 * The generated Dockerfile installs from the committed lockfile (#346).
 *
 * It used to copy `package.json` alone and run `npm install`, so the
 * lockfile reached the image several layers after the install that should
 * have used it: two builds of one commit could resolve different trees.
 *
 * `@seans-mfe-tool/runtime` is staged from the CLI image rather than
 * installed, so it has to come out before the install. `npm pkg delete`
 * edited `package.json` only, and `npm ci` rejects a lockfile that disagrees
 * with it. `npm uninstall --package-lock-only` edits both. With no lockfile it
 * resolves one from the registry, which is what `npm install` did, so one
 * path serves MFEs with and without a lockfile.
 */

import { generateAllFiles } from '@seans-mfe/codegen';
import type { DSLManifest } from '@seans-mfe/dsl';
import '../codegen';

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

async function builderStage(): Promise<string> {
  const { files } = await generateAllFiles(manifest, '/out');
  const dockerfile = files.find((f) => f.path === '/out/Dockerfile')?.content ?? '';
  // Instructions only: the comments explaining this block name `npm ci` too.
  return dockerfile
    .split(/^FROM node:20-slim AS production/m)[0]
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n');
}

describe('generated Dockerfile installs from the lockfile (#346)', () => {
  it('copies the lockfile with the manifest, before installing', async () => {
    const builder = await builderStage();
    const copy = builder.indexOf('COPY package*.json ./');
    expect(copy).toBeGreaterThan(-1);
    expect(copy).toBeLessThan(builder.indexOf('npm ci'));
    expect(builder).not.toMatch(/^COPY package\.json \.\/\s*$/m);
  });

  it('installs with npm ci, not npm install', async () => {
    const builder = await builderStage();
    expect(builder).toMatch(/npm ci\b/);
    expect(builder).not.toMatch(/^\s*npm install\b/m);
  });

  it('removes the staged runtime from package.json AND the lockfile before npm ci', async () => {
    const builder = await builderStage();
    const uninstall = builder.indexOf('npm uninstall @seans-mfe-tool/runtime --package-lock-only');
    expect(uninstall).toBeGreaterThan(-1);
    expect(uninstall).toBeLessThan(builder.indexOf('npm ci'));
    // The package.json-only edit is what made npm ci impossible.
    expect(builder.slice(0, builder.indexOf('npm ci'))).not.toContain('npm pkg delete');
  });
});
