/**
 * Every build target implements every platform capability (ADR-101, ADR-102).
 *
 * The platform contract is ten capabilities over one lifecycle, and PDR-002
 * says it is language-neutral. This suite holds every lane to that — web
 * (React, Angular), Swift and Rust — so a new target, or a regression in an
 * old one, fails here rather than in a host that called the capability:
 *
 *   1. the web classes are concrete: all nine abstract `do*` hooks of
 *      `BaseMFE` are implemented in `BaseRemoteMFE`, and neither
 *      `RemoteMFE` nor `AngularRemoteMFE` is abstract;
 *   2. no native lane answers a capability with "not implemented";
 *   3. each native lane's results carry the field names in
 *      `packages/runtime/src/capability-results.ts` — read with the
 *      TypeScript compiler, never rendered from the same source, so the
 *      comparison is not circular.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { generateAllFiles } from '@seans-mfe/codegen';
import { PLATFORM_CAPABILITIES } from '@seans-mfe/contracts';
import type { DSLManifest } from '@seans-mfe/dsl';
import { registerSwiftCodegen } from '@seans-mfe/framework-swift';
import { registerRustCodegen } from '@seans-mfe/framework-rust';

registerSwiftCodegen();
registerRustCodegen();

const RUNTIME = path.resolve(__dirname, '../../packages/runtime/src');
const pascal = (c: string): string => c.charAt(0).toUpperCase() + c.slice(1);

const RESULTS = [
  'LoadResult',
  'RenderResult',
  'HealthResult',
  'DescribeResult',
  'SchemaResult',
  'QueryResult',
  'EmitResult',
  'ControlPlaneStateResult',
];

// Fields that exist only because a DOM or a Module Federation container exists
// (ADR-096 §4). `LoadResult.error` belongs to the atomic MF load (ADR-026):
// its phases are entry / mount / enable-render; a native load failure throws.
const WEB_ONLY: Record<string, string[]> = {
  LoadResult: ['container', 'mesh', 'worker', 'manifest', 'telemetry', 'error'],
  RenderResult: ['element'],
};

function parse(file: string): ts.SourceFile {
  return ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
}

function contractFields(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  parse(path.join(RUNTIME, 'capability-results.ts')).forEachChild((node) => {
    if (ts.isInterfaceDeclaration(node) && RESULTS.includes(node.name.text)) {
      out[node.name.text] = node.members
        .filter(ts.isPropertySignature)
        .map((m) => (m.name as ts.Identifier).text)
        .filter((f) => !(WEB_ONLY[node.name.text] ?? []).includes(f));
    }
  });
  return out;
}

/** Methods a class declares, and whether it is abstract. */
function classShape(file: string, name: string): { abstract: boolean; methods: string[] } {
  let shape = { abstract: false, methods: [] as string[] };
  parse(file).forEachChild((node) => {
    if (ts.isClassDeclaration(node) && node.name?.text === name) {
      shape = {
        abstract: !!node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AbstractKeyword),
        methods: node.members
          .filter(ts.isMethodDeclaration)
          .filter((m) => !m.modifiers?.some((x) => x.kind === ts.SyntaxKind.AbstractKeyword))
          .map((m) => (m.name as ts.Identifier).text),
      };
    }
  });
  return shape;
}

let emitted: Record<string, string> = {};

beforeAll(async () => {
  const basePath = path.join(__dirname, 'output-conformance');
  const manifest = {
    name: 'crew-services',
    version: '1.0.0',
    type: 'remote',
    endpoint: 'http://localhost:5005',
    capabilities: [{ CrewRoster: { type: 'domain', description: 'Crew roster' } }],
    targets: { swift: {}, rust: {} },
  } as unknown as DSLManifest;
  const { files } = await generateAllFiles(manifest, basePath);
  emitted = Object.fromEntries(
    files.map((f) => [path.relative(basePath, f.path).split(path.sep).join('/'), f.content]),
  );
});

describe('1. the web lanes implement every hook', () => {
  const abstractHooks = PLATFORM_CAPABILITIES.filter((c) => c !== 'query').map((c) => `do${pascal(c)}`);

  it('BaseRemoteMFE implements every abstract do* hook of BaseMFE', () => {
    const base = classShape(path.join(RUNTIME, 'base-remote-mfe.ts'), 'BaseRemoteMFE');
    expect(base.methods).toEqual(expect.arrayContaining(abstractHooks));
  });

  it.each([
    ['remote-mfe.ts', 'RemoteMFE'],
    ['angular-remote-mfe.ts', 'AngularRemoteMFE'],
  ])('%s: %s is concrete', (file, name) => {
    expect(classShape(path.join(RUNTIME, file), name).abstract).toBe(false);
  });
});

describe('2. no native lane answers "not implemented"', () => {
  it('Swift', () => {
    const native = emitted['swift/Sources/MFE/Platform/NativeMFEBase.swift'];
    expect(native).toBeDefined();
    expect(native).not.toContain('throw MFENotImplementedError');
  });

  it('Rust', () => {
    const native = emitted['rust/src/platform/native_mfe_base.rs'];
    expect(native).toBeDefined();
    expect(native).not.toContain('MfeError::NotImplemented');
  });
});

/** Serialized field names of each Swift result struct (Codable: property names are the keys). */
function swiftFields(): Record<string, string[]> {
  const types = emitted['swift/Sources/MFE/Platform/Types.swift'];
  const out: Record<string, string[]> = {};
  for (const name of RESULTS) {
    const match = new RegExp(`public struct ${name}\\b[^{]*\\{([\\s\\S]*?)\\n\\}`).exec(types);
    out[name] = match ? [...match[1].matchAll(/public (?:let|var) (\w+):/g)].map((m) => m[1]) : [];
  }
  return out;
}

/** Serialized field names of each Rust result struct (camelCase, honouring `rename`). */
function rustFields(): Record<string, string[]> {
  const types = emitted['rust/src/platform/types.rs'];
  const camel = (s: string): string => s.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase());
  const out: Record<string, string[]> = {};
  for (const name of RESULTS) {
    const match = new RegExp(`pub struct ${name} \\{([^}]*)\\}`).exec(types);
    out[name] = match
      ? [...match[1].matchAll(/(?:#\[serde\(rename = "(\w+)"\)\]\s*)?pub (\w+):/g)].map((m) => m[1] ?? camel(m[2]))
      : [];
  }
  return out;
}

describe('3. native results carry the contract fields', () => {
  let contract: Record<string, string[]>;
  beforeAll(() => {
    contract = contractFields();
  });

  it('reads every result interface from the runtime', () => {
    expect(Object.keys(contract).sort()).toEqual([...RESULTS].sort());
  });

  it.each(RESULTS)('Swift %s', (name) => {
    expect(swiftFields()[name]).toEqual(expect.arrayContaining(contract[name]));
  });

  it.each(RESULTS)('Rust %s', (name) => {
    expect(rustFields()[name]).toEqual(expect.arrayContaining(contract[name]));
  });
});
