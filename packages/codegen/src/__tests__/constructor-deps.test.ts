/**
 * The generated MFE constructor forwards an optional `deps` to the base class
 * (#349). BaseMFE already accepts `deps` (telemetry, handlers, ws client…), but
 * the generated constructor took only `manifest`, so a second argument was
 * silently dropped and the DI seam was unreachable from generated code.
 */

import { generateAllFiles } from '../unified-generator';
import path from 'path';

const basePath = path.join(__dirname, 'output-constructor-deps');

const manifest = (extra: Record<string, unknown> = {}, withSource = false) => ({
  name: 'DepsMFE',
  version: '1.0.0',
  type: 'remote',
  language: 'typescript',
  description: 'MFE for the constructor deps test',
  endpoint: 'http://localhost:3001',
  capabilities: withSource
    ? [{ Load: { type: 'platform', description: 'Load', lifecycle: { before: [{ v: { handler: 'v', source: './handlers/v', description: 'v' } }] } } }]
    : [{ Load: { type: 'platform', description: 'Load' } }],
  ...extra,
});

const angular = {
  framework: 'angular' as const,
  bundler: 'webpack' as const,
  dependencies: { runtime: { '@angular/core': '^17.0.0', '@angular/platform-browser': '^17.0.0', 'zone.js': '~0.14.0' } },
};

async function mfeSource(m: unknown): Promise<string> {
  const { files } = await generateAllFiles(m as Parameters<typeof generateAllFiles>[0], basePath);
  const mfe = files.find((f) => f.path === path.join(basePath, 'src', 'platform', 'base-mfe', 'mfe.ts'));
  if (!mfe) throw new Error('mfe.ts was not generated');
  return mfe.content;
}

describe.each([
  ['React', {}, 'RemoteMFE'],
  ['Angular', angular, 'AngularRemoteMFE'],
])('generated %s constructor forwards deps (#349)', (_label, lane, base) => {
  it('takes an optional deps typed from the base class and forwards it', async () => {
    const src = await mfeSource(manifest(lane));
    expect(src).toContain(`constructor(manifest: any, deps?: ConstructorParameters<typeof ${base}>[1])`);
    expect(src).toMatch(/super\(manifest,\s*deps\);/);
  });

  it('keeps the caller’s deps when the manifest declares handler sources', async () => {
    const src = await mfeSource(manifest(lane, true));
    expect(src).toContain(`constructor(manifest: any, deps?: ConstructorParameters<typeof ${base}>[1])`);
    expect(src).toMatch(/super\(manifest,\s*\{\s*\.\.\.deps,\s*customHandlers:\s*handlerRegistry\s*\}\)/);
  });
});
