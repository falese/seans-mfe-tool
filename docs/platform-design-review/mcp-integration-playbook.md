# MCP Integration Playbook

**Part of:** [Platform Design Review](./README.md) · DOCS-P2 (#221)
**Audience:** Agent platform operators and integrators wiring SMT into an MCP client.
**Grounding:** ADR-019 (MCP exposure), ADR-033 (two-headed-giant CLI), `src/mcp/tool-registry.ts`, `src/commands/mcp/serve.ts`. Output contract details: [Contract Alignment Pass](./contract-alignment-pass.md).

> **Model (ADR-033).** The same CLI a human runs is the interface an agent drives. MCP exposes each CLI command as a tool; each tool call spawns `seans-mfe-tool <cmd> --json` as a **child process** and parses the single-line envelope from stdout (CLAUDE.md "MCP child-process per tool call"). This isolates `process.exit` and cwd mutations and is concurrency-safe.

---

## 1. How tool federation works

`loadToolRegistry()` (`tool-registry.ts:32–61`) aggregates tools from **three sources**, run in parallel (`:39–43`):

1. **Local** — the CLI's own `schemas/`; tools prefixed `mfe:` (`:5`).
2. **Plugin** — installed oclif plugins that ship `schemas/`; prefixed by topic (`:6`).
3. **Remote** — servers listed in `~/.config/seans-mfe/mcp.json`; prefixed by name (`:7`).

Each tool is `{ name, description, inputSchema }` (`:20–24`). The `inputSchema` comes from the generated JSON schemas (`schemas/<topic>/<cmd>.json`) — so tool discovery is driven by the same schemas that validate the CLI (`npm run build:schemas`).

---

## 2. Collision behavior (fail loud)

After aggregating, the registry checks for duplicate tool names and **aborts startup** on any collision (`tool-registry.ts:47–58`):

```
SystemError: MCP tool name collision: "<name>" is registered by multiple
sources. Rename the conflicting tool or remove one of the sources.
```

**Why:** a silently shadowed tool is a correctness and security hazard — an agent could invoke a different implementation than intended. The platform refuses to start rather than hide it (exit 69, `SystemError`).

**Resolution playbook:**
1. Read the colliding `<name>` from the error.
2. Identify the two sources (local vs. plugin vs. a `mcp.json` remote).
3. Either remove/disable one source in `mcp.json`, or rename the conflicting tool in the owning plugin.
4. Restart the MCP server.

---

## 3. Tool name → CLI argv mapping

`buildArgv(toolName, input)` (`tool-registry.ts:71–95`) deterministically maps a tool call to CLI arguments:

- **Strip the source prefix** and join the rest as the command id (`:72–76`):
  - `mfe:deploy` → `deploy`
  - `mfe:bff:init` → `bff:init`
  - `daemon:start` → `daemon:start`
- **Positionals** `name` and `spec` are pushed as args (`:78–83`).
- **Booleans** become bare flags when true (`--flag`), omitted when false (`:84–85`).
- **Arrays** repeat the flag per value (`:87–89`); other scalars become `--key value` (`:90`).
- **`--json` is always appended** (`:95`) — guaranteeing the envelope contract.

So an agent never constructs CLI strings; it provides structured `input` and the registry produces a safe argv.

---

## 4. Setup: register a remote MCP source

Add to `~/.config/seans-mfe/mcp.json` (path is overridable via `RegistryOptions.remoteMcpConfigPath`, `tool-registry.ts:29`/`:37`):

```jsonc
{
  "servers": [
    { "name": "coder", "command": "coder", "args": ["mcp:serve"] }
    // tools from this source are prefixed "coder:"
  ]
}
```

Then start the server: `seans-mfe-tool mcp:serve` (see `src/commands/mcp/serve.ts`). On startup the registry loads all three sources and enforces §2.

---

## 5. What an agent can rely on (the contract)

Because every tool call runs `--json`, the agent gets the guarantees from the [Contract Alignment Pass](./contract-alignment-pass.md):

- **Exactly one** JSON line on stdout — the `CommandResult<T>` envelope (CA-2). All logs/progress are on stderr.
- Envelope shape is `{ ok, data?, error?, warnings, telemetry }` (CA-1) — **`ok`, not `success`**; `error.code` is the **numeric** exit code; `error.retryable`/`userFacing` guide retry decisions.
- Process exits with a **sysexits code** (CA-3): branch on it — `66 network`/`124 timeout` ⇒ retry; `64 validation` ⇒ fix input; `65 business`/`77 security` ⇒ do not blind-retry.

### Agent decision sketch

```
result = parse(stdout_line)          // one line, always
if result.ok: use result.data
else:
  switch exitCode:
    66, 124 -> retry with backoff
    64      -> repair input from result.error.message, retry
    65, 77  -> surface to human; do not retry
    69, 70  -> escalate (environment/unknown)
```

---

## 6. Compatibility & performance notes

- **Isolation cost:** one child process per tool call. This trades a small spawn cost for correctness (no shared `process.exit`/cwd). For chatty agents, prefer batching at the task level over many micro-calls.
- **Schema currency:** tool `inputSchema`s are generated. After changing any command's flags/args/return types, run `npm run build:schemas` or tools drift from the CLI (Gap G13).
- **Plugin tools:** any installed oclif plugin that ships `schemas/` is auto-federated under its topic prefix — no MCP-specific code needed in the plugin.
- **Discoverability gap:** an end-to-end MCP setup walkthrough is tracked as G09; this playbook is its first iteration.

---

*Normative sources: ADR-019, ADR-033, and the cited code. This playbook is operational guidance; where it summarizes the output contract, the [Contract Alignment Pass](./contract-alignment-pass.md) and `envelope.ts` are authoritative.*
