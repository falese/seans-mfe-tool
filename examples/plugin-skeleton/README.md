# @falese/plugin-skeleton

Starter template for `seans-mfe-tool` plugins.  Clone this, rename the
package, and ship your own commands.

Read [PLUGIN-CONTRACT.md](../../PLUGIN-CONTRACT.md) before building a plugin.

## Quick start

```bash
# 1. Copy the skeleton
cp -r examples/plugin-skeleton my-plugin
cd my-plugin

# 2. Rename in package.json
#    Change "name" to "@vendor/your-plugin" and update the oclif topic.

# 3. Install deps (once @seans-mfe/oclif-base is published)
npm install

# 4. Build
npm run build

# 5. Link into the CLI for local testing
seans-mfe-tool plugins link .

# 6. Verify your topic appears
seans-mfe-tool --help
seans-mfe-tool demo:ping
seans-mfe-tool demo:ping --message hello --json
```

## What's included

| File | Purpose |
|------|---------|
| `src/commands/demo/ping.ts` | Example command extending `BaseCommand` |
| `src/index.ts` | Public barrel export |
| `package.json` | oclif plugin shape with correct peer deps |
| `tsconfig.json` | TypeScript config mirroring the core CLI |

## JSON envelope

The `--json` flag is provided automatically by `BaseCommand`:

```bash
$ seans-mfe-tool demo:ping --json
{"ok":true,"data":{"message":"pong","timestamp":"2026-04-18T..."},"warnings":[],"telemetry":{"durationMs":4,"correlationId":"..."}}
```

## Writing your own commands

1. Copy `src/commands/demo/ping.ts`
2. Rename the class, file path, and topic (e.g. `src/commands/acme/build.ts`)
3. Change the return type interface
4. `throw` only typed errors from `@seans-mfe/contracts`
5. Run `npm run build` and test with `plugins link`
