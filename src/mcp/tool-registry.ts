/**
 * MCP tool registry with federation.
 *
 * Aggregates tools from three sources:
 *   1. Local  — CLI's own schemas/; tools prefixed "mfe:"
 *   2. Plugin — installed oclif plugins with schemas/; prefixed by topic
 *   3. Remote — servers listed in ~/.config/seans-mfe/mcp.json; prefixed by name
 *
 * Tool name collisions across sources abort startup with a SystemError so
 * conflicts are never silently hidden.
 *
 * Refs #106 (B7), #113 (C5)
 */

import { SystemError } from '@seans-mfe/contracts';
import { loadLocalTools } from './sources/local';
import { loadPluginTools } from './sources/plugin';
import { loadRemoteTools } from './sources/remote';

export interface McpToolDefinition {
  name:        string;
  description: string;
  inputSchema: object;
}

export interface RegistryOptions {
  schemasDir: string;
  cliName?: string;
  remoteMcpConfigPath?: string;
}

export async function loadToolRegistry(
  schemasDir: string,
  options: Partial<RegistryOptions> = {},
): Promise<McpToolDefinition[]> {
  const cliName = options.cliName ?? 'seans-mfe-tool';
  const remoteMcpConfigPath = options.remoteMcpConfigPath; // undefined = default path

  const [localTools, pluginTools, remoteTools] = await Promise.all([
    loadLocalTools(schemasDir),
    loadPluginTools(cliName),
    loadRemoteTools(remoteMcpConfigPath),
  ]);

  const all = [...localTools, ...pluginTools, ...remoteTools];

  // Collision detection — fail loudly at startup
  const seen = new Map<string, string>();
  for (const tool of all) {
    const existing = seen.get(tool.name);
    if (existing) {
      throw new SystemError(
        `MCP tool name collision: "${tool.name}" is registered by multiple sources. ` +
        `Rename the conflicting tool or remove one of the sources.`,
      );
    }
    seen.set(tool.name, tool.name);
  }

  return all;
}

/**
 * Map an MCP tool name and its input arguments to CLI argv.
 *
 * Examples:
 *   mfe:deploy  → ["deploy", "--json"]
 *   mfe:bff:init → ["bff:init", "--json"]
 *   daemon:start → ["daemon:start", "--json"]
 */
export function buildArgv(toolName: string, input: Record<string, unknown>): string[] {
  // Strip the source prefix (mfe:, daemon:, coder:, etc.)
  const parts = toolName.split(':');
  const commandParts = parts.slice(1); // drop source prefix
  const commandId = commandParts.join(':');
  const argv: string[] = [commandId];

  const positionalKeys = new Set(['name', 'spec']);
  const flags: string[] = [];

  for (const [key, value] of Object.entries(input)) {
    if (positionalKeys.has(key) && typeof value === 'string') {
      argv.push(value);
    } else if (typeof value === 'boolean') {
      if (value) flags.push(`--${key}`);
    } else if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        for (const v of value) flags.push(`--${key}`, String(v));
      } else {
        flags.push(`--${key}`, String(value));
      }
    }
  }

  return [...argv, ...flags, '--json'];
}
