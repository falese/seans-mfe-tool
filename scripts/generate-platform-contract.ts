/**
 * Generates the tables in docs/PLATFORM-CONTRACT.md, the base-class reference.
 *
 *   npm run build:platform-contract          # rewrite the generated blocks
 *   npm run build:platform-contract:check    # exit 1 if they are stale
 *
 * The contract is defined once, in code (ADR-080), and every build target
 * implements all of it (ADR-102). So the document's tables are read from the
 * same sources the conformance suite checks, never retyped:
 *
 *   - capability names, hooks, result types, state rules and descriptions —
 *     PLATFORM_CAPABILITY_SPECS in packages/contracts/src/platform-contract.ts;
 *   - the lifecycle machine — MFE_LIFECYCLE_TRANSITIONS, same file;
 *   - every result's fields — packages/runtime/src/capability-results.ts, read
 *     with the TypeScript compiler;
 *   - the Swift and Rust spellings — the rule the generated code follows (Swift
 *     keeps the TypeScript names, Rust uses snake_case), which the tests check
 *     against the generated example crate and package.
 *
 * Only the text between each BEGIN/END GENERATED pair is written; the prose
 * around it is hand-written and left alone.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import {
  MFE_LIFECYCLE_STATES,
  MFE_LIFECYCLE_TRANSITIONS,
  PLATFORM_CAPABILITIES,
  PLATFORM_CAPABILITY_SPECS,
} from '../packages/contracts/src/platform-contract';
import { snakeCase } from '../packages/codegen/src/rust-naming';

const REPO = path.resolve(__dirname, '..');
const DOC = path.join(REPO, 'docs/PLATFORM-CONTRACT.md');
const RESULTS = path.join(REPO, 'packages/runtime/src/capability-results.ts');

export const MARKERS = {
  capabilities: ['<!-- BEGIN GENERATED: capabilities -->', '<!-- END GENERATED: capabilities -->'],
  lifecycle: ['<!-- BEGIN GENERATED: lifecycle -->', '<!-- END GENERATED: lifecycle -->'],
  results: ['<!-- BEGIN GENERATED: results -->', '<!-- END GENERATED: results -->'],
  lanes: ['<!-- BEGIN GENERATED: lanes -->', '<!-- END GENERATED: lanes -->'],
} as const;

export type Block = keyof typeof MARKERS;

const code = (s: string): string => `\`${s}\``;
/** A table cell: pipes would split the column. */
const cell = (s: string): string => s.replace(/\|/g, '\\|');

/**
 * Two tables, one row per capability each: what it is (hook, result, purpose),
 * then how it moves the lifecycle. Split because six columns do not fit the
 * published page's content width.
 */
export function capabilityTable(): string {
  const what = PLATFORM_CAPABILITIES.map((name) => {
    const spec = PLATFORM_CAPABILITY_SPECS[name];
    return `| ${code(name)} | ${code(spec.wrapperMethod)} | ${code(spec.resultType)} | ${cell(spec.description)} |`;
  });
  const lifecycle = PLATFORM_CAPABILITIES.map((name) => {
    const spec = PLATFORM_CAPABILITY_SPECS[name];
    const from = spec.preStates.length === 0 ? 'any state' : spec.preStates.map(code).join(', ');
    const moves = [
      spec.enterState && `enters ${code(spec.enterState)}`,
      spec.exitState && `${code(spec.exitState)} on success`,
      spec.errorState && `${code(spec.errorState)} on failure`,
    ]
      .filter(Boolean)
      .join(', ');
    return `| ${code(name)} | ${from} | ${moves || 'no change'} |`;
  });
  return [
    '| Capability | Hook you override | Returns | Purpose |',
    '|---|---|---|---|',
    ...what,
    '',
    'When each capability may run, and how it moves the lifecycle:',
    '',
    '| Capability | Callable from | State change |',
    '|---|---|---|',
    ...lifecycle,
  ].join('\n');
}

/** The legal edges of the six-state machine. */
export function lifecycleTable(): string {
  const rows = MFE_LIFECYCLE_STATES.map((state) => {
    const next = MFE_LIFECYCLE_TRANSITIONS[state];
    return `| ${code(state)} | ${next.length ? next.map(code).join(', ') : 'none (terminal)'} |`;
  });
  return ['| From | May move to |', '|---|---|', ...rows].join('\n');
}

