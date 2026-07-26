/**
 * Output schemas are derived from each command's declared result type.
 *
 * TypeScript already guarantees the first link of the chain — a command is
 * `BaseCommand<T>` and `runCommand(): Promise<T>`, so the compiler enforces
 * that it returns T. The only unverified link was T -> published schema,
 * because the schema was hand-typed. `RemoteGenerateResult.preserved` drifted
 * exactly there, and since the schema is additionalProperties:false, a
 * validating agent rejected every remote:generate response.
 *
 * Generating that link closes the chain with no runtime validation anywhere.
 *
 * Refs #139 · ADR-065 (same shape: typed source of truth -> JSON Schema, drift-gated) · ADR-077
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { typeToJsonSchema } from '../type-to-schema';

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'type-schema-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

/** Compile `source`, resolve the interface named `name`, and convert it. */
function schemaFor(source: string, name = 'Target'): Record<string, unknown> {
  const file = path.join(dir, 'input.ts');
  fs.writeFileSync(file, source);

  const program = ts.createProgram([file], {
    target: ts.ScriptTarget.ES2020,
    strict: true,
    skipLibCheck: true,
  });
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(file)!;

  let type: ts.Type | undefined;
  sourceFile.forEachChild((node) => {
    if (ts.isInterfaceDeclaration(node) && node.name.text === name) {
      type = checker.getTypeAtLocation(node.name);
    }
  });
  if (!type) throw new Error(`interface ${name} not found`);

  return typeToJsonSchema(type, checker) as Record<string, unknown>;
}

describe('typeToJsonSchema', () => {
  it('maps primitives', () => {
    const s = schemaFor(`interface Target { a: string; b: number; c: boolean; }`);
    expect(s.properties).toEqual({
      a: { type: 'string' },
      b: { type: 'number' },
      c: { type: 'boolean' },
    });
  });

  it('lists non-optional members as required and omits optional ones', () => {
    const s = schemaFor(`interface Target { a: string; b?: string; }`);
    expect(s.required).toEqual(['a']);
    expect(Object.keys(s.properties as object).sort()).toEqual(['a', 'b']);
  });

  it('closes the object — a field the type does not declare is invalid', () => {
    const s = schemaFor(`interface Target { a: string; }`);
    expect(s.additionalProperties).toBe(false);
  });

  it('maps arrays of primitives', () => {
    const s = schemaFor(`interface Target { items: string[]; }`);
    expect((s.properties as Record<string, unknown>).items).toEqual({
      type: 'array',
      items: { type: 'string' },
    });
  });

  it('maps a union of string literals to an enum', () => {
    const s = schemaFor(`interface Target { op: 'create' | 'overwrite' | 'skip'; }`);
    expect((s.properties as Record<string, unknown>).op).toEqual({
      type: 'string',
      enum: ['create', 'overwrite', 'skip'],
    });
  });

  it('flattens inherited members — MutatingResult is spread, not referenced', () => {
    const s = schemaFor(`
      interface Base { dryRun: boolean; }
      interface Target extends Base { name: string; }
    `);
    expect(Object.keys(s.properties as object).sort()).toEqual(['dryRun', 'name']);
    expect((s.required as string[]).sort()).toEqual(['dryRun', 'name']);
  });

  it('recurses into nested object types', () => {
    const s = schemaFor(`
      interface Inner { tool: string; ok: boolean; }
      interface Target { checks: Inner[]; }
    `);
    const checks = (s.properties as Record<string, Record<string, unknown>>).checks;
    expect(checks.type).toBe('array');
    expect((checks.items as Record<string, unknown>).properties).toEqual({
      tool: { type: 'string' },
      ok: { type: 'boolean' },
    });
  });

  it('recurses into inline object literals', () => {
    const s = schemaFor(`
      interface Target {
        errors: Array<{ message: string; line?: number }>;
      }
    `);
    const items = ((s.properties as Record<string, Record<string, unknown>>).errors
      .items) as Record<string, unknown>;
    expect(items.required).toEqual(['message']);
    expect((items.properties as Record<string, unknown>).line).toEqual({ type: 'number' });
  });

  it('maps `string | null` to a nullable type, sorted for a stable drift gate', () => {
    const s = schemaFor(`interface Target { found: string | null; }`);
    expect((s.properties as Record<string, unknown>).found).toEqual({
      type: ['null', 'string'],
    });
  });

  it('leaves a type with an index signature open', () => {
    // `[key: string]: unknown` means extra keys are legal. Closing the object
    // anyway produces a schema STRICTER than the type — which is how
    // bff:validate's `manifest` came to be rejected by its own contract.
    const s = schemaFor(`
      interface Target { name: string; [key: string]: unknown; }
    `);
    expect(s.additionalProperties).toBe(true);
    expect((s.properties as Record<string, unknown>).name).toEqual({ type: 'string' });
  });

  it('constrains additionalProperties when the index signature is typed', () => {
    const s = schemaFor(`interface Target { a: string; [key: string]: string; }`);
    expect(s.additionalProperties).toEqual({ type: 'string' });
  });

  it('degrades a bare object to an open object rather than inventing a shape', () => {
    const s = schemaFor(`interface Target { input: object; }`);
    expect((s.properties as Record<string, unknown>).input).toEqual({ type: 'object' });
  });

  it('maps unknown to an unconstrained schema', () => {
    const s = schemaFor(`interface Target { details: unknown; }`);
    expect((s.properties as Record<string, unknown>).details).toEqual({});
  });

  it('carries a JSDoc comment through as a description', () => {
    const s = schemaFor(`
      interface Target {
        /** Capability names whose feature files were preserved. */
        preserved: string[];
      }
    `);
    expect((s.properties as Record<string, Record<string, unknown>>).preserved.description)
      .toBe('Capability names whose feature files were preserved.');
  });

  it('terminates on a self-referential type instead of recursing forever', () => {
    const s = schemaFor(`interface Target { name: string; child?: Target; }`);
    expect((s.properties as Record<string, unknown>).child).toBeDefined();
  });
});
