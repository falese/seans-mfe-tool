/**
 * Plugin MCP source — discovers tools from installed oclif plugins.
 *
 * For each plugin that ships a schemas/ directory, its JSON schemas are loaded
 * and exposed as MCP tools.  Tool names use the plugin's topic as a prefix:
 *   daemon:start, coder:refactor, etc.
 *
 * Refs #113 (C5)
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import type { McpToolDefinition } from '../tool-registry';

interface OclifPlugin {
  name: string;
  root: string;
  topics?: Record<string, { description?: string }>;
}

interface OclifConfig {
  plugins?: OclifPlugin[];
}

/**
 * Returns the path to the user-level oclif data directory where installed
 * plugins are stored by @oclif/plugin-plugins.
 */
function getOclifDataDir(cliName: string): string {
  return path.join(os.homedir(), '.local', 'share', cliName);
}

export async function loadPluginTools(
  cliName: string,
  schemasRelDir = 'schemas',
): Promise<McpToolDefinition[]> {
  const dataDir = getOclifDataDir(cliName);
  const configPath = path.join(dataDir, 'config.json');

  if (!await fs.pathExists(configPath)) return [];

  let config: OclifConfig;
  try {
    config = await fs.readJson(configPath);
  } catch {
    return [];
  }

  const tools: McpToolDefinition[] = [];

  for (const plugin of config.plugins ?? []) {
    // Skip non-user plugins (built-ins, help, etc.)
    if (!plugin.root || plugin.name.startsWith('@oclif/')) continue;

    const pluginSchemasDir = path.join(plugin.root, schemasRelDir);
    if (!await fs.pathExists(pluginSchemasDir)) continue;

    const files = await fs.readdir(pluginSchemasDir);

    // Determine topic prefix from plugin name or first registered topic
    const topicPrefix = deriveTopicPrefix(plugin);

    for (const file of files.sort()) {
      if (!file.endsWith('.json')) continue;

      try {
        const schema = await fs.readJson(path.join(pluginSchemasDir, file));
        const baseName = path.basename(file, '.json');
        const toolName = `${topicPrefix}:${baseName.replace(/-/g, ':')}`;

        tools.push({
          name: toolName,
          description: schema.description ?? `Run ${toolName}`,
          inputSchema: schema.input ?? { type: 'object', properties: {} },
        });
      } catch {
        // skip malformed schema files
      }
    }
  }

  return tools;
}

function deriveTopicPrefix(plugin: OclifPlugin): string {
  const topics = Object.keys(plugin.topics ?? {});
  if (topics.length > 0) return topics[0];

  // Fall back to the last segment of the package name
  // @falese/daemon-plugin → daemon
  const nameParts = plugin.name.split('/');
  const lastPart = nameParts[nameParts.length - 1];
  return lastPart.replace(/-plugin$/, '');
}
