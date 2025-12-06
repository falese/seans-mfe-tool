# E2E2 Dependency Resolution Plan

**STATUS: ✅ COMPLETED - All issues resolved**

See [TEST-RESULTS.md](./TEST-RESULTS.md) for detailed test results and verification.

## Problem Analysis

### Current Issues
1. **GraphQL Mesh v1 doesn't exist**: Package.json specifies `^1.0.0` but only `0.100.x` stable versions exist
2. **Missing dependencies**: All packages show as UNMET (npm install not completed)
3. **Previous build errors**: 
   - Missing GraphQL internal modules
   - Missing Mesh legacy types
   - TypeScript type errors with Request/CfProperties

### Root Causes
1. **Version mismatch**: Specified v1.x but v1 is only alpha (last alpha: July 2024)
2. **Missing peer dependencies**: GraphQL Mesh requires companion packages
3. **TypeScript config**: NodeNext resolution may conflict with generated mesh code
4. **Mixed concerns**: Frontend (React/MFE) + Backend (BFF/Mesh) in one package

## Solution Plan

### Phase 1: Fix Core Dependencies (GraphQL Mesh)

**Action**: Switch to latest stable GraphQL Mesh v0.100.x

```json
"@graphql-mesh/cli": "^0.100.21",
"@graphql-mesh/compose-cli": "^0.100.21",
"@graphql-mesh/openapi": "^0.109.26",
"@graphql-mesh/serve-cli": "^0.10.44",
"@graphql-mesh/serve-runtime": "^1.0.5",
```

**Rationale**: 
- v0.100.21 is latest stable CLI (released Dec 2024)
- v0.109.26 is latest OpenAPI handler (actively maintained)
- serve-cli/serve-runtime have different versioning scheme

### Phase 2: Add Missing Peer Dependencies

**Required additions**:
```json
"@graphql-mesh/types": "^0.100.21",
"@graphql-mesh/utils": "^0.100.21",
"@graphql-tools/utils": "^10.5.7",
"@graphql-tools/delegate": "^10.2.4",
"@graphql-tools/wrap": "^10.0.5"
```

**Rationale**: These are peer dependencies needed by handlers and plugins

### Phase 3: Fix TypeScript Configuration

**Changes to tsconfig.json**:
1. Add `"skipLibCheck": true` (already present ✓)
2. Change module resolution for mesh compatibility:
   ```json
   "moduleResolution": "node" // Instead of "NodeNext"
   ```
3. Add mesh output to exclusions (already present ✓)

### Phase 4: Separate Frontend/Backend Type Dependencies

**Issue**: Mixing @types/node (backend) with browser code can cause conflicts

**Solution**: Create tsconfig for frontend separately or use proper paths

### Phase 5: Update Module Federation Dependencies

**Current**: `@module-federation/enhanced-rspack: ^0.1.1`
**Latest**: Check for updates to 0.5.x or 0.6.x range

### Phase 6: Lock React Versions

**Current**: `react@^18.2.0`
**Better**: Use exact or tight range for singleton compatibility
```json
"react": "~18.2.0",
"react-dom": "~18.2.0"
```

## Implementation Steps

### Step 1: Clean State
```bash
rm -rf node_modules package-lock.json
```

### Step 2: Update package.json
Apply all dependency version fixes from phases above

### Step 3: Install Dependencies
```bash
npm install
```

### Step 4: Verify Mesh Build
```bash
npm run bff:build
```

### Step 5: Verify Frontend Build
```bash
npm run build
```

### Step 6: Test Runtime
```bash
npm start
```

## Testing Checklist

- [ ] `npm install` completes without errors
- [ ] `npm run bff:build` generates .mesh directory
- [ ] `.mesh` contains gateway.ts and other generated files
- [ ] `rspack build` completes without errors
- [ ] `npm start` runs both servers concurrently
- [ ] Frontend accessible at http://localhost:3002
- [ ] BFF accessible at http://localhost:4000 (or configured port)
- [ ] GraphQL playground works
- [ ] Module Federation remote entry loads

## Dependency Categories

### Frontend (React/MFE)
- React, React-DOM (UI framework)
- @mui/material, @emotion/* (UI components)
- @module-federation/enhanced-rspack (Module Federation)
- @rspack/* (Build tool)

### Backend (BFF/GraphQL)
- @graphql-mesh/* (GraphQL gateway)
- express, cors, helmet (HTTP server)
- graphql (GraphQL engine)
- ts-node (TypeScript execution)

### Build/Dev Tools
- TypeScript (type checking)
- concurrently (run multiple processes)
- serve (static file server)

### Browser Polyfills (for rspack)
- buffer, crypto-browserify, stream-browserify, etc.
- Required for Node.js APIs in browser

## Success Criteria

1. ✅ Clean npm install with no peer dependency warnings
2. ✅ Mesh build generates valid GraphQL schema
3. ✅ Frontend build produces dist/remoteEntry.js
4. ✅ Both servers start without crashes
5. ✅ No TypeScript compilation errors
6. ✅ GraphQL queries work through BFF
7. ✅ MFE loads in shell application

## Rollback Plan

If issues persist:
1. Revert to known working Mesh version (e.g., 0.95.x)
2. Consider splitting into separate packages (frontend + backend)
3. Use Mesh serve CLI instead of custom Express server
