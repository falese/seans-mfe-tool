# Module Federation CLI Tool

A CLI tool for creating and managing Module Federation applications with React and MUI.

## Features

- Create shell (container) applications
- Create remote MFEs
- Deploy applications to development and production environments
- Native rspack support for Module Federation

## Commands

### Create Shell Application

```bash
npx seans-mfe-tool shell my-shell-app --port 3000
```

### Create Remote MFE

```bash
npx seans-mfe-tool remote my-remote-app --port 3001 --mui-version 5.15.0
```

### Deploy Applications

#### Development Deployment

```bash
# Deploy shell application
npx seans-mfe-tool deploy my-shell-app --type shell --env development --port 8080

# Deploy remote MFE
npx seans-mfe-tool deploy my-remote-app --type remote --env development --port 8081
```

#### Production Deployment

```bash
# Deploy to production (requires Docker registry)
npx seans-mfe-tool deploy my-app --type shell --env production --registry registry.example.com
```

## Docker Deployment

The tool supports Docker-based deployment for both development and production environments:

### Development

- Builds the application and creates a Docker image
- Runs the container locally with port mapping
- Supports hot reloading and development features

### Production

- Optimized multi-stage Docker builds
- Pushes images to specified registry
- Nginx-based serving with optimized configuration
- CORS support for Module Federation
- Static asset caching
- Security headers

## Requirements

- Node.js 18 or higher
- Docker
- npm or pnpm
