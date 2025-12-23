# @seans-mfe-tool/daemon

MFE Registry Daemon - Rust-based control plane for MFE orchestration.

## Overview

The MFE Registry Daemon is a high-performance Rust service that provides:

- **MFE Registry**: Central registry for MFE metadata (manifests, health, capabilities)
- **HTTP REST API**: RESTful endpoints for MFE registration and queries
- **WebSocket Protocol**: Real-time updates for registry changes and health status
- **Health Monitoring**: Automatic background health checks for registered MFEs

## Architecture

```
┌─────────────────────────────────────────┐
│     MFE Registry Daemon (Rust)          │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  MFERegistryDaemon                │ │
│  │  └─ DashMap<String, MFEMetadata>  │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  HTTP REST API (Warp)             │ │
│  │  └─ /api/mfes/* endpoints         │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  WebSocket Server                 │ │
│  │  └─ /ws endpoint                  │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  Health Check Scheduler           │ │
│  │  └─ Background task (30s)         │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## Installation

### Prerequisites

- Rust 1.70+ (install via [rustup](https://rustup.rs/))
- Cargo (comes with Rust)

### Development Build

```bash
npm run build:dev
# or
cargo build
```

### Production Build

```bash
npm run build
# or
cargo build --release
```

## Usage

### Running the Daemon

**Development mode**:
```bash
npm run dev
# or
cargo run
```

**Production mode**:
```bash
./target/release/mfe-daemon
```

The daemon will start on:
- HTTP API: `http://0.0.0.0:4000`
- WebSocket: `ws://0.0.0.0:4000/ws`

### Configuration

Environment variables:
- `RUST_LOG` - Logging level (default: `info`)
  - Example: `RUST_LOG=debug cargo run`

## API Reference

### HTTP REST API

Base URL: `http://localhost:4000`

#### Register MFE
```http
POST /api/mfes
Content-Type: application/json

{
  "id": "dashboard-mfe",
  "name": "Dashboard MFE",
  "version": "1.0.0",
  "type": "remote",
  "manifestUrl": "http://localhost:3000/manifest.yaml",
  "remoteEntryUrl": "http://localhost:3000/remoteEntry.js",
  "healthUrl": "http://localhost:3000/health",
  "capabilities": ["dashboard", "analytics"],
  "status": "unknown",
  "registeredAt": "2025-12-23T00:00:00Z"
}
```

#### Get All MFEs
```http
GET /api/mfes
```

#### Get Specific MFE
```http
GET /api/mfes/:id
```

#### Unregister MFE
```http
DELETE /api/mfes/:id
```

#### Health Check
```http
POST /api/mfes/:id/health
```

### WebSocket Protocol

URL: `ws://localhost:4000/ws`

**Message Types**:

- `MFE_REGISTERED` - New MFE added to registry
- `MFE_UNREGISTERED` - MFE removed from registry
- `MFE_HEALTH_UPDATED` - Health status changed
- `REGISTRY_QUERY` - Client requests all MFEs
- `REGISTRY_RESPONSE` - Daemon responds with MFE list
- `PING` / `PONG` - Connection keepalive

**Message Format**:
```json
{
  "type": "MFE_REGISTERED",
  "payload": { /* MFEMetadata */ },
  "timestamp": "2025-12-23T19:12:05.433650Z",
  "requestId": "optional-correlation-id"
}
```

## Data Models

### MFEMetadata

```rust
pub struct MFEMetadata {
    pub id: String,
    pub name: String,
    pub version: String,
    pub mfe_type: MFEType, // Remote, Bff, Tool, Agent, Feature, Service, Shell
    pub manifest_url: String,
    pub remote_entry_url: String,
    pub health_url: Option<String>,
    pub capabilities: Vec<String>,
    pub status: MFEStatus, // Healthy, Unhealthy, Unknown
    pub last_health_check: Option<DateTime<Utc>>,
    pub registered_at: DateTime<Utc>,
}
```

## Health Monitoring

The daemon runs a background health checker that:

1. Checks each MFE's `health_url` every 30 seconds
2. Updates MFE status in the registry
3. Broadcasts status changes via WebSocket

**Health States**:
- `Unknown` - Initial state or no health URL provided
- `Healthy` - Health check succeeded (HTTP 2xx)
- `Unhealthy` - Health check failed (timeout, error, non-2xx)

## Testing

```bash
# Run Rust tests
npm test
# or
cargo test

# Integration tests
../test-daemon.sh
```

## Integration with Control Package

The daemon integrates with `@seans-mfe-tool/control`:

```typescript
import { OrchestrationRuntime } from '@seans-mfe-tool/control';
import { RegistryClient, DaemonClient } from '@seans-mfe-tool/control/daemon';

// Create clients
const registryClient = new RegistryClient('http://localhost:4000');
const daemonClient = new DaemonClient('ws://localhost:4000/ws');

// Create runtime with daemon integration
const runtime = new OrchestrationRuntime(telemetry, registryClient);

// Connect to real-time updates
await daemonClient.connect();
daemonClient.on('MFE_REGISTERED', (mfe) => {
  console.log('New MFE registered:', mfe);
});
```

## Development

### Project Structure

```
packages/daemon/
├── src/
│   └── main.rs          # Main daemon implementation
├── Cargo.toml           # Rust dependencies
├── package.json         # npm integration
└── README.md           # This file
```

### Building

```bash
# Clean build
npm run clean && npm run build

# Check without building
npm run check
```

### Logging

Control log levels with `RUST_LOG`:

```bash
# Debug everything
RUST_LOG=debug cargo run

# Debug only daemon code
RUST_LOG=mfe_registry_daemon=debug cargo run

# Info level (default)
cargo run
```

## License

MIT
