/**
 * MCP tool registry.
 *
 * Reads schemas/ and converts each command schema into an MCP tool definition.
 * For now the source is local CLI only; C5 will add plugin + remote sources.
 *
 * Refs #106 (B7)
 */

import * as fs from 'fs-extra';
import * as path from 'path';

export interface McpToolDefinition {
  name:        string;
  description: string;
  inputSchema: object;
}

export async function loadToolRegistry(schemasDir: string): Promise<McpToolDefinition[]> {
  const files = await fs.readdir(schemasDir);
  const tools: McpToolDefinition[] = [];

  for (const file of files.sort()) {
    if (!file.endsWith('.json')) continue;

    const schema = await fs.readJson(path.join(schemasDir, file));

    // Convert colon-topic command name for MCP: bff-init → bff:init
    const commandName: string = schema.title ?? file.replace('.json', '').replace(/-/g, ':');

    tools.push({
      name:        commandName,
      description: schema.description ?? `Run seans-mfe-tool ${commandName}`,
      inputSchema: schema.input ?? { type: 'object', properties: {} },
    });
  }

  return tools;
}

/**
 * Map an MCP tool name and its input arguments to CLI argv.
 *
 * Example: toolName="remote:init", input={ name:"my-app", port:"3005" }
 *   →  ["remote:init", "my-app", "--port", "3005", "--json"]
 */
export function buildArgv(toolName: string, input: Record<string, unknown>): string[] {
  const parts = toolName.split(':');
  const argv: string[] = [...parts];

  // Positional args first (heuristic: keys that match known positional names)
  const positionalKeys = new Set(['name', 'spec']);
  const flags: string[] = [];

  for (const [key, value] of Object.entries(input)) {
    if (positionalKeys.has(key) && typeof value === 'string') {
      argv.push(value);
    } else if (typeof value === 'boolean') {
      if (value) flags.push(`--${key}`);
    } else if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        for (const v of value) {
          flags.push(`--${key}`, String(v));
        }
      } else {
        flags.push(`--${key}`, String(value));
      }
    }
  }

  return [...argv, ...flags, '--json'];
}
