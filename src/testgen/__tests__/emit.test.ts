/**
 * Every generated file is TypeScript an MFE compiles: parsed here, with the
 * escapes a template literal can silently eat (`\d` inside one is `d`) checked.
 */
import * as ts from 'typescript';
import { aloneTestSource, angularAloneTestSource, connectorTestSource, contractTestSource, journeySpecSource, playwrightConfigSource, SCHEMA_CHECK } from '../emit';
import { RECORDED_NETWORK } from '../harness';
import { consoleKey } from '../pack';

const files: Record<string, string> = {
  'alone.test.tsx': aloneTestSource('CargoManifest', 'http://localhost:5090'),
  'alone.angular.test.ts': angularAloneTestSource('CargoManifest', 'http://localhost:5180'),
  'journeys.spec.ts': journeySpecSource('meridian-ops-cargo', 'http://localhost:5090'),
  'playwright.config.ts': playwrightConfigSource({ width: 1440, height: 900 }),
  'contract.test.ts': contractTestSource('meridian-ops-cargo'),
  'connector.contract.ts': connectorTestSource('meridian-ops-cargo'),
  'spec.contract.ts': connectorTestSource('meridian-ops-cargo', { data: './spec.json', from: 'its specs', mark: 'MARK', failures: true }),
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
    expect(files['playwright.config.ts']).toContain('testMatch: /characterization\\.e2e\\.ts$/');
    expect(files['alone.test.tsx']).toContain('/not wrapped in act\\(/');
  });

  it('reads its data with fs, so no MFE needs resolveJsonModule', () => {
    for (const name of ['alone.test.tsx', 'alone.angular.test.ts', 'contract.test.ts', 'connector.contract.ts', 'spec.contract.ts']) expect(files[name]).not.toMatch(/^import \w+ from '[^']+\.json';/m);
  });

  it('renders each case with the props it was recorded with, in both lanes', () => {
    expect(files['alone.test.tsx']).toContain('render(<CargoManifest {...(c.props ?? {})} />)');
    expect(files['alone.angular.test.ts']).toContain('fixture.componentRef.setInput(name, value)');
  });

  it('renders an Angular capability with TestBed, and asserts what the React lane asserts', () => {
    const a = files['alone.angular.test.ts'];
    expect(a).toContain("import CargoManifest from './CargoManifest.component';");
    expect(a).toContain('TestBed.configureTestingModule({ imports: [CargoManifest] })');
    // Waits on a clock the frozen Date cannot stop.
    expect(a).toContain('performance.now()');
    expect(a).not.toContain('Date.now()');
    for (const shared of ['expect(missing).toEqual([]);', 'expect(net.unexpected).toEqual([]);', 'c.calls.filter((call) => !net.calls.includes(call))', 'c.consoleErrors.some((known) => e.includes(known))']) {
      expect(a).toContain(shared);
      expect(files['alone.test.tsx']).toContain(shared);
    }
  });

  it('names the capability and where its data lives', () => {
    expect(files['alone.test.tsx']).toContain("import { CargoManifest } from './CargoManifest';");
    expect(files['alone.test.tsx']).toContain("json<{ app: string;");
    expect(files['alone.test.tsx']).toContain("'./__characterization__/CargoManifest.json'");
    expect(files['journeys.spec.ts']).toContain("process.env.SMT_TARGET_URL ?? evidence.app");
  });

  it('answers a GraphQL document with the response recorded for it, hashed as capture hashes it', () => {
    expect(files['journeys.spec.ts']).toContain('function bodyHash(text: string): string {');
    expect(files['journeys.spec.ts']).toContain("responses[`${key} #${bodyHash(body)}`]");
  });

  it('the spec variant reads its own data and also fails each upstream once', () => {
    expect(files['spec.contract.ts']).toContain("join(__dirname, './spec.json')");
    expect(files['spec.contract.ts']).toContain('reports an upstream failure as an error, not as data');
    expect(files['connector.contract.ts']).not.toContain('reports an upstream failure');
  });

  it('compares console errors with source locations masked: a rebuild renames the bundle', () => {
    const js = ts.transpileModule(/(function consoleKey[\s\S]*?\n}\n)/.exec(files['journeys.spec.ts'])?.[1] ?? 'missing', { compilerOptions: { target: ts.ScriptTarget.ES2022 } });
    const consoleKey = new Function(`${js.outputText}; return consoleKey;`)() as (t: string) => string;
    expect(consoleKey('Warning: x\n    at Tabs (http://localhost:5008/main.c8107cfac3fe0a0e.js:42548:75)')).toBe(
      consoleKey('Warning: x\n    at Tabs (http://localhost:5008/main.9dbe186b68f666d5.js:42577:75)')
    );
    expect(consoleKey('Warning: x')).not.toBe(consoleKey('Warning: y'));
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

describe('the journey spec\'s console rule', () => {
  it('is the composed run\'s: one error is one error in either tier', () => {
    const src = files['journeys.spec.ts'].match(/function consoleKey\(text: string\): string \{\n([\s\S]*?)\n\}/)?.[1] ?? '';
    const emitted = new Function('text', src) as (t: string) => string;
    for (const t of ['TypeError: x\n  at f (http://localhost:5000/main.cf64.js:49245:14)', 'Warning: a  b']) expect(emitted(t)).toBe(consoleKey(t));
  });
});
