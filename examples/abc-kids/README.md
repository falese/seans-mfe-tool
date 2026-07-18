# ABC Kids end-to-end platform demo

ABC Kids is the reference deployment for the complete composition path:

```text
browser action → daemon → registry rule → resolved experience
       ↑                                      ↓
       └──── generic shell + LayoutManager ←──┘
```

The shell imports no game and contains no framework-specific game code. A
containerized registry and daemon resolve state changes into independently
deployed Module Federation experiences. The same runtime adaptor composes:

- 12 React/rspack games;
- one Angular/webpack game (`multiplication-quiz`) with a mock GraphQL BFF;
- one React home/layout MFE that contributes
  `abc-kids-home/main` and `abc-kids-home/info`.

The home MFE declares its local slots in `mfe-manifest.yaml`, uses the
generated `src/slots.tsx` contract to register them, and lets the
`LayoutManager` scope them with the provider MFE id. Registry routes target
the full addresses, so unrelated MFEs may reuse local names such as `main`
without sharing state.

## Prerequisites

- Node.js 20 or 22 and npm
- Docker with Compose

## Quick start

From the repository root:

```bash
npm ci
npm run build
npm run docker:build:cli
```

Then from `examples/abc-kids`:

```bash
docker compose up -d --build registry daemon
SKIP_CLI=1 ./scripts/build-games.sh
./scripts/register-games.sh
./scripts/home.sh
```

Open `http://localhost:3000`. The shell first composes the home MFE into the
host-owned `root` slot. Choose a tile, or drive the same control-plane action
from the command line:

```bash
./scripts/play.sh multiplication-quiz
./scripts/play.sh multiplication-quiz show
./scripts/play.sh multiplication-quiz info
```

The `play` capability mounts in `abc-kids-home/main`; `show` and `info`
mount in `abc-kids-home/info`.

`build-games.sh` rebuilds the CLI image by default. Because the repository-root
commands above already built it, the quick start uses `SKIP_CLI=1`; omit that
variable when the image is stale:

```bash
./scripts/build-games.sh
```

Alternatively, the root Turbo graph builds the image chain:

```bash
npx turbo run docker:build:examples
```

## Services

| Service | Port | Purpose |
| --- | ---: | --- |
| shell | 3000 | Generic `LayoutManager` host |
| flappy | 3001 | React game |
| hockey | 3002 | React game |
| multiplication quiz | 3003 | Angular game + GraphQL BFF |
| daemon | 3004 | WebSocket/GraphQL control-plane relay |
| generated games | 3005–3014 | Ten React games |
| home | 3015 | React layout/launcher and slot provider |
| registry | 4000 | In-memory registrations and routing rules |

Registry state is in memory. After restarting the registry container, rerun
`./scripts/register-games.sh`.

## What to verify

1. The shell reports `control plane: connected`.
2. `./scripts/home.sh` renders the home menu.
3. The home provider elements have
   `data-layout-slot="abc-kids-home/main"` and
   `data-layout-slot="abc-kids-home/info"`.
4. `./scripts/play.sh multiplication-quiz` renders the Angular game in the
   same `main` region used by React games.
5. Replaying or swapping games does not duplicate content or lose the
   desired placement.
6. Daemon logs show the loop
   `ACTION_RECEIVED → RESOLUTION_RECEIVED → EXPERIENCE_RELAYED`, followed by
   slot topology signals from the shell.

## Useful commands

```bash
docker compose ps
docker compose logs -f daemon
./scripts/play.sh flappy
./scripts/play.sh rocket-math show
docker compose down
```

## Architecture and detailed runbook

- [Daemon-driven composition walkthrough](./DAEMON-DEMO.md)
- [Slot contract](../../docs/slot-contract.md)
- [Runtime architecture](../../docs/architecture-runtime-platform.md)
- ADR-054/055: control-plane protocol and `LayoutManager`
- ADR-066/067/068/069: stable, manifest-declared, provider-scoped slots
