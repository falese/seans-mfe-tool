# MFE Development Tool

A CLI tool for creating and managing Micro-Frontend applications using Module Federation.

## Commands

### Create Shell Application

```bash
mfe shell <name> [options]
```

Options:

- `-p, --port <port>`: Port number (default: 3000)
- `-r, --remotes <remotes>`: Remote MFEs configuration as JSON string

### Create Remote MFE

```bash
mfe remote <name> [options]
```

Options:

- `-p, --port <port>`: Port number (default: 3001)
- `-m, --mui-version <version>`: Material UI version (default: 5.15.0)

### Create API

```bash
mfe api <name> [options]
```

Options:

- `-p, --port <port>`: Port number (default: 3001)
- `-s, --spec <path>`: OpenAPI specification file path or URL
- `-d, --database <type>`: Database type (mongodb or sqlite, default: sqlite)

Database Features:

- **MongoDB**
  - Schema versioning system
  - Automatic schema updates
  - Example data seeding
  - Rollback support
- **SQLite**
  - Migration management
  - Automatic table creation
  - Example data seeding
  - Transaction support

Example:

```bash
# Create API with MongoDB
mfe api my-store-api --spec store.yaml --database mongodb

# Create API with SQLite
mfe api inventory-api --spec inventory.yaml --database sqlite
```

### Initialize Workspace

```bash
mfe init <name> [options]
```

Options:

- `-p, --package-manager <manager>`: Package manager (npm, yarn, or pnpm)

## Features

### Module Federation

- Shell (container) application creation
- Remote MFE development
- Automatic configuration
- Runtime dependency sharing

### API Generation

- OpenAPI specification support
- Multiple database options
- Automatic CRUD operations
- Data validation
- Error handling
- Middleware support
- Documentation generation

### Database Management

- Schema version control
- Automatic migrations
- Data seeding
- Rollback support
- Type-safe models
- Relationship handling

### Development Tools

- Hot module replacement
- TypeScript support
- ESLint configuration
- Jest testing setup
- Docker deployment
- Environment management

## Recent Updates

- Enhanced database support with MongoDB schema versioning and SQLite migrations
- Added automatic example data generation from OpenAPI specs
- Integrated rspack for improved build performance
- Added MUI version configuration for remote MFEs
- Improved API generation with validation and error handling
- Added database rollback and migration support

## Project Structure

The project follows a modular architecture with clear separation of concerns:

```
.
├── bin/                  # CLI entry point
├── src/
│   ├── commands/        # Command implementations
│   ├── templates/       # Project templates
│   │   ├── api/        # API templates
│   │   ├── docker/     # Docker configurations
│   │   └── react/      # React templates
│   └── utils/          # Utility modules
│       ├── ControllerGenerator/
│       ├── DatabaseGenerator/
│       ├── RouteGenerator/
│       └── generators/
└── docs/               # Documentation
```

## Workspace Examples (ADR-015)

Reference scaffold workspaces have been relocated under `examples/workspaces/`:

- `examples/workspaces/npm/` – npm-based monorepo template
- `examples/workspaces/yarn/` – yarn-based monorepo template

Each contains:

```
README.md
package.json
mfe-spec.yaml
apps/  packages/  docs/
```

Use them as starting points:

```bash
npx seans-mfe-tool init my-workspace --package-manager npm
npx seans-mfe-tool init my-workspace --package-manager yarn
```

They are not part of the runtime; they serve as reference templates only (see ADR-015 in `docs/architecture-decisions.md`).

## AI Agent Guide

- For repo-specific AI coding guidance, see `.github/copilot-instructions.md`.
- For the separate browser agent system, see `agent-orchestrator/README.md`.

## Contributing

## Deprecated / Removed Commands

`analyze` (static heuristic boundary suggestion) has been **removed** (see ADR-021).
It previously inferred potential MFEs from filename/import patterns. The platform now
uses runtime + DSL-driven discovery:

- Register MFEs with orchestration (ADR-012, ADR-016)
- Fetch DSL manifests on-demand (ADR-010, ADR-013)
- Apply discovery phases A (probabilistic), C (semantic), B (deterministic) (ADR-011)

Migration Guidance:
1. Define capability contracts directly in DSL manifests (`/.well-known/mfe-manifest.yaml`).
2. Use runtime registry + telemetry to evolve boundaries incrementally.
3. Replace any `mfe analyze` automation with DSL authoring + orchestration queries.

If assisted DSL derivation is needed, a future command may provide structured generation (not a restoration of the old analyzer).

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
