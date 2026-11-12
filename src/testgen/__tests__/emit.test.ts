/**
 * Every generated file is TypeScript an MFE compiles: parsed here, with the
 * escapes a template literal can silently eat (`\d` inside one is `d`) checked.
 */
import * as ts from 'typescript';
import { aloneTestSource, connectorTestSource, contractTestSource, journeySpecSource, playwrightConfigSource, SCHEMA_CHECK } from '../emit';
import { RECORDED_NETWORK } from '../harness';

const files: Record<string, string> = {
  'alone.test.tsx': aloneTestSource('CargoManifest', 'http://localhost:5090'),
  'journeys.spec.ts': journeySpecSource('meridian-ops-cargo', 'http://localhost:5090'),
  'playwright.config.ts': playwrightConfigSource({ width: 1440, height: 900 }),
  'contract.test.ts': contractTestSource('meridian-ops-cargo'),
  'connector.contract.ts': connectorTestSource('meridian-ops-cargo'),
  'schema-check.ts': SCHEMA_CHECK,
  'recorded-network.ts': RECORDED_NETWORK,
};

describe('generated sources', () => {
  it.each(Object.keys(files))('%s parses', (name) => {
    const source = ts.createSourceFile(name, files[name], ts.ScriptTarget.ES2022, true, name.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const diagnostics = (source as unknown as { parseDiagnostics: ts.Diagnostic[] }).parseDiagnostics;
    expect(diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual([]);
  });

  it('keeps the regex escapes the template literals carry', () => {
    expect(files['connector.contract.ts']).toContain('const ISO = /^\\d{4}-\\d{2}-\\d{2}T');
    expect(files['journeys.spec.ts']).toContain("pageText.replace(/\\s+/g, '')");
    expect(files['journeys.spec.ts']).toContain('/\\/graphql\\/?(\\?|$)/');
    expect(files['playwright.config.ts']).toContain('testMatch: /characterization\\.spec\\.ts$/');
    expect(files['alone.test.tsx']).toContain('/not wrapped in act\\(/');
  });

  it('names the capability and where its data lives', () => {
    expect(files['alone.test.tsx']).toContain("import { CargoManifest } from './CargoManifest';");
    expect(files['alone.test.tsx']).toContain("import evidence from './__characterization__/CargoManifest.json';");
    expect(files['journeys.spec.ts']).toContain("process.env.SMT_TARGET_URL ?? evidence.app");
  });

  it('answers a GraphQL document with the response recorded for it, hashed as capture hashes it', () => {
    expect(files['journeys.spec.ts']).toContain('function bodyHash(text: string): string {');
    expect(files['journeys.spec.ts']).toContain("responses[`${key} #${bodyHash(body)}`]");
  });

  it('runs the connector live, past the demo-mode switch (ADR-052)', () => {
    expect(files['connector.contract.ts']).toContain("'x-bff-mode': 'live'");
    expect(files['connector.contract.ts']).toContain('options.fetchFn =');
    // The spec's server is wherever it is: the request is matched by the spec path it ends with.
    expect(files['connector.contract.ts']).toContain('u.pathname.endsWith(r.pathname)');
    // Mesh adds the spec's default parameters, so a recording matches on the ones it was made with.
    expect(files['connector.contract.ts']).toContain('[...r.searchParams].every(([k, v]) => u.searchParams.get(k) === v)');
  });
});
