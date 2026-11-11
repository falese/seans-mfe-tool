/**
 * A generated BFF refuses a request from an origin it was not told to serve.
 *
 * CORS alone does not do that. It tells a browser whether a page may READ a
 * response; a form-style POST is sent either way, and GraphQL servers accept
 * form bodies. So when CORS_ORIGIN names the origins a BFF serves, a request
 * carrying any other Origin is refused before it reaches the GraphQL handler.
 *
 * With CORS_ORIGIN unset or "*" nothing changes: a BFF that serves every
 * origin, as both reference fleets configure theirs, keeps doing so.
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

const dir = path.join(__dirname, 'output-cross-site');
afterAll(() => fs.remove(dir));

describe('the generated BFF server', () => {
  let server: string;
  beforeAll(async () => {
    const { files } = await generateAllFiles(manifest, dir);
    server = files.find((f) => f.path === path.join(dir, 'server.ts'))?.content ?? '';
  });

  it('reads the origins it serves from CORS_ORIGIN, as a comma-separated list', () => {
    expect(server).toContain("(process.env.CORS_ORIGIN ?? '*')");
    expect(server).toContain(".split(',')");
  });

  it('refuses another origin with 403, before the GraphQL handler', () => {
    const refusal = server.indexOf('res.status(403)');
    expect(refusal).toBeGreaterThan(-1);
    expect(refusal).toBeLessThan(server.indexOf("app.use('/graphql', meshHandler)"));
  });

  it('refuses nothing when every origin is served', () => {
    expect(server).toContain('const servesEveryOrigin = allowedOrigins.includes(\'*\')');
    expect(server).toMatch(/if \(!servesEveryOrigin\) \{\s+app\.use\(/);
  });

  it('gives cors the same list, so what a page may read and what is refused cannot disagree', () => {
    expect(server).toContain("origin: servesEveryOrigin ? '*' : allowedOrigins");
    expect(server).not.toContain("origin: process.env.CORS_ORIGIN || '*'");
  });
});
