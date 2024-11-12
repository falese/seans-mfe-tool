# Quick Start Deployment Guide

## Development Environment in 5 Minutes

1. **Create Applications**
```bash
# Create a new directory for your project
mkdir my-mfe-project && cd my-mfe-project

# Create shell and remote
npx seans-mfe-tool shell my-shell --port 3000
npx seans-mfe-tool remote my-remote --port 3001
```

2. **Deploy Everything**
```bash
# Deploy remote first
cd my-remote
npx seans-mfe-tool deploy my-remote --type remote --env development --port 8081

# Deploy shell
cd ../my-shell
npx seans-mfe-tool deploy my-shell --type shell --env development --port 8080
```

3. **Access Your Applications**
- Shell: http://localhost:8080
- Remote: http://localhost:8081

4. **Stop Everything**
```bash
docker stop my-shell-development my-remote-development
```
