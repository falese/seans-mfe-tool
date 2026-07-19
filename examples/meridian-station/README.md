# Meridian Station 🛸

The SMT full-platform reference app: a commercial orbital spaceport composed of
**six micro-frontends (3 Angular, 3 React) over three deliberately messy domain
APIs**, wired through per-MFE GraphQL BFFs, a generic shell, and the daemon
control plane. Everything except the shell was generated with the real CLI —
two of the MFEs through the MCP server (`scripts/mcp-call.mjs`).

Run it: see **[STATION-DEMO.md](./STATION-DEMO.md)**. How building it went
(bugs found, bugs fixed, CLI vs MCP): **[DX-REPORT.md](./DX-REPORT.md)**.
Why the backends are deliberately inconsistent:
**[PDR-007](../../docs/product-decisions/PDR-007-model-messy-reality.md)**.

## The mess is the point

Three backends own overlapping slices of the same domain, each speaking its own
dialect. The same station, asked three ways:

```text
GET :5101/api/berths?occupied_flag=1                 ← Harbormaster (15-year-old port authority)
[ { "berth_id": "b1", "berth_class": "medium_freight",
    "occupied_flag": 1, "current_docking_id": 4021 }, … ]   + X-Total-Count: 6

GET :5102/api/charges?dockingRef=DCK-004021          ← StellarLedger (fintech vendor)
{ "result": [ { "chargeId": "CHG-90303", "dockingRef": "DCK-004021",
    "amountCents": 150000, "status": "DISPUTED" } ],
  "meta": { "cursor": null, "hasMore": false } }

GET :5103/api/telemetry?ModuleId=6                   ← StationOS (SOAP-heritage ERP)
{ "Data": [ { "ReadingId": 91008, "MetricKind": "CO2_PPM",
    "MetricValue": 1180, "AlertLevel": "CRITICAL" } ],
  "Pagination": { "Page": 1, "PageSize": 20, "TotalPages": 1 } }
```

…and the one way an MFE actually asks, through its manifest-declared BFF:

```graphql
{
  listBerths(occupied_flag: 1) { berthId berthClass currentDockingId }
  charges(dockingRef: "DCK-004021") { chargeType amountCents status }
  valuations { manifestLineRef declaredValueCents insuranceClass }
}
```

snake_case and PascalCase are camelCased by the always-on `namingConvention`
transform; the vendor envelopes are unwrapped **at the graph** by source-level
`hoistField` transforms declared in the manifest; the raw envelope operations
remain beside the normalized fields, so one schema shows before and after.

The same entity carries three id formats across systems — `docking_id: 4021` ↔
`dockingRef: "DCK-004021"` ↔ `DockingNo: 4021`; `CrewId: 42` ↔ `crewRef:
"CRW-0042"`; `VendorId: 105` ↔ `merchantId: "ACC-7105"` — reconciled by tiny
feature-level helpers (`src/features/shared/`), because the DSL doesn't support
`additionalResolvers` yet (documented roadmap gap). And the data has honest
holes: manifest line `DCK-004027/2` has no valuation, and the cargo view says
so instead of hiding the row.

## Topology

| Service | Port | What it is |
|---|---|---|
| `shell/` | 5000 | Hand-written generic layout host — **zero** static remotes; every MFE arrives via control-plane module-federation payloads |
| `meridian-console/` | 5001 | React slot provider: `main`, `status`, and the **keyed** `berth.{id}` strip (ADR-069) |
| `meridian-docking-control/` | 5002 | Angular · Harbormaster + StellarLedger BFF · `DockingBoard` / `TrafficLog` / keyed `BerthTile` ×6 |
| `meridian-life-support/` | 5003 | Angular · StationOS only (the single-source contrast) |
| `meridian-cargo-ops/` | 5004 | Angular · the flagship split-document `CargoManifest` |
| `meridian-crew-services/` | 5005 | React · StationOS + StellarLedger · **MCP-scaffolded** |
| `meridian-concourse/` | 5006 | React · all three sources on one screen · **MCP-scaffolded** |
| `control-plane/` registry / daemon | 4500 / 4504 | Vendored dev-grade control plane (in-memory registry) |
| `apis/harbormaster-api` | 5101 | Generated · sqlite · snake_case, bare arrays, `X-Total-Count` |
| `apis/stellar-ledger-api` | 5102 | Generated · mongodb · camelCase `{result, meta}`, integer cents |
| `apis/station-os-api` | 5103 | Generated · sqlite · PascalCase `{Data, Pagination}` |

Ports are clear of abc-kids (3000–3015, 4000): both stacks run side by side.

## How this differs from abc-kids

- **Generated with the real CLI** — `remote:init` + manifest + `remote:generate`
  per MFE, `api` per backend — not a bespoke stamping script (and
  `scripts/generate.mjs --check` keeps generated artifacts honest in CI).
- **Live BFFs over real domain APIs** — abc-kids' BFFs only ever queried a mock
  petstore spec; every Meridian query in the demo hits seeded databases.
- **Keyed slots exercised** — the console's `berth.{id}` pattern resolves six
  independent experiences of one Angular MFE into six addresses (the fan-out
  that surfaced and fixed the runtime's multi-instance composition bugs, #277).
- **Both entry points dogfooded** — two MFEs scaffolded through `mcp:serve`
  tool calls; the comparison is in DX-REPORT.md.
- **One action, many rules** — `meridian.open.docking` fires two registry rules
  (board into `meridian-console/main`, traffic log into
  `meridian-console/status`) from a single click.

## Where the single sources of truth live

- Domain data: `seed/station.json`, projected into each API's native dialect by
  `scripts/derive-seeds.mjs` — the three projections ARE the documented mess.
- Per-MFE contract: `mfe-manifest.yaml` (capabilities, `providesSlots`,
  `data:` sources + `hoistField` transforms). The BFF endpoint is derived from
  `endpoint` + `data.serve.endpoint` — MFE and BFF are one deployable unit.
- Routes: `scripts/register-station.sh` (in-memory registry — re-run after any
  registry restart).