export interface ResultField {
  name: string;
  optional: boolean;
  type: string;
}

/** Every exported interface in capability-results.ts, field by field. */
export function readResultShapes(file: string = RESULTS): Record<string, ResultField[]> {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const printer = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed });
  const shapes: Record<string, ResultField[]> = {};
  source.forEachChild((node) => {
    if (!ts.isInterfaceDeclaration(node)) return;
    const fields: ResultField[] = [];
    for (const member of node.members) {
      if (!ts.isPropertySignature(member) || !member.type) continue;
      const printed = printer.printNode(ts.EmitHint.Unspecified, member.type, source);
      fields.push({
        name: member.name.getText(source),
        optional: !!member.questionToken,
        type: printed.replace(/\s+/g, ' ').trim(),
      });
    }
    shapes[node.name.text] = fields;
  });
  return shapes;
}

/** One table per result type a capability returns; prose for void and boolean. */
export function resultShapesSection(shapes: Record<string, ResultField[]>): string {
  const out: string[] = [];
  for (const name of PLATFORM_CAPABILITIES) {
    const type = PLATFORM_CAPABILITY_SPECS[name].resultType;
    if (type === 'void') {
      out.push(`#### ${name}\n\n${code(name)} returns nothing; success is the absence of a thrown error.`);
      continue;
    }
    if (type === 'boolean') {
      out.push(`#### ${name}\n\n${code(name)} returns a boolean: ${code('true')} to allow, ${code('false')} to deny.`);
      continue;
    }
    const fields = shapes[type];
    if (!fields) throw new Error(`capability-results.ts has no interface ${type} (named by ${name})`);
    const rows = fields.map(
      (f) => `| ${code(f.name)} | ${f.optional ? 'no' : 'yes'} | ${code(cell(f.type))} |`
    );
    out.push(
      [`#### ${name} → ${type}`, '', '| Field | Required | Type |', '|---|---|---|', ...rows].join('\n')
    );
  }
  return out.join('\n\n');
}

/** The same ten capabilities, as each build spells them. */
export function laneNames(): string {
  const rows = PLATFORM_CAPABILITIES.map((name) => {
    const hook = PLATFORM_CAPABILITY_SPECS[name].wrapperMethod;
    return `| ${code(name)} | ${code(hook)} | ${code(name)} / ${code(hook)} | ${code(snakeCase(name))} / ${code(snakeCase(hook))} |`;
  });
  return [
    '| TypeScript (React, Angular) | TypeScript hook | Swift | Rust (native and WASM) |',
    '|---|---|---|---|',
    ...rows,
  ].join('\n');
}

/** Replace the text between each pair of markers; throws if a pair is missing. */
export function applyGenerated(doc: string, blocks: Record<Block, string>): string {
  let out = doc;
  for (const key of Object.keys(MARKERS) as Block[]) {
    const [begin, end] = MARKERS[key];
    const a = out.indexOf(begin);
    const b = out.indexOf(end);
    if (a === -1 || b === -1 || b < a) {
      throw new Error(`docs/PLATFORM-CONTRACT.md is missing the ${key} markers (${begin} … ${end})`);
    }
    out = out.slice(0, a + begin.length) + '\n' + blocks[key] + '\n' + out.slice(b);
  }
  return out;
}

function main(): void {
  const check = process.argv.includes('--check');
  const current = fs.readFileSync(DOC, 'utf8');
  const next = applyGenerated(current, {
    capabilities: capabilityTable(),
    lifecycle: lifecycleTable(),
    results: resultShapesSection(readResultShapes()),
    lanes: laneNames(),
  });
  if (check) {
    if (next !== current) {
      console.error('docs/PLATFORM-CONTRACT.md is stale — run: npm run build:platform-contract (then commit it)');
      process.exit(1);
    }
    console.log('OK    docs/PLATFORM-CONTRACT.md — generated tables match the contract.');
    return;
  }
  fs.writeFileSync(DOC, next);
  console.log(next === current ? 'docs/PLATFORM-CONTRACT.md already current' : 'wrote docs/PLATFORM-CONTRACT.md');
}

if (require.main === module) main();
