/**
 * ADR-108 guard: the LayoutManager is the only thing that mounts an MFE (#407).
 *
 * An MFE's imperative presentation handle (`handles.imperative.mount(element,
 * { capability, props })`) is meant to be driven by exactly one caller: the
 * content-type adaptor the LayoutManager hands each experience to. Every
 * guarantee the platform gives a mounted slot — slot state, slot-scoped error
 * isolation and escalation (ADR-060), slot ownership and provided slots
 * (ADR-058/066), per-slot daemon channels (ADR-057), and the `data-smt-*`
 * boundary stamps (#408) — lives on that path.
 *
 * `@seans-mfe/framework-react`'s `MfeHost`/`useMfe` called `handle.mount`
 * itself and skipped all of it, unused by any shell. It is gone; this test is
 * what stops the next convenience wrapper from reopening the same hole.
 *
 * Scanned: `src`, `packages`, `examples` — `.ts`, `.tsx` and the `.ejs`
 * templates that become generated code. Not matched: `adaptor.mount(` (the
 * LayoutManager calling its adaptor), an MFE implementing its own `mount`
 * (the Rust/wasm remote entry's `m.mount`), and prose in comments.
 */

import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const ROOTS = ['src', 'packages', 'examples'];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.ejs']);
const EXCLUDED_SEGMENTS = ['__tests__', 'node_modules', 'dist', 'coverage'];

/** The one file allowed to drive a presentation handle. */
const SOLE_MOUNTER = path.join('packages', 'runtime', 'src', 'layout-adaptors.ts');

/** A call on an MFE presentation handle: `handle.mount(`, `handles.imperative.mount(`. */
const HANDLE_MOUNT = /\bhandles?(?:\.imperative)?\.mount\s*\(/;

/** Comment lines describe the port; they do not call it. */
const COMMENT = /^\s*(?:\/\/|\*|\/\*)/;

function sourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDED_SEGMENTS.includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (SOURCE_EXTENSIONS.has(path.extname(entry.name)) && !/\.(test|spec)\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function handleMountCalls(): string[] {
  const hits: string[] = [];
  for (const root of ROOTS) {
    for (const file of sourceFiles(path.join(REPO_ROOT, root))) {
      const rel = path.relative(REPO_ROOT, file);
      fs.readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (HANDLE_MOUNT.test(line) && !COMMENT.test(line)) hits.push(`${rel}:${i + 1}  ${line.trim()}`);
        });
    }
  }
  return hits;
}

describe('ADR-108: the LayoutManager is the sole mounter', () => {
  it('only the LayoutManager adaptors call an MFE presentation handle', () => {
    const outside = handleMountCalls().filter((hit) => !hit.startsWith(`${SOLE_MOUNTER}:`));
    expect(outside).toEqual([]);
  });

  it('still finds the sanctioned call, so the scan is not vacuous', () => {
    expect(handleMountCalls().some((hit) => hit.startsWith(`${SOLE_MOUNTER}:`))).toBe(true);
  });
});
