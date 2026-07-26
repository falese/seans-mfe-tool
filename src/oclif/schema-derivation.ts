/**
 * Derives the MCP tool catalog from the oclif command registry.
 *
 * `schemas/<cmd>.json` is what `mcp:serve` turns into agent-callable tools, so
 * whatever decides its contents decides what agents can do. That used to be a
 * hand-written literal in scripts/generate-schemas.ts, which drifted in both
 * directions: `build:*` had no entry, so an agent could scaffold and validate
 * an MFE over MCP but never build one; and `deploy` advertised eight flags it
 * does not have, so any agent that used them got a hard parse failure.
 *
 * The command's own flag and arg declarations are the only honest source for
 * its input contract. Deriving from them makes both failures unrepresentable —
 * a flag cannot be advertised unless the command declares it, and a command
 * cannot be missing unless it is excluded on purpose, below.
 *
 * Output schemas stay hand-authored: a command's TypeScript result type is not
 * introspectable at runtime. The generator fails on a command with no output
 * schema rather than emitting `{}`, so adding a command forces the decision.
 *
 * Refs #139 · ADR-019 · ADR-077
 */

// ---------------------------------------------------------------------------
// The shape we need from oclif's Config.commands / oclif.manifest.json
// ---------------------------------------------------------------------------

export interface RegistryFlag {
  name: string;
  type?: string; // 'boolean' | 'option'
  description?: string;
  required?: boolean;
  default?: unknown;
  options?: string[];
  multiple?: boolean;
  allowNo?: boolean;
}

export interface RegistryArg {
  name: string;
  description?: string;
  required?: boolean;
  options?: string[];
  default?: unknown;
}

export interface RegistryCommand {
  id: string;
  pluginName?: string;
  description?: string;
  hidden?: boolean;
  aliases?: string[];
  flags?: Record<string, RegistryFlag>;
  args?: Record<string, RegistryArg>;
}

export interface InputSchema {
  type: 'object';
  properties: Record<string, Record<string, unknown>>;
  required: string[];
  /** Arg names in declaration order — what the CLI takes positionally, not as flags. */
  'x-positional': string[];
}

// ---------------------------------------------------------------------------
// Policy
// ---------------------------------------------------------------------------

/**
 * Flags the MCP transport owns. `--json` is appended to every child invocation
 * and the envelope contract depends on it, so letting a caller set it is a way
 * to break the response rather than a capability. MCP is non-interactive by
 * construction. `cwd` is the reserved execution argument the registry injects
 * on every tool (#279) — it must not also arrive as a command flag.
 */
const TRANSPORT_OWNED = new Set(['json', 'interactive', 'cwd']);

/** Plugins whose commands belong in the catalog. Everything else is infrastructure. */
const FIRST_PARTY = [/^seans-mfe-tool$/, /^@seans-mfe\//, /^@falese\//];

/**
 * Commands deliberately kept out of the agent-facing catalog.
 *
 * Deliberately short, and deliberately not a place to park real gaps: nothing
 * here is a capability an agent would want. `build:*` is absent on purpose —
 * that was the gap this module exists to close.
 */
export const CATALOG_EXCLUDED: Record<string, string> = {
  'mcp:serve': 'the MCP server itself — it would be advertising a tool that starts another copy of it',
  schemas: 'lists the tool catalog; agents get the same information from MCP tools/list',
  'remote:init-angular': 'deprecated alias for `remote:init --framework angular`',
};

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

function isFirstParty(pluginName: string | undefined): boolean {
  if (!pluginName) return true; // no plugin attribution = the root CLI
  return FIRST_PARTY.some((re) => re.test(pluginName));
}

/**
 * oclif lists an alias as its own registry entry, distinguishable only by its
 * id appearing in its own `aliases` array (the canonical entry lists the alias
 * but is not itself one). Without this, `adr:doctor` and `mfe:doctor` would
 * each yield a duplicate tool for a command already in the catalog.
 */
function isAliasEntry(command: RegistryCommand): boolean {
  return (command.aliases ?? []).includes(command.id);
}

export function selectCatalogCommands(commands: RegistryCommand[]): RegistryCommand[] {
  return commands
    .filter((c) => !c.hidden)
    .filter((c) => !isAliasEntry(c))
    .filter((c) => isFirstParty(c.pluginName))
    .filter((c) => !(c.id in CATALOG_EXCLUDED))
    .sort((a, b) => a.id.localeCompare(b.id));
}

// ---------------------------------------------------------------------------
// Input derivation
// ---------------------------------------------------------------------------

function flagProperty(flag: RegistryFlag): Record<string, unknown> {
  const prop: Record<string, unknown> = {};

  if (flag.type === 'boolean') {
    prop.type = 'boolean';
  } else if (flag.multiple) {
    prop.type = 'array';
    prop.items = flag.options ? { type: 'string', enum: flag.options } : { type: 'string' };
  } else {
    prop.type = 'string';
    if (flag.options) prop.enum = flag.options;
  }

  if (flag.description) prop.description = flag.description;
  if (flag.default !== undefined) prop.default = flag.default;

  return prop;
}

function argProperty(arg: RegistryArg): Record<string, unknown> {
  const prop: Record<string, unknown> = { type: 'string' };
  if (arg.options) prop.enum = arg.options;
  if (arg.description) prop.description = arg.description;
  if (arg.default !== undefined) prop.default = arg.default;
  return prop;
}

export function deriveInputSchema(command: RegistryCommand): InputSchema {
  const properties: Record<string, Record<string, unknown>> = {};
  const required: string[] = [];
  const positional: string[] = [];

  // Args first: they are what the CLI reads positionally, and declaration
  // order is the argv order.
  for (const [name, arg] of Object.entries(command.args ?? {})) {
    properties[name] = argProperty(arg);
    positional.push(name);
    if (arg.required) required.push(name);
  }

  for (const [name, flag] of Object.entries(command.flags ?? {})) {
    if (TRANSPORT_OWNED.has(name)) continue;
    properties[name] = flagProperty(flag);
    if (flag.required) required.push(name);
  }

  return { type: 'object', properties, required, 'x-positional': positional };
}
