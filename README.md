# Sean's MFE Tool

A CLI tool for creating and managing Module Federation applications with React and Material UI.

## Features

- Create shell (container) applications
- Create remote MFEs with configurable Material UI versions
- RSpack-based build configuration
- Module Federation setup out of the box

## Installation

```bash
npm install -g seans-mfe-tool
```

## Usage

### Creating a Shell Application

```bash
seans-mfe-tool shell my-shell-app --port 3000
```

Options:

- `--port`: Port number for the shell application (default: 3000)
- `--remotes`: JSON string containing remote MFE configurations

### Creating a Remote MFE

```bash
seans-mfe-tool remote my-remote-app --port 3001 --mui-version 5.15.0
```

Options:

- `--port`: Port number for the remote MFE (default: 3001)
- `--mui-version`: Material UI version to use (default: 5.15.0)

### Initializing a Workspace

```bash
seans-mfe-tool init my-workspace --package-manager pnpm
```

Options:

- `--package-manager`: Package manager to use (npm, yarn, or pnpm)

## Project Structure

When creating a remote MFE, the following structure is generated:

```
my-remote-app/
├── public/
│   └── index.html
├── src/
│   ├── App.jsx
│   └── bootstrap.jsx
├── package.json
└── rspack.config.js
```

## Features of Remote MFEs

- RSpack-based build configuration
- Module Federation setup
- Material UI integration with configurable versions
- Version display component
- Theme support
- Development and production builds

## Configuration

### RSpack Configuration

The RSpack configuration includes:

- Module Federation setup
- Shared dependencies configuration
- Development server settings
- SWC loader for React

### Material UI Setup

- Configurable Material UI version
- Theme provider setup
- CSS baseline integration

## Development

```bash
# Start development server
npm start

# Create production build
npm run build

# Serve production build
npm run serve
```

## License

MIT
