/**
 * The local MCP source turns files in schemas/ into agent-callable tools.
 * It recurses one level so nested command schemas are picked up — which also
 * swept in schemas/dsl/manifest.schema.json, the DSL *document* schema
 * (ADR-065). That advertised a tool named `mfe:manifest.schema` that always
 * failed with "command manifest.schema not found".
 *
 * A command contract is identified by having an `input` schema. Anything
 * without one is a document, not a command, and must not be offered to agents.
 *
 * Refs #139 · ADR-019 · ADR-065
 */

import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { loadLocalTools } from '../sources/local';

let schemasDir: string;

beforeEach(async () => {
  schemasDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-local-'));
});

afterEach(async () => {
  await fs.remove(schemasDir);
});

async function writeSchema(relPath: string, body: unknown): Promise<void> {
  const full = path.join(schemasDir, relPath);
  await fs.ensureDir(path.dirname(full));
  await fs.writeJson(full, body);
}

const COMMAND_SCHEMA = {
  title: 'remote:init',
  description: 'Input/output contract for seans-mfe-tool remote:init',
  input: { type: 'object', properties: { name: { type: 'string' } } },
  output: { type: 'object' },
};

describe('loadLocalTools', () => {
  it('registers a top-level command schema', async () => {
    await writeSchema('remote-init.json', COMMAND_SCHEMA);
    const tools = await loadLocalTools(schemasDir);
    expect(tools.map((t) => t.name)).toEqual(['mfe:remote:init']);
  });

  it('registers a nested command schema one level deep', async () => {
    await writeSchema('remote/generate.json', COMMAND_SCHEMA);
    const tools = await loadLocalTools(schemasDir);
    expect(tools).toHaveLength(1);
  });

  it('does NOT register a document schema that has no input contract', async () => {
    await writeSchema('dsl/manifest.schema.json', {
      $id: 'https://example.test/manifest.schema.json',
      title: 'seans-mfe-tool DSL manifest',
      description: 'MFE manifest accepted by seans-mfe-tool codegen.',
      type: 'object',
      properties: { name: { type: 'string' } },
    });

    const tools = await loadLocalTools(schemasDir);
    expect(tools).toEqual([]);
  });

  it('keeps commands while dropping documents when both are present', async () => {
    await writeSchema('remote-init.json', COMMAND_SCHEMA);
    await writeSchema('dsl/manifest.schema.json', { title: 'doc', type: 'object' });

    const tools = await loadLocalTools(schemasDir);
    expect(tools.map((t) => t.name)).toEqual(['mfe:remote:init']);
  });

  it('every registered tool exposes a non-empty input schema', async () => {
    await writeSchema('remote-init.json', COMMAND_SCHEMA);
    await writeSchema('dsl/manifest.schema.json', { title: 'doc', type: 'object' });

    for (const tool of await loadLocalTools(schemasDir)) {
      expect(tool.inputSchema).toBeDefined();
      expect(Object.keys(tool.inputSchema.properties ?? {}).length).toBeGreaterThan(0);
    }
  });

  it('returns [] for a missing schemas dir', async () => {
    expect(await loadLocalTools(path.join(schemasDir, 'nope'))).toEqual([]);
  });
});

describe('the shipped schemas/ directory', () => {
  it('offers no tool named mfe:manifest.schema', async () => {
    const shipped = path.resolve(__dirname, '../../../schemas');
    if (!(await fs.pathExists(shipped))) return;

    const names = (await loadLocalTools(shipped)).map((t) => t.name);
    expect(names).not.toContain('mfe:manifest.schema');
    expect(names.length).toBeGreaterThan(0);
  });
});
