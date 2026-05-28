# Examples Catalog

## MFE Examples

### `abc-kids/`
The canonical end-to-end example: a shell composing three generated MFEs. Each
MFE has its own `mfe-manifest.yaml`, rspack Module Federation config, Dockerfile,
and `nginx.conf`; the shell stitches them together.

| Path | What it is |
|------|-----------|
| `abc-kids/shell/` | Host shell that composes the remotes |
| `abc-kids/flappy/` | Generated remote MFE |
| `abc-kids/hockey/` | Generated remote MFE |
| `abc-kids/multiplication-quiz/` | Generated remote MFE |

```bash
# Build the CLI image + every abc-kids MFE image (cached by Turborepo)
turbo run docker:build:examples

# Or bring the whole compose stack up
docker compose -f examples/abc-kids/docker-compose.yaml up --build
```

---

## API Codegen Examples (`api-examples/`)

Outputs from the `seans-mfe-tool api` command — REST API generation from OpenAPI specs.

| Directory | Purpose | OpenAPI Spec |
|-----------|---------|--------------|
| `api-examples/bizcase-api/` | Business case analysis CRUD | `api-examples/cost-benefit-api.yaml` |
| `api-examples/petstore-api/` | Classic PetStore CRUD | `api-examples/petstore.yaml` |

A Postman collection and the benefit data model also live in `api-examples/`.

```bash
cd api-examples/bizcase-api && npm install && npm start
```

---

## Archived (`archive/`)

Kept for history, **not maintained** — paths and the platform contract may be
out of date.

| Path | What it is |
|------|-----------|
| `archive/dsl-mfe/` | Former canonical TypeScript MFE (React + Material-UI + GraphQL Mesh BFF) — superseded by `abc-kids/` |
| `archive/polyglot-stubs/` | Teaching stubs of the platform contract in Python / Go / Rust |
| `archive/plugin-skeleton/` | Earlier plugin starter |
| `archive/new-mfe/` | Scratch scaffold |
| `archive/experiments/` | Earlier e2e iterations |
| `archive/requirements-elicitation-agent/` | Standalone AI requirements agent (not integrated) |
