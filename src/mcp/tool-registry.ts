/**
 * MCP tool registry.
 *
 * Aggregates tools from two sources:
 *   1. Local  — CLI's own schemas/; tools prefixed "mfe:"
 *   2. Plugin — installed oclif plugins with schemas/; prefixed by topic
 *
 * Every tool offered is one `tools/call` can run: the server only ever spawns
 * this CLI (ADR-019). A third source used to list tools from external MCP
 * servers named in ~/.config/seans-mfe/mcp.json; nothing proxied a call to
 * them, so each resolved to a command that does not exist, and loading the
 * list ran whatever command the file named. It is removed until there is a
 * proxy to put behind it (ADR-121 §5).
 *
 * Tool name collisions across sources abort startup with a SystemError so
 * conflicts are never silently hidden.
 *
 * Refs #106 (B7), #113 (C5)
 */

import { SystemError } from '@seans-mfe/contracts';
import { loadLocalTools } from './sources/local';
import { loadPluginTools } from './sources/plugin';
import { MCP_DEFAULT_OFF } from './policy';

export interface McpToolDefinition {
  name:        string;
  description: string;
  inputSchema: object;
  /**
   * The CLI command this tool runs. Set by sources that know it (the local
   * schemas carry it as `title`); without it, `buildArgv` falls back to
   * stripping the source prefix from `name` — which is how a command already
   * in the `mfe:` topic used to become the tool `mfe:mfe:validate` (#331).
   */
  command?:    string;
}

export interface RegistryOptions {
  schemasDir: string;
  cliName?: string;
  /** Command ids from MCP_DEFAULT_OFF to offer anyway (`mcp:serve --allow`). */
  allow?: string[];
}

export async function loadToolRegistry(
  schemasDir: string,
  options: Partial<RegistryOptions> = {},
): Promise<McpToolDefinition[]> {
  const cliName = options.cliName ?? 'seans-mfe-tool';
  const [localTools, pluginTools] = await Promise.all([
    loadLocalTools(schemasDir),
    loadPluginTools(cliName),
  ]);

  // Tools that cannot answer an agent usefully are left out unless the
  // operator names them (ADR-121). The catalog in schemas/ is unchanged.
  const allowed = new Set(options.allow ?? []);
  const offered = localTools.filter(
    (t) => t.command === undefined || !(t.command in MCP_DEFAULT_OFF) || allowed.has(t.command),
  );

  const all = [...offered, ...pluginTools];

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

  // Every tool accepts a reserved `cwd` (#279): the directory the child CLI
  // runs in. Injected centrally so both sources (local, plugin)
  // advertise it without each schema having to declare it.
  for (const tool of all) {
    const schema = tool.inputSchema as {
      type?: string;
      properties?: Record<string, unknown>;
    };
    if (schema && typeof schema === 'object') {
      schema.properties = {
        ...(schema.properties ?? {}),
        cwd: {
          type: 'string',
          description:
            'Working directory for this call — the directory the command operates on ' +
            '(e.g. the MFE folder for remote:generate). Must exist, inside the directory the server ' +
            'was started for. Relative paths resolve against that directory, which is also the default.',
        },
      };
    }
  }

  return all;
}

/**
 * Map an MCP tool name and its input arguments to CLI argv.
 *
 * Examples:
 *   mfe:schemas → ["schemas", "--json"]
 *   mfe:bff:init → ["bff:init", "--json"]
 *   mfe:validate (command "mfe:validate") → ["mfe:validate", "--json"]
 */
export function buildArgv(
  toolName: string,
  input: Record<string, unknown>,
  positional?: string[],
  command?: string,
): string[] {
  // The tool's declared command wins. Otherwise strip the source prefix
  // (mfe:, daemon:, coder:, etc.).
  const commandId = command ?? toolName.split(':').slice(1).join(':');
  const argv: string[] = [commandId];

  // Which inputs the command takes positionally comes from its own arg
  // declarations, carried in the schema as `x-positional`. The fallback is for
  // third-party plugin schemas that predate it; it is deliberately just `name`
  // — the previous hardcoded set also contained `spec`, which is a flag on
  // every command that has one, so an agent supplying it produced an extra
  // positional the command rejected.
  const positionalKeys = positional ?? ['name'];

  // Reserved execution arguments consumed by the MCP server itself (#279):
  // never forwarded to the CLI.
  const reservedKeys = new Set(['cwd']);
  const flags: string[] = [];

  // Declaration order is argv order, so walk the positionals rather than the
  // caller's (unordered) input object.
  for (const key of positionalKeys) {
    const value = input[key];
    if (typeof value === 'string') argv.push(value);
  }

  for (const [key, value] of Object.entries(input)) {
    if (reservedKeys.has(key) || positionalKeys.includes(key)) {
      continue;
    }
    if (typeof value === 'boolean') {
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
