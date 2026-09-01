# plugin-skeleton — a starter oclif plugin for `seans-mfe-tool`

Copy this directory, rename it, and replace the `greet` topic with your own.
The authoritative rules are in [`docs/PLUGIN-CONTRACT.md`](../../docs/PLUGIN-CONTRACT.md);
this is the smallest thing that satisfies them.

## What to change

| File | Change |
|---|---|
| `package.json` | `name` (`@you/your-plugin`), `description`, and `oclif.topics` — one entry per topic your commands live under |
| `src/commands/greet/hello.ts` | Rename the directory to your topic and the file to your command. `greet:hello` comes from the path `commands/greet/hello.ts` — there is no separate registration |
| `src/index.ts` | Re-export whatever your plugin exposes as a library, if anything |

## The four rules that matter

Every one of them exists because breaking it breaks an automated caller — the
MCP server, CI, or an agent — rather than a person:

1. **Extend `BaseCommand<T>`, implement `runCommand()`, never override `run()`.**
   `run()` emits the envelope, maps typed errors to exit codes, and opens the
   telemetry span (ADR-016).
2. **Return a typed result.** Under `--json` it is emitted as exactly one
   `CommandResult<T>` line on stdout (ADR-018).
3. **Throw typed errors** from `@seans-mfe/contracts` — `ValidationError`,
   `BusinessError`, `NetworkError`, `SystemError`, `TimeoutError`,
   `SecurityError`. Never `throw new Error()` (ADR-017).
4. **Never call `process.exit()`.** It bypasses envelope emission.

## Try it

This directory is a workspace member, so `npm install` at the repo root already
installed its dependencies — and, more importantly, hoisted a single copy of
`@oclif/core`. Installing inside this directory instead gives you a *second*
copy, and the two are different types to TypeScript: you get a wall of
`Type 'Command.Class' is not assignable to type 'Command.Class'`. If you copy
this plugin out of the repo, install normally; inside the repo, don't.

```bash
# Build (from this directory):
npm run build

# Link and run (from the repo root):
node bin/run.js plugins:link ./examples/plugin-skeleton
node bin/run.js greet:hello --name world
node bin/run.js greet:hello --name world --json
node bin/run.js plugins:uninstall @falese/plugin-skeleton
```

Note the colon: topics are `plugins:link`, not `plugins link`.

What the last two commands should show — this is the contract, not decoration:

```console
$ node bin/run.js greet:hello --name world --json
{"ok":true,"data":{"greeting":"Hello","target":"world"},"warnings":[],"telemetry":{...}}

$ node bin/run.js greet:hello --name "  " --json ; echo $?
{"ok":false,"error":{"type":"validation","code":64,"message":"--name must not be empty",...}}
64
```

Exactly one line on stdout, and a *typed* exit code — 64 is sysexits `EX_USAGE`,
because a `ValidationError` was thrown. A raw `Error` would have collapsed that
to exit 1 and told the caller nothing.

A first-party plugin instead of a third-party one? Same shape — only the
namespace changes, to `@seans-mfe/*` (ADR-021).
