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

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
