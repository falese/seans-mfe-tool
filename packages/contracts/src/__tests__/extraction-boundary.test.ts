/**
 * The extraction boundary: which of `contracts` the generator actually needs.
 *
 * `packages/contracts` is 2,197 lines, and `@seans-mfe/codegen` and
 * `@seans-mfe/dsl` — the two packages an extracted generator consists of —
 * use about a third of it. The rest (`envelope`, `messages`, `observability`,
 * `presentation`, `build-output-parser`, `framework-plugin`) is CLI and runtime
 * concern that happens to live in the same package.
 *
 * This test states which modules are in and enforces that the list only
 * changes deliberately. It exists because "the boundary is obvious once you
 * look" was true right up until someone adds an import and nobody looks —
 * exactly how `codegen` ended up resolving a path into `plugin-bff`.
 *
 * It does NOT split the package. The value is knowing the answer and being
 * told when it changes; moving files would be churn on top of that.
 */

import * as fs from 'fs';
import * as path from 'path';

const PACKAGES = path.resolve(__dirname, '..', '..', '..');

/**
 * `contracts` modules the generator core is allowed to import.
 *
 * Adding a row is a deliberate widening of what an extracted generator has to
 * carry. Removing one shrinks it. Either way it is a decision, not a drift.
 */
const ALLOWED = [
  'errors', // the typed error hierarchy generated code throws
  'error-classifier', // re-exported through errors/
  'platform-contract', // PLATFORM_CAPABILITIES and friends (ADR-080)
  'slot-grammar', // slot id grammar (ADR-069)
  'slot-contract', // createSlotAddressRegistry — slot-validation AND composition
  'mesh-catalog', // Mesh plugin/transform classification (ADR-092)
] as const;

/** Modules that are CLI or runtime concern and stay behind. */
const OUT_OF_SCOPE = [
  'envelope',
  'messages',
  'observability',
  'presentation',
  'build-output-parser',
  'framework-plugin',
] as const;

/** Every symbol `dir` imports from `@seans-mfe/contracts`. */
function contractsImports(dir: string): Array<{ file: string; symbols: string[] }> {
  const hits: Array<{ file: string; symbols: string[] }> = [];
  const walk = (d: string): void => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        if (['__tests__', 'node_modules', 'dist'].includes(entry.name)) continue;
        walk(full);
        continue;
      }
      if (!entry.name.endsWith('.ts') || entry.name.endsWith('.test.ts')) continue;
      const text = fs.readFileSync(full, 'utf8');
      // `import … from '@seans-mfe/contracts'` and the `export … from` form.
      const re = /(?:import|export)\s+(?:type\s+)?\{([^}]*)\}\s+from\s+'@seans-mfe\/contracts'/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const symbols = m[1]
          .split(',')
          .map((s) => s.replace(/\btype\b/, '').trim())
          .filter(Boolean);
        if (symbols.length) hits.push({ file: path.relative(PACKAGES, full), symbols });
      }
    }
  };
  walk(dir);
  return hits;
}

/** Which contracts module exports `symbol`, by reading the sources. */
function moduleExporting(symbol: string): string | undefined {
  const srcDir = path.join(PACKAGES, 'contracts', 'src');
  const search = (dir: string, prefix = ''): string | undefined => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (['__tests__', 'node_modules', 'dist'].includes(entry.name)) continue;
        const found = search(path.join(dir, entry.name), entry.name);
        if (found) return prefix || entry.name;
        continue;
      }
      if (!entry.name.endsWith('.ts') || entry.name.endsWith('.test.ts')) continue;
      const text = fs.readFileSync(path.join(dir, entry.name), 'utf8');
      const declared = new RegExp(
        `export\\s+(?:abstract\\s+)?(?:const|function|class|interface|type|enum)\\s+${symbol}\\b`,
      );
      if (declared.test(text)) {
        return prefix || entry.name.replace(/\.ts$/, '');
      }
    }
    return undefined;
  };
  return search(srcDir);
}

describe('the generator core imports only its slice of contracts', () => {
  const generatorPackages = ['codegen', 'dsl'];

  it('finds imports to check (guards against a silently empty sweep)', () => {
    const all = generatorPackages.flatMap((p) =>
      contractsImports(path.join(PACKAGES, p, 'src')),
    );
    expect(all.length).toBeGreaterThan(0);
  });

  it.each(generatorPackages)('%s imports nothing outside the allowed modules', (pkg) => {
    const offenders: string[] = [];
    for (const { file, symbols } of contractsImports(path.join(PACKAGES, pkg, 'src'))) {
      for (const symbol of symbols) {
        const owner = moduleExporting(symbol);
        if (!owner) continue; // a symbol we cannot attribute is not evidence
        if (!(ALLOWED as readonly string[]).includes(owner)) {
          offenders.push(`${file} imports ${symbol} from contracts/${owner}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('keeps the allow-list honest — every entry is actually imported', () => {
    // A module listed but unused would overstate what an extraction has to
    // carry, and would quietly become permission for a future import.
    const used = new Set<string>();
    for (const pkg of generatorPackages) {
      for (const { symbols } of contractsImports(path.join(PACKAGES, pkg, 'src'))) {
        for (const symbol of symbols) {
          const owner = moduleExporting(symbol);
          if (owner) used.add(owner);
        }
      }
    }
    // `error-classifier` reaches the generator via the errors barrel rather
    // than by name, so it is allowed to be absent from a by-symbol sweep.
    const unusedButListed = ALLOWED.filter(
      (m) => m !== 'error-classifier' && !used.has(m),
    );
    expect(unusedButListed).toEqual([]);
  });

  it('confirms the out-of-scope modules really are unused by the generator', () => {
    const leaked: string[] = [];
    for (const pkg of generatorPackages) {
      for (const { file, symbols } of contractsImports(path.join(PACKAGES, pkg, 'src'))) {
        for (const symbol of symbols) {
          const owner = moduleExporting(symbol);
          if (owner && (OUT_OF_SCOPE as readonly string[]).includes(owner)) {
            leaked.push(`${file} imports ${symbol} from contracts/${owner}`);
          }
        }
      }
    }
    expect(leaked).toEqual([]);
  });
});
