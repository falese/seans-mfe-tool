# MFE Development Tool

A CLI tool for creating and managing Micro-Frontend applications using Module Federation.

## Commands

### Create Shell Application

```bash
mfe shell <name> [options]
```

Options:

- `-p, --port <port>`: Port number (default: 3000)
- `-r, --remotes <remotes>`: Remote MFEs configuration

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

### Initialize Workspace

```bash
mfe init <name> [options]
```

Options:

- `-p, --package-manager <manager>`: Package manager (npm, yarn, or pnpm)

## Recent Updates

- Added API generation command with OpenAPI specification support
- Integrated rspack for improved build performance
- Added MUI version configuration for remote MFEs
