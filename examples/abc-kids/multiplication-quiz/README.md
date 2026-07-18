# abc-kids-multiplication-quiz

The mixed-framework game in the [ABC Kids platform demo](../README.md):
an Angular 19 + webpack Module Federation MFE and a GraphQL Mesh BFF in one
deployable.

The registry resolves three domain capabilities:

| State key | Capability | Layout target |
| --- | --- | --- |
| `abc.play.multiplication-quiz` | `PlayGame` | `abc-kids-home/main` |
| `abc.show.multiplication-quiz` | `ShowCover` | `abc-kids-home/info` |
| `abc.info.multiplication-quiz` | `GetGameInfo` | `abc-kids-home/info` |

The generic React shell does not import Angular or this MFE. It mounts the
resolved remote through the same `BaseMFE` lifecycle and Module Federation
adaptor used by the React games.

## Manifest and generated output

`mfe-manifest.yaml` declares:

- `framework: angular` and `bundler: webpack`;
- the three domain capabilities above;
- a GraphQL Mesh data source generated from `api/openapi.yaml`;
- `data.mockSwitch.enabled: true` for the ADR-052 demo-mode mock.

Generation produces Angular feature components, the platform `BaseMFE`
wrapper, webpack Module Federation configuration, Mesh artifacts, and the
BFF server. Angular MFEs that declare `providesSlots` also receive
`src/slots.ts` with the standalone `[smtDeclaredSlot]` directive; this game
consumes the home MFE's slots rather than providing its own.

## Local endpoints

In the Docker demo, one server exposes the remote and BFF on port 3003:

| Endpoint | Purpose |
| --- | --- |
| `http://localhost:3003/remoteEntry.js` | Module Federation remote |
| `http://localhost:3003/graphql` | GraphQL Mesh endpoint |
| `http://localhost:3003/health` | Health check |

For standalone development, `npm run dev` starts Angular's development
server and `server.ts` separately. The BFF defaults to port 4003 unless
`PORT` is set; the full ABC Kids Compose configuration sets `PORT=3003` and
serves the production Angular bundle and GraphQL endpoint together.

## Run in the full demo

From `examples/abc-kids`:

```bash
./scripts/register-games.sh
./scripts/home.sh
./scripts/play.sh multiplication-quiz
./scripts/play.sh multiplication-quiz show
./scripts/play.sh multiplication-quiz info
```

For a self-contained BFF request, send `x-bff-mode: mock` (or start the server
with `DEMO_MODE=true`) so ADR-052 fixtures are used instead of the live
PetStore upstream. See:

- [ABC Kids quick start](../README.md)
- [Daemon-driven runbook](../DAEMON-DEMO.md)
- [Slot contract](../../../docs/slot-contract.md)
- [BFF architecture](../../../docs/architecture-bff.md)
- ADR-012 (GraphQL Mesh BFF), ADR-027 (Mesh v0.100.x), ADR-034
  (framework/bundler variants), and ADR-052 (per-request mock switch)
