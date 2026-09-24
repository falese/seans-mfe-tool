/**
 * The Rust capability results serialize to the runtime's result contract
 * (ADR-101).
 *
 * Not circular: one side is `packages/runtime/src/capability-results.ts`, read
 * off disk with the TypeScript compiler; the other is the generated
 * `types.rs`. Nothing renders one from the other, so a field added to either
 * and not the other fails here. This is the check that would have caught the
 * Rust lane shipping the Swift lane's shapes (`healthy`/`state`,
 * `accepted`/`stateKey`) instead of the contract's.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { generateAllFiles } from '@seans-mfe/codegen';
import type { DSLManifest } from '@seans-mfe/dsl';
import { registerRustCodegen } from '../codegen';

registerRustCodegen();

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

/** Property names of each interface in capability-results.ts, minus index signatures. */
function tsFields(): Record<string, string[]> {
  const file = path.resolve(__dirname, '../../../runtime/src/capability-results.ts');
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const out: Record<string, string[]> = {};
  source.forEachChild((node) => {
    if (ts.isInterfaceDeclaration(node) && RESULTS.includes(node.name.text)) {
      out[node.name.text] = node.members
        .filter(ts.isPropertySignature)
        .map((m) => (m.name as ts.Identifier).text);
    }
  });
  return out;
}

const camel = (s: string): string => s.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase());

/** Serialized field names of each generated Rust struct (rename_all = camelCase). */
async function rustFields(): Promise<Record<string, string[]>> {
  const basePath = path.join(__dirname, 'output-contract');
  const { files } = await generateAllFiles(
    {
      name: 'crew-services',
      version: '1.0.0',
      type: 'remote',
      capabilities: [{ CrewRoster: { type: 'domain', description: 'Crew roster' } }],
      targets: { rust: {} },
    } as unknown as DSLManifest,
    basePath,
  );
  const types = files.find((f) => f.path.endsWith(path.join('rust', 'src', 'platform', 'types.rs')))!.content;
  const out: Record<string, string[]> = {};
  for (const name of RESULTS) {
    const match = new RegExp(`#\\[serde\\(rename_all = "camelCase"\\)\\]\\npub struct ${name} \\{([^}]*)\\}`).exec(types);
    // A field's wire name is its `#[serde(rename = "…")]` if it has one
    // (`kind` → `type`), else the camelCase of its Rust name.
    out[name] = match
      ? [...match[1].matchAll(/(?:#\[serde\(rename = "(\w+)"\)\]\s*)?pub (\w+):/g)].map((m) => m[1] ?? camel(m[2]))
      : [];
  }
  return out;
}

describe('Rust capability results match capability-results.ts (ADR-101)', () => {
  let tsSide: Record<string, string[]>;
  let rustSide: Record<string, string[]>;

  beforeAll(async () => {
    tsSide = tsFields();
    rustSide = await rustFields();
  });

  it('finds every result interface on the TypeScript side', () => {
    expect(Object.keys(tsSide).sort()).toEqual([...RESULTS].sort());
  });

  // Fields that exist only because a DOM or a Module Federation container
  // exists (ADR-096 §4): a natively-linked crate has neither to return.
  // `LoadResult.error` is the atomic Module Federation load's (ADR-026) — its
  // phases are entry / mount / enable-render; a native load failure is an Err.
  const WEB_ONLY: Record<string, string[]> = {
    LoadResult: ['container', 'mesh', 'worker', 'manifest', 'telemetry', 'error'],
    RenderResult: ['element'],
  };

  it.each(RESULTS)('%s carries every contract field the native lane can have', (name) => {
    const expected = tsSide[name].filter((f) => !(WEB_ONLY[name] ?? []).includes(f));
    expect(rustSide[name]).toEqual(expect.arrayContaining(expected));
  });

  it.each(RESULTS)('%s serializes camelCase — the wire shape, not Rust field names', (name) => {
    expect(rustSide[name].length).toBeGreaterThan(0);
  });
});
