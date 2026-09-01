/**
 * The MCP tool catalog is derived from the oclif command registry.
 *
 * Before this, `scripts/generate-schemas.ts` iterated a hand-written literal.
 * Two consequences the #139 review found: `build:*` had no schema at all, so
 * agents could scaffold an MFE over MCP but not build it; and `deploy.json`
 * advertised eight flags the command does not have, because nothing tied the
 * literal to the command it described.
 *
 * Deriving from the registry makes both classes of drift unrepresentable.
 *
 * Refs #139 · ADR-019 · ADR-077
 */

import {
  deriveInputSchema,
  selectCatalogCommands,
  CATALOG_EXCLUDED,
  type RegistryCommand,
} from '../schema-derivation';

const OWN = 'seans-mfe-tool';

function cmd(partial: Partial<RegistryCommand> & { id: string }): RegistryCommand {
  return { pluginName: OWN, aliases: [], flags: {}, args: {}, ...partial };
}

// ---------------------------------------------------------------------------
// Input derivation
// ---------------------------------------------------------------------------

describe('deriveInputSchema', () => {
  it('maps a boolean flag to a boolean property', () => {
    const schema = deriveInputSchema(
      cmd({ id: 'x', flags: { force: { name: 'force', type: 'boolean', description: 'Overwrite' } } }),
    );
    expect(schema.properties.force).toEqual({ type: 'boolean', description: 'Overwrite' });
  });

  it('maps an option flag with options to a string enum', () => {
    const schema = deriveInputSchema(
      cmd({ id: 'x', flags: { type: { name: 'type', type: 'option', options: ['shell', 'remote', 'api'] } } }),
    );
    expect(schema.properties.type).toEqual({ type: 'string', enum: ['shell', 'remote', 'api'] });
  });

  it('carries defaults through', () => {
    const schema = deriveInputSchema(
      cmd({ id: 'x', flags: { port: { name: 'port', type: 'option', default: '8080' } } }),
    );
    expect(schema.properties.port).toMatchObject({ type: 'string', default: '8080' });
  });

  it('maps a repeatable flag to an array', () => {
    const schema = deriveInputSchema(
      cmd({ id: 'x', flags: { specs: { name: 'specs', type: 'option', multiple: true } } }),
    );
    expect(schema.properties.specs).toMatchObject({ type: 'array', items: { type: 'string' } });
  });

  it('lists required flags and args in required[]', () => {
    const schema = deriveInputSchema(
      cmd({
        id: 'x',
        flags: { type: { name: 'type', type: 'option', required: true } },
        args: { name: { name: 'name', required: true } },
      }),
    );
    expect(schema.required.sort()).toEqual(['name', 'type']);
  });

  it('records positional args in declaration order, separately from flags', () => {
    const schema = deriveInputSchema(
      cmd({
        id: 'x',
        args: { name: { name: 'name' }, target: { name: 'target' } },
        flags: { spec: { name: 'spec', type: 'option' } },
      }),
    );
    expect(schema['x-positional']).toEqual(['name', 'target']);
    expect(Object.keys(schema.properties).sort()).toEqual(['name', 'spec', 'target']);
  });

  it('omits the agent-profile flags — the MCP transport owns those', () => {
    const schema = deriveInputSchema(
      cmd({
        id: 'x',
        flags: {
          json: { name: 'json', type: 'boolean' },
          interactive: { name: 'interactive', type: 'boolean', allowNo: true },
          force: { name: 'force', type: 'boolean' },
        },
      }),
    );
    expect(Object.keys(schema.properties)).toEqual(['force']);
  });

  it('omits cwd — the registry injects it as a reserved argument (#279)', () => {
    const schema = deriveInputSchema(
      cmd({ id: 'x', flags: { cwd: { name: 'cwd', type: 'option' }, port: { name: 'port', type: 'option' } } }),
    );
    expect(Object.keys(schema.properties)).toEqual(['port']);
  });

  it('produces a valid empty schema for a command with no inputs', () => {
    const schema = deriveInputSchema(cmd({ id: 'x' }));
    expect(schema).toMatchObject({ type: 'object', properties: {} });
    expect(schema.required).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Catalog selection
// ---------------------------------------------------------------------------

describe('selectCatalogCommands', () => {
  it('includes the CLI\'s own commands', () => {
    const ids = selectCatalogCommands([cmd({ id: 'remote:init' })]).map((c) => c.id);
    expect(ids).toEqual(['remote:init']);
  });

  it('includes the whole build surface — the gap this replaces', () => {
    const ids = selectCatalogCommands(
      ['build:check', 'build:dev', 'build:docker', 'build:prod'].map((id) => cmd({ id })),
    ).map((c) => c.id);
    expect(ids).toEqual(['build:check', 'build:dev', 'build:docker', 'build:prod']);
  });

  it('includes first-party plugin commands', () => {
    const ids = selectCatalogCommands([
      cmd({ id: 'bff:init', pluginName: '@seans-mfe/plugin-bff' }),
    ]).map((c) => c.id);
    expect(ids).toEqual(['bff:init']);
  });

  it('excludes foreign oclif infrastructure plugins', () => {
    const ids = selectCatalogCommands([
      cmd({ id: 'help', pluginName: '@oclif/plugin-help' }),
      cmd({ id: 'plugins:install', pluginName: '@oclif/plugin-plugins' }),
      cmd({ id: 'remote:init' }),
    ]).map((c) => c.id);
    expect(ids).toEqual(['remote:init']);
  });

  it('excludes alias entries so one command yields one tool', () => {
    // oclif lists an alias as its own entry whose id appears in its own aliases.
    const ids = selectCatalogCommands([
      cmd({ id: 'adr:validate', aliases: ['adr:doctor'] }),
      cmd({ id: 'adr:doctor', aliases: ['adr:doctor'] }),
    ]).map((c) => c.id);
    expect(ids).toEqual(['adr:validate']);
  });

  it('excludes hidden commands', () => {
    const ids = selectCatalogCommands([cmd({ id: 'secret', hidden: true })]).map((c) => c.id);
    expect(ids).toEqual([]);
  });

  it('excludes commands named in CATALOG_EXCLUDED', () => {
    const ids = selectCatalogCommands(
      Object.keys(CATALOG_EXCLUDED).map((id) => cmd({ id })),
    ).map((c) => c.id);
    expect(ids).toEqual([]);
  });

  it('gives a reason for every exclusion', () => {
    for (const reason of Object.values(CATALOG_EXCLUDED)) {
      expect(typeof reason).toBe('string');
      expect(reason.length).toBeGreaterThan(10);
    }
  });

  it('never excludes a build command', () => {
    expect(Object.keys(CATALOG_EXCLUDED).filter((id) => id.startsWith('build:'))).toEqual([]);
  });
});
