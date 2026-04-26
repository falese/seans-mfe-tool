---
id: "0068"
title: "shell:init oclif command with daemon/registry port flags and dry-run"
status: Accepted
date: 2026-04-26
deciders: [falese]
enforcement: review-only
supersedes: []
superseded-by: []
tags: [cli, shell, oclif, codegen]
summary: "Implement shell:init as an oclif command that accepts --port, --daemon-port, --registry-port, --dry-run, --force, and --skip-install flags and returns a typed ShellInitResult."
rationale-summary: "A dedicated oclif command with explicit port flags gives each control-plane tier an independent port binding, --dry-run enables safe preview, and the typed result integrates with the JSON envelope (--json) so agents and CI can parse output programmatically."
long-form: true
enforcer-config: {}
---

# ADR-0068: `shell:init` oclif command with daemon/registry port flags and dry-run

## Context

`mfe shell` was described in ADR-020 as the explicit command for generating a host application, but no concrete command signature existed. The daemon-native control plane (ADR-069) added a second and third port binding beyond the shell's own HTTP port, requiring independent flag names. Agents and CI pipelines also need a machine-readable result to verify generation without parsing human-readable console output.

## Decision

### Command signature

```
seans-mfe-tool shell:init <name> [flags]

Flags:
  -p, --port <n>           Shell app HTTP port (default 3000)
      --daemon-port <n>    ShellDaemon GraphQL-WS port (default 3001)
      --registry-port <n>  MFERegistry GraphQL-WS port (default 4000)
  -d, --dry-run            Print planned changes; write nothing
  -f, --force              Overwrite existing directory
      --skip-install       Skip npm install after generation
      --json               Emit CommandResult<ShellInitResult> envelope to stdout
```

### Typed result

```typescript
interface ShellInitResult extends MutatingResult {
  name: string;
  port: number;
  daemonPort: number;
  registryPort: number;
  targetDir: string;
  generatedFiles: string[];   // relative paths, only populated when dryRun=false
}
```

`MutatingResult.dryRun` is `true` during a dry run; `plannedChanges` lists every `create` operation that _would_ have occurred.

### Implementation pattern

The command separates the business function (`shellInitCommand`) from the oclif class (`ShellInit extends BaseCommand<ShellInitResult>`). `runCommand()` delegates to the function; `BaseCommand.run()` wraps the return value in `CommandResult<T>` for `--json` consumers. Errors are thrown as `BusinessError` (directory exists, exit 65) or `SystemError` (template dir missing, exit 69) so the JSON envelope carries structured error codes.

## Consequences

### Positive
- Each control-plane tier's port is independently configurable without string splitting.
- `--dry-run` flag enables CI preview gates and agent planning loops before any files are written.
- Typed result lets the MCP server and test suite assert on `daemonPort`/`registryPort` without screen-scraping.

### Negative
- Three port flags increase surface area; documentation must clearly explain which tier each port belongs to.
- Default ports (3000 / 3001 / 4000) may conflict with other local services; operators must override explicitly.

## Related

- ADR-069: four-tier daemon-native control plane (defines what `shell:init` generates)
- ADR-020: `init` = workspace only; `shell` = explicit host generation
- `src/commands/shell/init.ts`
- `src/oclif/results.ts` (`ShellInitResult`)
