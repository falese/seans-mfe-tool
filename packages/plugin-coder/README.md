# @seans-mfe/plugin-coder

The **first-party in-repo coder seam** (ADR-088). It holds the coder-facing
surface of the generative software system (PDR-009):

- the **`coder:compile`** oclif command (extends `BaseCommand`, AI-native
  profile — `--json`, typed errors, `CommandResult`);
- the **intent-compilation contract** (`IntentCompileRequest` → `CandidateManifest`,
  ADR-085 §1);
- the **DSL eval oracle** (`validateManifestText`), which imports `@seans-mfe/dsl`
  directly — the coupling ADR-088 exists to resolve.

> ADR-088 §1 names this package `@seans-mfe/coder-plugin`; it landed as
> `@seans-mfe/plugin-coder` to match the repo's `@seans-mfe/plugin-*` convention
> (`plugin-bff`, `plugin-api`, `plugin-adr`), which post-dates the ADR.

The model, training, serving, and adaptors stay the **external** `@falese/coder`
Bun + MLX service, invoked **out-of-process** (subprocess `coder generate` or a
local `coder serve` SSE endpoint, ADR-019/ADR-085). **No model, weights, MLX, or
Python enters this package or the repo's CI.**

## Usage

```sh
# Subprocess transport (default): shells out to `coder generate`
seans-mfe-tool coder:compile "A kids game MFE that mixes two paints to hit a target color" \
  --adaptor intent-manifest --system prompts/system.md --out mfe-manifest.yaml

# Serve transport: POST to a running `coder serve`
seans-mfe-tool coder:compile "..." --endpoint http://localhost:3991 --json
```

The command **fails closed** (ADR-084): an invalid manifest is a `ValidationError`
and no file is written. Pass `--allow-invalid` to inspect a rejected candidate.

## Where it fits

`intent → coder (external) → candidate manifest → DSL oracle → mfe-manifest.yaml`,
which the existing deterministic pipeline
(`parseAndValidateDirectory` → `remote:generate`) carries the rest of the way.
The stochastic model authors only the manifest; every downstream byte stays
deterministic and drift-gated (ADR-084/ADR-087).

The `intent-manifest` adaptor whose eval suite calls this oracle is tracked in
**#364** (`docs/coder-intent-manifest-adaptor-spec.md`).
