# Examples Catalog

## MFE Examples

### `dsl-mfe/`
The canonical TypeScript MFE — full `mfe-manifest.yaml`, GraphQL Mesh BFF, Module Federation, React + Material-UI, Docker.

```bash
cd dsl-mfe && npm install && npm start
```

### `polyglot-stubs/`
Teaching stubs showing the same 9-capability platform contract in Python, Go, and Rust. Start here if you want to implement an MFE in a non-JS language.

| Directory | Language | Server |
|-----------|----------|--------|
| `polyglot-stubs/python/` | Python | Flask |
| `polyglot-stubs/go/` | Go | net/http |
| `polyglot-stubs/rust/` | Rust | axum |

---

## API Codegen Examples (`api-examples/`)

Outputs from the `seans-mfe-tool create-api` command — demonstrate REST API generation from OpenAPI specs.

| Directory | Purpose | OpenAPI Spec |
|-----------|---------|--------------|
| `api-examples/bizcase-api/` | Business case analysis CRUD | `api-examples/cost-benefit-api.yaml` |
| `api-examples/petstore-api/` | Classic PetStore CRUD | `api-examples/petstore.yaml` |

Postman collection and benefit data model are also in `api-examples/`.

```bash
cd api-examples/bizcase-api && npm install && npm start
```

---

## Archived (`archive/`)

| Path | What it is |
|------|-----------|
| `archive/experiments/e2e-mfe/` | Earlier iteration of `dsl-mfe/` — superseded |
| `archive/experiments/e2e2/` | Second e2e experiment |
| `archive/experiments/e2e2e/` | Third e2e experiment |
| `archive/requirements-elicitation-agent/` | Standalone AI requirements agent (not integrated) |
