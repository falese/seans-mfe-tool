/**
 * Local MCP source — discovers tools from the CLI's own schemas/ directory.
 * All tool names are prefixed with "mfe:" (e.g. mfe:deploy, mfe:bff:init).
 *
 * Refs #113 (C5)
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import type { McpToolDefinition } from '../tool-registry';

export async function loadLocalTools(schemasDir: string): Promise<McpToolDefinition[]> {
  if (!await fs.pathExists(schemasDir)) return [];

  const tools: McpToolDefinition[] = [];

  // Walk top-level and one-level-deep dirs for nested command schemas
  const entries = await fs.readdir(schemasDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const subDir = path.join(schemasDir, entry.name);
      const subFiles = await fs.readdir(subDir);
      for (const f of subFiles) {
        if (f.endsWith('.json')) files.push(path.join(subDir, f));
      }
    } else if (entry.name.endsWith('.json')) {
      files.push(path.join(schemasDir, entry.name));
    }
  }

  for (const filePath of files.sort()) {
    const schema = await fs.readJson(filePath);
    const baseName = path.basename(filePath, '.json');

    // bff-init → mfe:bff:init
    const toolName = 'mfe:' + baseName.replace(/-/g, ':');
    const commandName: string = schema.title ?? baseName.replace(/-/g, ':');

    tools.push({
      name: toolName,
      description: schema.description ?? `Run seans-mfe-tool ${commandName}`,
      inputSchema: schema.input ?? { type: 'object', properties: {} },
    });
  }

  return tools;
}
