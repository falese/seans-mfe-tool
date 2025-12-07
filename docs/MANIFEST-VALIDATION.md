# Manifest Validation Strategy

**Status**: Implemented (Option 3: Auto-Classification)  
**Date**: 2025-12-07  
**Related**: ADR-062, ADR-048

## Overview

We've implemented **Option 3: Auto-Classification with Override** for manifest validation to prevent misclassification of GraphQL Mesh plugins vs transforms (e.g., `rateLimit` incorrectly placed in transforms section).

## Architecture

### Two Validators (Intentional Duplication)

1. **`src/utils/manifestValidator.js`** (JavaScript)
   - Used by CLI commands for pre-generation validation
   - Provides dependency resolution (maps plugin names → npm packages)
   - Pretty-printed error messages with chalk
   - Returns structured `{valid, errors, warnings}`

2. **`src/codegen/UnifiedGenerator/unified-generator.ts`** (TypeScript)
   - Integrated into code generation pipeline
   - Called at start of `generateAllFiles()` to block bad generation
   - Uses Sets for O(1) lookup performance
   - Throws on fatal errors to prevent invalid .meshrc.yaml

### Why Two Validators?

Per ADR-048 (incremental TypeScript migration), we maintain both:
- **JavaScript version**: CLI utilities still in JS, need immediate validation
- **TypeScript version**: Code generation requires compile-time type safety
- **Strategy**: Keep lists synchronized until migration completes

## Validation Rules

### Known Plugins (13 total)
Source: `@graphql-mesh/plugin-*` packages

```
responseCache, prometheus, opentelemetry, newrelic, statsd,
liveQuery, defer-stream, meshHttp, snapshot, mock,
operationFieldPermissions, jwtAuth, hmac
```

### Known Transforms (15 total)
Source: `@graphql-mesh/transform-*` packages

```
namingConvention, rateLimit, filterSchema, resolversComposition,
cache, prefix, rename, encapsulate, federation, extend,
replace, typeMerging, mock, bare, type-merging
```

## Behavior

### Error (Blocks Generation)
- Plugin in `transforms` section → Error: "Move to plugins section"
- Transform in `plugins` section → Error: "Move to transforms section"
- **Result**: Throws exception, prevents code generation

### Warning (Non-Fatal)
- Unknown plugin name → Warning: "Ensure it's a valid @graphql-mesh/plugin-* package"
- Unknown transform name → Warning: "Ensure it's a valid @graphql-mesh/transform-* package"
- **Result**: Logs warning, continues generation

### Success
- All plugins/transforms correctly classified
- Logs: `✅ Manifest validation passed: X plugin(s), Y transform(s)`

## Usage

### In CLI Commands (Pre-Generation)
```javascript
const { validateManifest, printValidationResults } = require('./utils/manifestValidator');

const result = validateManifest(manifest);
printValidationResults(result, 'mfe-manifest.yaml');

if (!result.valid) {
  process.exit(1);
}
```

### In Code Generation (Runtime)
```typescript
import { validateManifestConfiguration } from './unified-generator';

// Throws if validation fails
validateManifestConfiguration(manifest);

// Continue with generation...
```

## Maintenance

### Adding New Plugins/Transforms

**CRITICAL**: Update both files simultaneously:

1. **`src/codegen/UnifiedGenerator/unified-generator.ts`**
   ```typescript
   export const KNOWN_MESH_PLUGINS = new Set([
     // ... existing
     'newPluginName',  // ADD HERE
   ]);
   ```

2. **`src/utils/manifestValidator.js`**
   ```javascript
   const KNOWN_PLUGINS = [
     // ... existing
     'newPluginName',  // ADD HERE
   ];
   ```

### Sync Check Script
```bash
# TODO: Add pre-commit hook to verify sync
npm run validate:sync
```

## Example: Correct Manifest Structure

```yaml
name: my-mfe
version: 1.0.0

# Plugins: Cross-cutting concerns (caching, observability, rate limiting)
plugins:
  - responseCache:
      ttl: 300000
  - prometheus: {}
  - rateLimit:  # ✅ CORRECT: Plugin, not transform
      config:
        - type: Query
          field: "search"
          max: 10
          ttl: 60000

# Transforms: Schema manipulation (naming, filtering, composition)
transforms:
  - namingConvention:
      typeNames: PascalCase
      fieldNames: camelCase
  - filterSchema:
      filters:
        - Query.!internal*
```

## Migration Path (Future)

When TypeScript migration completes (ADR-048):

1. Convert `manifestValidator.js` → `manifestValidator.ts`
2. Extract shared constants to `src/codegen/constants.ts`
3. Import constants in both validators (DRY)
4. Update CLI commands to use TypeScript validator
5. Remove JavaScript version

## Benefits

✅ **Lightweight**: Validation only, no generation logic changes  
✅ **Extensible**: Easy to add new plugins/transforms  
✅ **User-friendly**: Clear error messages guide users  
✅ **Non-breaking**: Warnings don't block generation  
✅ **Maintainable**: Clear sync strategy documented

## Related Files

- `src/codegen/UnifiedGenerator/unified-generator.ts` (lines 154-350)
- `src/utils/manifestValidator.js` (complete file)
- `src/codegen/templates/bff/meshrc.yaml.ejs` (uses validated config)
- `src/codegen/templates/bff/mfe-manifest.yaml.ejs` (manifest template)

## Testing

```bash
# Run unified-generator tests
npm test -- unified-generator

# Manual test: Try misclassified plugin
echo "transforms:
  - rateLimit: {}" > test-manifest.yaml
mfe remote test-mfe --manifest test-manifest.yaml
# Should error: "rateLimit is a plugin, not a transform"
```
