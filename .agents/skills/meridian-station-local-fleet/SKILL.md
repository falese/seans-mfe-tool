---
name: meridian-station-local-fleet
description: Stand up and smoke-test the examples/meridian-station fleet locally (no docker) — offline npm mirror for @falese packages, the installs the runbook omits, and the Playwright browser-version trap.
---

# Meridian Station local fleet (path B, no docker)

`examples/meridian-station/STATION-DEMO.md` is the runbook. It is accurate but
incomplete; the gaps below cost the most time.

## 1. @falese packages will 404 from GitHub Packages

Each MFE's `.npmrc` points the `@falese` scope at `npm.pkg.github.com`, where the
framework packages may not be published/readable:

```
npm error 404 '@falese/smt-framework-react@^0.1.0' is not in this registry.
```

The repo ships an offline mirror of its own tarballs. Start it once:

```bash
cd <repo> && nohup node scripts/serve-registry-mirror.js > /tmp/mirror.log 2>&1 &   # serves dist/registry on :4873
```

then install each MFE with the scope override **as a CLI flag** (the env-var form
`npm_config_@falese:registry` is not a valid shell identifier and will fail):

```bash
npm install --legacy-peer-deps --no-audit --no-fund "--@falese:registry=http://127.0.0.1:4873"
```

If `dist/registry` is missing, run `npm run build && npm run build:packages` at
the repo root first.

## 2. Installs the runbook does not mention

`dev-up.sh` does not install anything. Without these, the APIs/registry/daemon
exit instantly (`Cannot find module 'dotenv'`, `Cannot find package
'apollo-server-express'`, `Cannot find module 'graphql'`) and every port shows
`000`:

```bash
cd examples/meridian-station/apis && for a in harbormaster-api stellar-ledger-api station-os-api; do (cd $a && npm install --no-audit --no-fund); done
cd ../control-plane && for d in registry daemon; do (cd $d && npm install --no-audit --no-fund --legacy-peer-deps); done
```

Also keep the runbook's `rm -rf node_modules/@falese/smt-runtime && cp -r <repo>/dist/runtime node_modules/@falese/smt-runtime`
step — a real directory, never a `file:` symlink, or Angular resolution escapes
the project.

## 3. The 7th MFE: meridian-docking-simulation

`control-plane/rules.json` registers `meridian-docking-simulation` on port 5007
and the console renders a "Docking Simulator" button, but `dev-up.sh` starts only
5001–5006 and `STATION-DEMO.md` never mentions 5007. Clicking the button yields:

```
Slot "meridian-console/main" failed: meridian-docking-simulation.DockingSimulation (mount):
Failed to load remoteEntry from http://localhost:5007/remoteEntry.js
```

To serve it manually: install (mirror flag above), copy the runtime, `npx rspack build`,
then `npx serve dist -p 5007 --cors`. Even then the Babylon canvas may stay blank
while the engine logs `BJS - Babylon.js vX - WebGL2` on a loop (~100 inits in
seconds) — likely a mount/effect loop in the simulation MFE rather than a WebGL
problem (a direct `getContext('webgl2')` probe in the same browser succeeds).
Check whether the simulator is in scope before reporting the whole fleet broken.

## 4. Registry is in-memory

After any registry restart, re-run **both** `./scripts/register-station.sh` and
`./scripts/console.sh` or nothing composes.

## 5. Playwright: version-pinned browsers

`npx playwright test` in `examples/meridian-station` may resolve a different
Playwright version than the preinstalled browsers:

```
Executable doesn't exist at ~/.cache/ms-playwright/chromium_headless_shell-1228/...
```

The config honours `CHROMIUM_PATH`, so point it at any real Chrome/Chromium
instead of downloading:

```bash
CHROMIUM_PATH=/home/ubuntu/.local/bin/google-chrome npx playwright test --reporter=list
```

## 6. Verifying live data

Header must read `Meridian Station · control plane: connected`. Berth strip:
b1/b2/b5 DOCKED with dues, b3 DOCKED with no dues, b4/b6 `berth available`.
Docking Board b1 = `₢ 8,500.00 DISPUTED`. Cargo line `DCK-004027/2` =
`valuation pending — finance` — a deliberate data gap, **not** a bug.

Every driven action should leave `DAE-220 ACTION_RECEIVED → DAE-250
RESOLUTION_RECEIVED → DAE-253 EXPERIENCE_RELAYED` in `/tmp/meridian-logs/daemon.log`.
A blank panel: read daemon.log, then query the MFE's own BFF
(`curl -s localhost:5002/graphql -H 'content-type: application/json' -d '{"query":"{ listBerths { berthId } }"}'`),
then re-run `register-station.sh`.

## Devin Secrets Needed

None. Everything resolves from the repo's own offline mirror; no GitHub Packages
token is required if `dist/registry` has been built.
