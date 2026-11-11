/**
 * The id a generated BFF reads out of the bearer token is named for what it
 * is (ADR-123).
 *
 * mesh-context.js base64-decodes the token's payload. It does not check the
 * signature — it cannot, the BFF holds no key — so anyone can send a token
 * that says they are anyone. The field was called `userId`, which reads as an
 * identity a resolver may authorize on. It is `unverifiedUserId`.
 */

import * as path from 'path';
import * as fs from 'fs-extra';
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
  capabilities: [{ PayStatus: { type: 'domain' } }, { Load: { type: 'platform' } }],
  data: {
    sources: [{ name: 'Ledger', handler: { openapi: { source: './ledger.yaml' } } }],
    serve: { endpoint: '/graphql', playground: true },
  },
} as DSLManifest;

const dir = path.join(__dirname, 'output-unverified-user-id');
afterAll(() => fs.remove(dir));

describe('the generated BFF context', () => {
  let file: (suffix: string) => string;
  beforeAll(async () => {
    const { files } = await generateAllFiles(manifest, dir);
    file = (suffix) => files.find((f) => f.path.endsWith(suffix))?.content ?? '';
  });

  it('exposes the token-derived id as unverifiedUserId', () => {
    expect(file('mesh-context.js')).toContain('unverifiedUserId: readUnverifiedUserId(authHeader)');
  });

  it('no longer exposes anything called userId', () => {
    expect(file('mesh-context.js')).not.toMatch(/^\s*userId:/m);
    expect(file('server.ts')).not.toMatch(/^\s*userId\??:/m);
  });

  it('types the field, and says in the type that it must not be authorized on', () => {
    const server = file('server.ts');
    expect(server).toMatch(/unverifiedUserId\?: string;/);
    expect(server).toMatch(/not verified/i);
  });

  it('says so where the Mesh config loads the plugin', () => {
    expect(file('.meshrc.yaml')).toContain('unverifiedUserId');
  });
});
