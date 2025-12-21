# Examples Catalog

This directory contains example projects demonstrating different features of the MFE toolset.

## Working Examples

### MFE Examples

#### `dsl-mfe/`
**Type**: Micro-Frontend with DSL manifest
**Generated**: Yes
**Purpose**: Demonstrates DSL-driven MFE generation with capabilities and lifecycle hooks

**Features**:
- Full DSL manifest (`mfe-manifest.yaml`)
- BFF server with GraphQL Mesh
- Module Federation configuration
- React components with Material-UI
- Docker deployment setup

**To Run**:
```bash
cd dsl-mfe
npm install
npm start
```

---

#### `e2e-mfe/`
**Type**: End-to-end MFE example
**Generated**: Yes
**Purpose**: Complete working MFE for testing full workflow

**To Run**:
```bash
cd e2e-mfe
npm install
npm start
```

---

### API Examples

#### `bizcase-api/`
**Type**: REST API generated from OpenAPI spec
**Database**: MongoDB or SQLite
**Purpose**: Business case analysis API with CRUD operations

**OpenAPI Spec**: See `cost-benefit-api.yaml` in root examples/

**To Run**:
```bash
cd bizcase-api
npm install
npm start
```

---

#### `petstore-api/`
**Type**: REST API generated from OpenAPI spec
**Database**: MongoDB or SQLite
**Purpose**: Classic PetStore API example

**OpenAPI Spec**: See `petstore.yaml` in root examples/

**To Run**:
```bash
cd petstore-api
npm install
npm start
```

---

## Specification Files

Located in `examples/` root:

- **`cost-benefit-api.yaml`** - OpenAPI spec for cost-benefit analysis API
- **`petstore.yaml`** - OpenAPI spec for PetStore API
- **`benefit-model.yml`** - Data model for benefit analysis
- **`postman.json`** - Postman collection for API testing

---

## Archived Examples

Examples that are experimental or work-in-progress have been moved to `archive/experiments/`:

- `e2e2/` - Second e2e experiment
- `e2e2e/` - Third e2e experiment

These may contain incomplete features or testing experiments.

---

## Generating New Examples

### Generate a new MFE:
```bash
mfe remote:generate my-mfe
```

### Generate a new API:
```bash
mfe api my-api --spec ./my-spec.yaml --database sqlite
```

### Generate a BFF server:
```bash
mfe bff:init my-bff
```

---

## Example Status

| Example | Type | Status | Last Verified |
|---------|------|--------|---------------|
| dsl-mfe | MFE | ✅ Should work | 2025-12-20 |
| e2e-mfe | MFE | ✅ Should work | 2025-12-20 |
| bizcase-api | API | ⚠️ Needs testing | Unknown |
| petstore-api | API | ⚠️ Needs testing | Unknown |

**Note**: Examples marked "Should work" have been generated successfully but not runtime-tested in this audit.

---

## Testing Examples

To verify examples work:

1. Navigate to example directory
2. Install dependencies: `npm install`
3. Run tests (if available): `npm test`
4. Start the application: `npm start` or `npm run dev`
5. Verify it loads without errors

If you find broken examples, please:
- Update this README with status
- Move to `archive/experiments/` if abandoned
- Fix or delete if unmaintainable

---

**Last Updated**: 2025-12-20
