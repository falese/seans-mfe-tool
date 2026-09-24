/**
 * An MFE's own server serves its Rust browser build (ADR-100, ADR-103 §2).
 *
 * The composition compiler registers that build at
 * `<endpoint>/wasm/remoteEntry.js`; these pin the three generated files that
 * make the URL real — `server.ts` serves it, the Dockerfile builds it, and
 * `.dockerignore` keeps the host's Cargo output out of the build context —
 * and pin that an MFE without the build gets none of it.
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import { generateAllFiles } from '@seans-mfe/codegen';
import type { DSLManifest } from '@seans-mfe/dsl';
import '../codegen';

const base: DSLManifest = {
  name: 'crew-services',
  version: '1.0.0',
  type: 'remote',
  language: 'typescript',
  framework: 'react',
  bundler: 'rspack',
  endpoint: 'http://localhost:5005',
  remoteEntry: 'http://localhost:5005/remoteEntry.js',
  capabilities: [{ PayStatus: { type: 'domain' } }, { Load: { type: 'platform' } }],
  data: {
    sources: [{ name: 'Ledger', handler: { openapi: { source: './ledger.yaml' } } }],
    serve: { endpoint: '/graphql', playground: true },
  },
} as DSLManifest;

const withWasm = { ...base, targets: { rust: { wasm: true } } } as DSLManifest;

const dir = path.join(__dirname, 'output-browser-build');
afterAll(() => fs.remove(dir));

async function generated(manifest: DSLManifest): Promise<(rel: string) => string> {
  const { files } = await generateAllFiles(manifest, dir, { force: true });
  return (rel) => {
    const file = files.find((f) => f.path === path.join(dir, rel));
    if (!file) throw new Error(`${rel} was not generated`);
    return file.content;
  };
}

describe('an MFE with targets.rust.wasm', () => {
  it('serves rust/web/www under /wasm, before the SPA fallback can answer for it', async () => {
    const server = (await generated(withWasm))('server.ts');
    const mount = server.indexOf("app.use('/wasm', express.static(path.join(__dirname, 'rust', 'web', 'www')))");
    expect(mount).toBeGreaterThan(-1);
    expect(mount).toBeLessThan(server.indexOf("app.get('*'"));
  });

  it('builds the browser build in a Rust stage and ships www/ in the image', async () => {
    const dockerfile = (await generated(withWasm))('Dockerfile');
    expect(dockerfile).toContain('AS wasm-builder');
    expect(dockerfile).toContain('rustup target add wasm32-unknown-unknown');
    // The CLI version is read from the crate's lockfile, not restated here:
    // build.sh refuses a mismatched CLI, and the pin lives in rust/web/Cargo.toml.
    expect(dockerfile).toContain('cargo install wasm-bindgen-cli --version "$(');
    expect(dockerfile).toContain('bash rust/web/build.sh');
    expect(dockerfile).toContain('COPY --from=wasm-builder /mfe/rust/web/www ./rust/web/www');
  });

  it('keeps Cargo output out of the Docker build context', async () => {
    const ignore = (await generated(withWasm))('.dockerignore');
    expect(ignore).toContain('rust/target');
    expect(ignore).toContain('rust/web/target');
    expect(ignore).toContain('rust/web/www/pkg');
  });
});

describe('an MFE without it', () => {
  it('generates none of it', async () => {
    const get = await generated(base);
    expect(get('server.ts')).not.toContain('/wasm');
    expect(get('Dockerfile')).not.toContain('wasm-builder');
    expect(get('.dockerignore')).not.toContain('rust/');
  });
});
