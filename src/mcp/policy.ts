/**
 * What the MCP server refuses before it spawns anything (ADR-121).
 *
 * The caller on the other side of `tools/call` is an agent acting on text it
 * has read — a README, an issue, a web page. Its input is therefore untrusted
 * in the ordinary sense: it is checked against what the tool declares, the
 * directory it names is held inside a root, and tools that cannot answer an
 * agent usefully are not offered unless the operator asks for them.
 *
 * Pure and dependency-free on purpose: `ajv` is a devDependency, and the
 * subset of JSON Schema that `schema-derivation.ts` emits for a command's
 * flags and args is small enough to check here exactly.
 */

import * as fs from 'fs';
import * as path from 'path';
import { ValidationError } from '@seans-mfe/contracts';

/**
 * Commands that stay in the published catalog (`schemas/`) but are not offered
 * as MCP tools unless `mcp:serve --allow <id>` names them.
 *
 * Distinct from CATALOG_EXCLUDED, which removes a command from the catalog
 * altogether. These are real commands with real contracts; what they lack is
 * a way to be useful to a caller that waits for one answer.
 */
export const MCP_DEFAULT_OFF: Record<string, string> = {
  'build:dev':
    'starts a dev server and blocks until it is stopped, so a tool call can only end by timing out',
  'bff:dev':
    'starts a Mesh dev server that outlives the call; nothing an agent holds can stop it',
  'decompose:workspace':
    'starts the workspace servers for a person to use in a browser; it does not return while they run',
  deploy:
    'stops and removes an existing container of the same name before it starts a new one, without asking',
};

interface PropertySchema {
  type?: string;
  enum?: unknown[];
  items?: { type?: string };
}

interface InputSchema {
  properties?: Record<string, PropertySchema>;
  required?: unknown;
  'x-positional'?: unknown;
}

// eslint-disable-next-line no-control-regex -- control characters are exactly what is being refused
const CONTROL = /[\u0000-\u001f\u007f]/;

function scalarProblem(value: unknown, type: string | undefined): string | undefined {
  switch (type) {
    case 'boolean':
      return typeof value === 'boolean' ? undefined : 'must be true or false';
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value) ? undefined : 'must be a whole number';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value) ? undefined : 'must be a number';
    default: {
      // A string flag: argv is text, so a finite number is as good as its digits.
      if (typeof value === 'number' && Number.isFinite(value)) return undefined;
      if (typeof value !== 'string') return 'must be a string';
      return CONTROL.test(value) ? 'must not contain control characters' : undefined;
    }
  }
}

/**
 * The reasons `input` is not a call this tool accepts — empty when it is.
 *
 * A schema that declares no `properties` is passed through untouched: a
 * third-party plugin's schema may predate them, and refusing every call to it
 * would be a worse failure than the one this guards against.
 */
export function validateToolInput(schema: unknown, input: Record<string, unknown>): string[] {
  const declared = (schema ?? {}) as InputSchema;
  const properties = declared.properties;
  if (!properties || typeof properties !== 'object') return [];

  const positional = new Set(Array.isArray(declared['x-positional']) ? (declared['x-positional'] as string[]) : []);
  const problems: string[] = [];

  for (const key of Array.isArray(declared.required) ? (declared.required as string[]) : []) {
    if (input[key] === undefined || input[key] === null) problems.push(`"${key}" is required`);
  }

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue;
    const property = properties[key];
    if (!property) {
      problems.push(`"${key}" is not an argument of this tool`);
      continue;
    }

    if (property.type === 'array') {
      if (!Array.isArray(value)) {
        problems.push(`"${key}" must be a list`);
        continue;
      }
      const bad = value.map((v) => scalarProblem(v, property.items?.type)).find(Boolean);
      if (bad) problems.push(`"${key}": every item ${bad}`);
      continue;
    }

    const problem = scalarProblem(value, property.type);
    if (problem) {
      problems.push(`"${key}" ${problem}`);
      continue;
    }
    if (Array.isArray(property.enum) && !property.enum.includes(value)) {
      problems.push(`"${key}" must be one of: ${property.enum.join(', ')}`);
      continue;
    }
    // A positional is passed bare, so one that starts with "-" would be read
    // by the CLI as a flag the caller was never offered.
    if (positional.has(key) && typeof value === 'string' && value.startsWith('-')) {
      problems.push(`"${key}" must not start with "-"`);
    }
  }

  return problems;
}

/**
 * The real path of `requested`, provided it is a directory at or under `root`.
 *
 * Both sides are resolved through symlinks first: a link inside the root that
 * points out of it is outside, whatever its path says.
 */
export async function confineCwd(root: string, requested: string): Promise<string> {
  const realRoot = await fs.promises.realpath(root);
  const candidate = path.resolve(realRoot, requested);

  const real = await fs.promises.realpath(candidate).catch(() => undefined);
  const isDirectory = real !== undefined && (await fs.promises.stat(real)).isDirectory();
  if (real === undefined || !isDirectory) {
    throw new ValidationError(`cwd is not an existing directory: ${requested}`, 'cwd', 'directory');
  }

  const relative = path.relative(realRoot, real);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new ValidationError(
      `cwd is outside the directory this server was started for (${realRoot}): ${requested}. ` +
        'Start mcp:serve with --root to serve a different tree.',
      'cwd',
      'within-root',
    );
  }
  return real;
}
