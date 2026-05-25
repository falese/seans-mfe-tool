# seans-mfe-tool — Session Prompt

> Update this file before each coding session. Hand it to the agent alongside CLAUDE.md.
> Keep CLAUDE.md open in every session. Reference @docs/spec.md only for sections relevant
> to the active issue.

---

## Session: 2026-05-24

### Active issue(s)

**[#177](https://github.com/falese/seans-mfe-tool/issues/177) — `build:docker` command (Phase 3, ADR-071)**

### Scope

Implement `build:docker` oclif command. Calls `plugin.getDockerStrategy(manifest)` and
emits a multi-stage Dockerfile. Optionally runs `docker build` when `--build` is passed.

The command:
1. Resolves framework from `--framework` flag or auto-detected `mfe-manifest.yaml`
2. Loads the plugin via `loadFrameworkPlugin()`
3. Calls `plugin.getDockerStrategy(manifest)` → `DockerStrategy`
4. Generates Dockerfile content from the strategy fields
5. Writes to `--output` path (default: `./Dockerfile.generated`)
6. If `--build` is passed: runs `docker build -t <tag> <cwd>`
7. Returns `BuildDockerResult` under `--json`

NOT changing: existing `deploy.ts` Docker logic, template files, any other commands.

**Acceptance criteria:**
- Dockerfile is generated from `DockerStrategy` fields (builderImage, runtimeImage,
  buildCommands, artifactPaths, cmd, needsCliBuilder, healthcheck)
- `needsCliBuilder: true` → emits `FROM seans-mfe-tool-cli:latest AS cli-builder` stage
- `--build` flag triggers `docker build -t <tag> .` in the cwd
- `--json` returns `BuildDockerResult` envelope
- Tests pass (TDD: tests written first)
- `npm test`, `npm run build` green

### ADR check

| ADR | Title | Governs |
|-----|-------|---------|
| ADR-071 | Framework plugins — abstract BaseFrameworkPlugin | `build:docker` calls `plugin.getDockerStrategy()` polymorphically |

### Spec context

`DockerStrategy` interface (`packages/contracts/src/framework-plugin.ts:34`):
```ts
interface DockerStrategy {
  builderImage: string;    // e.g. 'node:20-slim'
  runtimeImage: string;    // e.g. 'nginx:alpine'
  buildCommands: string[]; // e.g. ['npm ci', 'npm run build']
  artifactPaths: string[]; // e.g. ['dist/']
  cmd: string[];           // e.g. ['nginx', '-g', 'daemon off;']
  needsCliBuilder: boolean;
  healthcheck?: string;    // e.g. 'wget -qO- http://127.0.0.1:80/ || exit 1'
}
```

React plugin: `needsCliBuilder: false`, builderImage `node:20-slim`, runtimeImage `nginx:alpine`
Angular plugin: `needsCliBuilder: true`, same images

Generated Dockerfile structure:
```dockerfile
# (if needsCliBuilder)
FROM seans-mfe-tool-cli:latest AS cli-builder

FROM <builderImage> AS builder
WORKDIR /app
# (if needsCliBuilder) -- COPY + RUN cli-builder wiring
COPY . .
RUN <buildCommands[0]>
RUN <buildCommands[1]>
...

FROM <runtimeImage>
COPY --from=builder /app/<artifactPaths[0]> /usr/share/nginx/html/
HEALTHCHECK CMD <healthcheck>    # (if present)
CMD [<cmd>]
```

### Current file tree

```
src/commands/build/docker.ts                     ← CREATE
src/commands/build/__tests__/docker.test.ts      ← CREATE
src/oclif/results.ts                             ← MODIFY (add BuildDockerResult)
session-prompt.md                                ← UPDATED (this file)
```

### TDD order

1. Write `docker.test.ts` — failing tests
2. Add `BuildDockerResult` to `src/oclif/results.ts`
3. Implement `src/commands/build/docker.ts`
4. All tests pass

### Existing patterns to follow

- `src/commands/build/prod.ts` — non-blocking command with structured result
- `src/commands/build/dev.ts` — manifest resolution + plugin loading
- `src/commands/build/__tests__/prod.test.ts` — mock plugin + pre-resolved options
