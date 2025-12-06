# .meshrc.yaml Configuration Issues - Diagnosis

## Date: 2025-12-06

## Summary
The `.meshrc.yaml` file has syntax errors due to invalid property names and usage of transforms/plugins that don't exist or aren't installed in GraphQL Mesh v0.100.x.

## Validation Error Output
```
[2025-12-06T19:18:17.232Z] WARN  [config] :5:166m Configuration file is not valid! 
[2025-12-06T19:18:18.266Z] ERROR  Error: Unable to find transform matching namingConvention
```

## Root Causes

### 1. **Invalid Transform: `namingConvention`**
**Error:** `Unable to find transform matching namingConvention`

**Issue:** The `namingConvention` transform does not exist in GraphQL Mesh v0.100.x. This transform was added in later versions or might be part of a different package.

**Current Code (Lines 40-43):**
```yaml
transforms:
  - namingConvention:
      typeNames: PascalCase
      fieldNames: camelCase
```

**Available Transforms in Mesh v0.100.x:**
- `filterSchema` - Filter types/fields from schema
- `rename` - Rename types/fields
- `prefix` - Add prefix to types
- `encapsulate` - Wrap schema in a single field
- `replace-field` - Replace field implementation

**Solution:** Remove `namingConvention` transform or use `rename` transform to achieve similar results.

---

### 2. **Invalid Plugin: `responseCache`**
**Issue:** The `responseCache` plugin configuration is incorrect. In Mesh v0.100.x, caching is configured differently.

**Current Code (Lines 23-26):**
```yaml
plugins:
  - responseCache:
      ttl: 300000
      invalidate:
        ttl: 0
```

**Issue:** This uses Envelop plugin syntax directly, but Mesh v0.100.x requires the `@envelop/response-cache` package and different configuration.

**Solution:** Use proper Mesh cache configuration or remove if using built-in caching.

---

### 3. **Invalid Plugin: `prometheus`**
**Issue:** The `prometheus` plugin is not a built-in Mesh plugin in v0.100.x.

**Current Code (Lines 27-33):**
```yaml
  - prometheus:
      port: 9090
      endpoint: /metrics
      labels:
        service: csv-analyzer
        version: 1.0.0
        environment: ${NODE_ENV:-development}
```

**Solution:** 
- Requires `@envelop/prometheus` package to be installed
- Or implement custom Prometheus metrics in server.ts instead

---

### 4. **Invalid Plugin: `opentelemetry`**
**Issue:** The `opentelemetry` plugin is not a built-in Mesh plugin in v0.100.x.

**Current Code (Lines 34-38):**
```yaml
  - opentelemetry:
      serviceName: csv-analyzer-bff
      sampling:
        probability: 0.1
```

**Solution:** Requires `@envelop/opentelemetry` or manual OpenTelemetry integration.

---

### 5. **Invalid Transform: `rateLimit`**
**Issue:** `rateLimit` is not a transform in Mesh. It would be a plugin if available.

**Current Code (Lines 44-45):**
```yaml
transforms:
  - rateLimit:
      config: [...]
```

**Solution:** 
- Move to plugins section if using `@envelop/rate-limiter`
- Or implement in custom server middleware

---

### 6. **Correct Transform: `filterSchema`** ✓
**Status:** This transform IS valid and properly configured.

**Current Code (Lines 46-47):**
```yaml
  - filterSchema:
      filters: ["Query.!internal*","Mutation.!admin*","Type.!_internal*","Type.!_metadata"]
```

**Note:** This is correctly configured.

---

### 7. **Correct Transform: `resolversComposition`** ✓
**Status:** This transform IS valid but needs to be verified.

**Current Code (Lines 48-62):**
```yaml
  - resolversComposition:
      resolver: Mutation.addPet
      composer: ./src/platform/bff/composers/auth-check#authCheck
```

**Issue:** The composer files need to exist at the specified paths. Check if:
- `./src/platform/bff/composers/auth-check.ts` exists with exported `authCheck` function
- `./src/platform/bff/composers/audit-log.ts` exists with exported `auditLog` function
- `./src/platform/bff/composers/rate-limit.ts` exists with exported `rateLimitExpensive` function
- `./src/platform/bff/composers/data-mask.ts` exists with exported `maskSensitiveData` function

---

## Package Installation Issues

The following packages are NOT installed but are referenced or needed:

### Missing Envelop Plugins
```bash
@envelop/response-cache    # For responseCache plugin
@envelop/prometheus        # For prometheus plugin
@envelop/opentelemetry     # For opentelemetry plugin
@envelop/rate-limiter      # For rate limiting
```

### Currently Installed (from node_modules)
```
@envelop/disable-introspection
@envelop/generic-auth
@envelop/on-resolve
@envelop/response-cache  # Actually IS installed!
```

---

## Recommended Fixes

### Option 1: Minimal Fix (Remove Unsupported Features)
Remove all unsupported transforms and plugins, keeping only what works in Mesh v0.100.x:

```yaml
# Plugins - REMOVE ALL (configure in server.ts instead)
# plugins: []

# Transforms - Keep only supported ones
transforms:
  - filterSchema:
      filters: 
        - "Query.!internal*"
        - "Mutation.!admin*"
        - "Type.!_internal*"
        - "Type.!_metadata"
  - resolversComposition:
      resolver: "Mutation.addPet"
      composer: ./src/platform/bff/composers/auth-check#authCheck
  # ... (keep other resolversComposition entries)
```

### Option 2: Upgrade Mesh to v1.x or v2.x
Upgrade to latest Mesh version that supports these features:
- Requires major refactoring
- May have breaking changes
- Benefits: Access to all modern features

### Option 3: Implement Features in Server Layer
Move observability and performance features to Express server:
- Prometheus metrics in `server.ts`
- Response caching via middleware
- Rate limiting via `express-rate-limit`
- OpenTelemetry via `@opentelemetry/api`

---

## Immediate Action Items

1. **Remove `namingConvention` transform** - Not available in v0.100.x
2. **Remove or fix `plugins` section** - Current syntax incompatible
3. **Verify composer files exist** - Check all `./src/platform/bff/composers/` paths
4. **Test configuration** - Run `npm run mesh:validate` after each fix
5. **Update templates** - Fix unified-generator.ts to generate valid config

---

## Impact on Templates

The following template files need updates:

### 1. `src/templates/mfe-bff-full/.meshrc.yaml.ejs`
- Remove unsupported transforms
- Remove/fix plugins section
- Keep only `filterSchema` and `resolversComposition`

### 2. `src/commands/unified-generator.ts`
- Update `generateMeshConfig()` function
- Remove generation of unsupported features
- Add validation step

### 3. `docs/mfe-manifest-schema.md`
- Update documentation to reflect supported features
- Mark unsupported features clearly
- Add version compatibility notes

---

## Testing Checklist

After fixes:
- [ ] `npm run mesh:validate` passes without errors
- [ ] `npm run bff:dev` starts without errors
- [ ] GraphQL endpoint responds at `/graphql`
- [ ] Playground loads at `/graphql`
- [ ] Composer functions work correctly
- [ ] filterSchema removes internal fields
- [ ] No TypeScript compilation errors

---

## Next Steps

1. **Immediate**: Remove invalid configurations from `.meshrc.yaml`
2. **Short-term**: Update templates to generate valid configs
3. **Long-term**: Decide on Option 1, 2, or 3 for advanced features
4. **Documentation**: Update ADR-062 with actual supported features
