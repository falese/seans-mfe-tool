/**
 * Read a project's source for `decompose:analyze`: find the app's source and
 * test files and parse each one.
 *
 * TypeScript is a development dependency of the CLI — present in a dev
 * install, not required by the published package — so it is loaded on
 * demand, and its absence is a typed error with the remedy.
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import type * as TS from 'typescript';
import { ValidationError } from '@seans-mfe/contracts';
import { parseFile, type FileFacts } from './parse';

const SOURCE = /\.(tsx?|jsx?)$/;
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage', '.git']);
const TEST = /(^|\/)__tests__\/|\.(test|spec)\.[jt]sx?$|(^|\/)setupTests\.[jt]sx?$/;

export async function loadTypeScript(): Promise<typeof TS> {
  try {
    return (await import('typescript')) as typeof TS;
  } catch {
    throw new ValidationError(
      'decompose:analyze needs the TypeScript compiler to read source. Install it with `npm i -D typescript`.',
      'typescript',
      'required'
    );
  }
}

async function walk(root: string, rel: string, out: string[]): Promise<void> {
  for (const entry of await fs.readdir(path.join(root, rel), { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    const child = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) await walk(root, child, out);
    else if (SOURCE.test(entry.name) && !entry.name.endsWith('.d.ts')) out.push(child);
  }
}

export interface ProjectSource {
  /** App source files (tests excluded), parsed; paths relative to the project directory. */
  facts: FileFacts[];
  /** Test files under the source directory, and e2e specs elsewhere in the project. */
  tests: string[];
}

/** Parse `<dir>/<srcDir>` and find the project's tests. */
export async function readProject(ts: typeof TS, dir: string, srcDir = 'src'): Promise<ProjectSource> {
  if (!(await fs.pathExists(path.join(dir, srcDir)))) {
    throw new ValidationError(`${path.join(dir, srcDir)} does not exist — pass the app's directory (and --src if not src/)`, 'dir', 'source-dir');
  }
  const all: string[] = [];
  await walk(dir, srcDir, all);
  const facts: FileFacts[] = [];
  const tests: string[] = [];
  for (const file of all.sort()) {
    if (TEST.test(file)) tests.push(file);
    else facts.push(parseFile(ts, file, await fs.readFile(path.join(dir, file), 'utf8')));
  }
  // e2e specs usually live beside src/, not in it.
  const others: string[] = [];
  await walk(dir, '', others);
  for (const file of others.sort()) {
    if (!file.startsWith(`${srcDir}/`) && /\.(test|spec)\.[jt]sx?$/.test(file)) tests.push(file);
  }
  return { facts, tests: tests.sort() };
}
