"""
MFE Platform Contract — Python Stub
=====================================
This file demonstrates how the 10-capability platform contract is expressed
in Python. It is a *teaching stub* — the structure and method signatures
are correct, but the bodies are left as TODOs for your implementation.

In a real Python MFE this base class would ship as:
    pip install seans-mfe-sdk

The daemon (control plane) calls these capabilities via GraphQL over WebSocket
using the graphql-transport-ws protocol. When a capability is invoked:

  Control Plane (daemon/registry)
        │  GraphQL mutation / subscription
        ▼
  HTTP endpoint on this MFE server  →  capability method  →  response

Daemon ↔ MFE capability mapping:
  describe()               → Registry stores returned manifest as component metadata
  load()                   → Registry renderComponent() initializes this MFE
  render()                 → Daemon relays MFE's own experience back to Renderer
  refresh()                → Registry componentUpdate subscription triggers re-render
  emit()                   → Telemetry / observability events (no registry reaction)
  query()                  → Daemon Query.state returns component store
  schema()                 → MFE exposes GraphQL schema for Registry introspection
  authorizeAccess()        → Registry rules engine gates component creation
  health()                 → Registry monitors component liveness
  updateControlPlaneState()→ MFE pushes domain state → registry re-evaluates rules

See: PLATFORM-CONTRACT.md for the full reference.
"""

from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional
import uuid

# -----------------------------------------------------------------------------
# State Machine
# -----------------------------------------------------------------------------

class MFEState(Enum):
    UNINITIALIZED = "uninitialized"
    LOADING = "loading"
    READY = "ready"
    RENDERING = "rendering"
    ERROR = "error"
    DESTROYED = "destroyed"

VALID_TRANSITIONS: dict[MFEState, list[MFEState]] = {
    MFEState.UNINITIALIZED: [MFEState.LOADING],
    MFEState.LOADING:       [MFEState.READY, MFEState.ERROR],
    MFEState.READY:         [MFEState.LOADING, MFEState.RENDERING, MFEState.DESTROYED],
    MFEState.RENDERING:     [MFEState.READY, MFEState.ERROR],
    MFEState.ERROR:         [MFEState.LOADING, MFEState.DESTROYED],
    MFEState.DESTROYED:     [],
}

# -----------------------------------------------------------------------------
# Shared Context (passed to every capability method)
# -----------------------------------------------------------------------------

@dataclass
class Context:
    """
    Execution context shared across lifecycle phases.
    Mirrors src/runtime/context.ts — Context interface.
    """
    mfe_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    correlation_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = field(default_factory=datetime.utcnow)
    jwt: Optional[str] = None           # bearer token from daemon
    inputs: dict[str, Any] = field(default_factory=dict)
    outputs: dict[str, Any] = field(default_factory=dict)
    phase: Optional[str] = None         # before | main | after | error
    capability: Optional[str] = None    # current capability being executed
    error: Optional[Exception] = None

# -----------------------------------------------------------------------------
# Return Types  (mirror TypeScript interfaces in base-mfe.ts)
# -----------------------------------------------------------------------------

@dataclass
class LoadResult:
    status: str                          # "loaded" | "error"
    timestamp: datetime = field(default_factory=datetime.utcnow)
    container: Any = None               # platform-specific runtime handle
    extra: dict[str, Any] = field(default_factory=dict)

@dataclass
class RenderResult:
    status: str                          # "rendered" | "error"
    timestamp: datetime = field(default_factory=datetime.utcnow)
    element: Any = None                 # rendered component or data representation
    extra: dict[str, Any] = field(default_factory=dict)

@dataclass
class HealthResult:
    status: str                          # "healthy" | "degraded" | "unhealthy"
    timestamp: datetime = field(default_factory=datetime.utcnow)
    checks: list[dict[str, Any]] = field(default_factory=list)

@dataclass
class DescribeResult:
    name: str
    version: str
    type: str
    capabilities: list[str]
    manifest: dict[str, Any]

@dataclass
class SchemaResult:
    schema: str                          # GraphQL SDL or JSON schema
    format: str                          # "graphql" | "json" | "openapi"

@dataclass
class QueryResult:
    data: Any
    errors: list[dict[str, Any]] = field(default_factory=list)

@dataclass
class EmitResult:
    emitted: bool
    event_id: Optional[str] = None

@dataclass
class ControlPlaneStateResult:
    """
    Result of pushing domain state to the daemon control plane.
    Distinct from EmitResult — this targets registry resolution, not observers.
    """
    acknowledged: bool
    correlation_id: str
    # Populated if the registry immediately resolved a new component.
    # In practice this usually arrives asynchronously via the daemon's
    # Subscription.messages channel rather than synchronously here.
    resolution: Optional[dict[str, Any]] = None  # {mfe, capability, props}

# -----------------------------------------------------------------------------
# BaseMFE Abstract Class
# -----------------------------------------------------------------------------

class BaseMFE(ABC):
    """
    Abstract base class for all Python MFE implementations.

    Platform responsibilities (handled here):
      - Lifecycle orchestration (before → main → after → error)
      - State machine transitions
      - Error containment

    Developer responsibilities (implement in your subclass):
      - The 9 do_*() abstract methods below
    """

    def __init__(self, manifest: dict[str, Any]) -> None:
        self._manifest = manifest
        self._state = MFEState.UNINITIALIZED
        self._state_history: list[dict[str, Any]] = []

    # -------------------------------------------------------------------------
    # State Management
    # -------------------------------------------------------------------------

    @property
    def state(self) -> MFEState:
        return self._state

    def _transition(self, new_state: MFEState) -> None:
        if new_state not in VALID_TRANSITIONS[self._state]:
            raise RuntimeError(
                f"Invalid state transition: {self._state.value} → {new_state.value}. "
                f"Valid: {[s.value for s in VALID_TRANSITIONS[self._state]]}"
            )
        old = self._state
        self._state = new_state
        self._state_history.append({
            "from": old.value, "to": new_state.value,
            "timestamp": datetime.utcnow().isoformat()
        })

    def _assert_state(self, *expected: MFEState) -> None:
        if self._state not in expected:
            raise RuntimeError(
                f"Invalid state: expected {[s.value for s in expected]}, got {self._state.value}"
            )

    # -------------------------------------------------------------------------
    # Platform Capabilities  (public API — called by daemon/registry)
    # These orchestrate lifecycle phases then delegate to do_*() methods.
    # -------------------------------------------------------------------------

    async def load(self, ctx: Context) -> LoadResult:
        """Initialize the MFE. Maps to Registry renderComponent() mutation."""
        self._assert_state(MFEState.UNINITIALIZED, MFEState.READY, MFEState.ERROR)
        self._transition(MFEState.LOADING)
        try:
            await self._run_lifecycle("load", "before", ctx)
            await self._run_lifecycle("load", "main", ctx)
            result = await self.do_load(ctx)
            await self._run_lifecycle("load", "after", ctx)
            self._transition(MFEState.READY)
            return result
        except Exception as exc:
            ctx.error = exc
            await self._run_lifecycle("load", "error", ctx)
            self._transition(MFEState.ERROR)
            raise

    async def render(self, ctx: Context) -> RenderResult:
        """Produce the MFE's own experience, commanded by the daemon.

        The daemon calls this after the Registry resolves that THIS MFE should
        handle the current state change. The output travels: MFE → Daemon →
        Renderer. The MFE owns the presentation — not the daemon, not a fixed
        component library."""
        self._assert_state(MFEState.READY)
        self._transition(MFEState.RENDERING)
        try:
            await self._run_lifecycle("render", "before", ctx)
            await self._run_lifecycle("render", "main", ctx)
            result = await self.do_render(ctx)
            await self._run_lifecycle("render", "after", ctx)
            self._transition(MFEState.READY)
            return result
        except Exception as exc:
            ctx.error = exc
            await self._run_lifecycle("render", "error", ctx)
            self._transition(MFEState.ERROR)
            raise

    async def refresh(self, ctx: Context) -> None:
        """Reload state. Triggered by Registry componentUpdate subscription."""
        self._assert_state(MFEState.READY)
        try:
            await self._run_lifecycle("refresh", "before", ctx)
            await self._run_lifecycle("refresh", "main", ctx)
            await self.do_refresh(ctx)
            await self._run_lifecycle("refresh", "after", ctx)
        except Exception as exc:
            ctx.error = exc
            await self._run_lifecycle("refresh", "error", ctx)
            raise

    async def authorize_access(self, ctx: Context) -> bool:
        """Gate access. Maps to Registry rules engine evaluation."""
        self._assert_state(MFEState.READY)
        try:
            await self._run_lifecycle("authorizeAccess", "before", ctx)
            await self._run_lifecycle("authorizeAccess", "main", ctx)
            result = await self.do_authorize_access(ctx)
            await self._run_lifecycle("authorizeAccess", "after", ctx)
            return result
        except Exception as exc:
            ctx.error = exc
            await self._run_lifecycle("authorizeAccess", "error", ctx)
            raise

    async def health(self, ctx: Context) -> HealthResult:
        """Report health. Polled by Registry to monitor component liveness."""
        self._assert_state(
            MFEState.UNINITIALIZED, MFEState.LOADING, MFEState.READY,
            MFEState.RENDERING, MFEState.ERROR
        )
        try:
            await self._run_lifecycle("health", "before", ctx)
            await self._run_lifecycle("health", "main", ctx)
            result = await self.do_health(ctx)
            await self._run_lifecycle("health", "after", ctx)
            return result
        except Exception as exc:
            ctx.error = exc
            await self._run_lifecycle("health", "error", ctx)
            raise

    async def describe(self, ctx: Context) -> DescribeResult:
        """Return manifest. Stored by Registry as component metadata."""
        try:
            await self._run_lifecycle("describe", "before", ctx)
            result = await self.do_describe(ctx)
            await self._run_lifecycle("describe", "after", ctx)
            return result
        except Exception as exc:
            ctx.error = exc
            await self._run_lifecycle("describe", "error", ctx)
            raise

    async def schema(self, ctx: Context) -> SchemaResult:
        """Expose GraphQL schema for Registry introspection."""
        self._assert_state(MFEState.READY)
        try:
            await self._run_lifecycle("schema", "before", ctx)
            result = await self.do_schema(ctx)
            await self._run_lifecycle("schema", "after", ctx)
            return result
        except Exception as exc:
            ctx.error = exc
            await self._run_lifecycle("schema", "error", ctx)
            raise

    async def query(self, ctx: Context) -> QueryResult:
        """Execute data query. Surfaced via Daemon Query.state."""
        self._assert_state(MFEState.READY)
        try:
            await self._run_lifecycle("query", "before", ctx)
            result = await self.do_query(ctx)
            await self._run_lifecycle("query", "after", ctx)
            return result
        except Exception as exc:
            ctx.error = exc
            await self._run_lifecycle("query", "error", ctx)
            raise

    async def emit(self, ctx: Context) -> EmitResult:
        """Publish telemetry/observability events. Does NOT trigger registry rules."""
        try:
            await self._run_lifecycle("emit", "before", ctx)
            result = await self.do_emit(ctx)
            await self._run_lifecycle("emit", "after", ctx)
            return result
        except Exception as exc:
            ctx.error = exc
            await self._run_lifecycle("emit", "error", ctx)
            raise

    async def update_control_plane_state(self, ctx: Context) -> ControlPlaneStateResult:
        """Push meaningful domain state to the daemon so the Registry re-evaluates rules.

        Use this when internal MFE state has changed in a way that should drive
        what experience is shown next — not telemetry, but semantic state:

          - Analysis complete  → registry may resolve a DataVisualization MFE
          - Form submitted     → registry may resolve a Confirmation MFE
          - Wizard step done   → registry may resolve the next step's MFE
          - Error escalation   → registry may route to an EscalationHandler MFE

        ctx.inputs must contain:
          stateKey: str           — semantic name ("analysis.complete", "form.submitted")
          stateData: dict         — domain context the Registry rules engine evaluates
          correlationId?: str     — links this update to the originating render/action

        The daemon routes this through sendAction → Registry handleMessage.
        Available from READY or RENDERING states.
        """
        self._assert_state(MFEState.READY, MFEState.RENDERING)
        try:
            await self._run_lifecycle("updateControlPlaneState", "before", ctx)
            await self._run_lifecycle("updateControlPlaneState", "main", ctx)
            result = await self.do_update_control_plane_state(ctx)
            await self._run_lifecycle("updateControlPlaneState", "after", ctx)
            return result
        except Exception as exc:
            ctx.error = exc
            await self._run_lifecycle("updateControlPlaneState", "error", ctx)
            raise

    # -------------------------------------------------------------------------
    # Lifecycle Hook Runner  (simplified — production SDK would load from YAML)
    # -------------------------------------------------------------------------

    async def _run_lifecycle(self, capability: str, phase: str, ctx: Context) -> None:
        """
        Execute lifecycle hooks for a given capability phase.
        In a production SDK, hooks are declared in the YAML manifest and
        resolved here. This stub is a no-op — override in tests as needed.
        """
        ctx.phase = phase
        ctx.capability = capability
        # TODO: load hooks from self._manifest["capabilities"][capability]["lifecycle"][phase]
        # and invoke each handler in sequence

    # -------------------------------------------------------------------------
    # Abstract Methods  (YOU implement these in your MFE subclass)
    # -------------------------------------------------------------------------

    @abstractmethod
    async def do_load(self, ctx: Context) -> LoadResult:
        """
        Initialize this MFE's runtime.
        For a Python MFE: connect to databases, warm caches, validate config.
        For a GraphQL MFE: build schema, start resolvers.
        """
        ...

    @abstractmethod
    async def do_render(self, ctx: Context) -> RenderResult:
        """
        Produce this MFE's own experience when commanded by the daemon.

        The daemon calls render() after the Registry resolves that this MFE
        should handle the current state. ctx.inputs["capability"] tells you
        which domain capability to render; ctx.inputs["props"] carries the
        data the Registry resolved.

        Return whatever your MFE produces:
          - HTML string (server-rendered fragment the Renderer injects)
          - Structured data (charts config, table data, etc.)
          - For JS/TS MFEs: a Module Federation component reference

        There is no fixed component type library — the MFE decides.
        """
        ...

    @abstractmethod
    async def do_refresh(self, ctx: Context) -> None:
        """
        Reload fresh data or state without full re-initialization.
        Called when the Registry pushes a componentUpdate subscription event.
        """
        ...

    @abstractmethod
    async def do_authorize_access(self, ctx: Context) -> bool:
        """
        Validate the JWT in ctx.jwt and return True if access is granted.
        The daemon forwards the token from the renderer's sendAction call.
        """
        ...

    @abstractmethod
    async def do_health(self, ctx: Context) -> HealthResult:
        """
        Check liveness of all dependencies (DB connections, external APIs, etc.)
        and return a HealthResult. The Registry polls this endpoint.
        """
        ...

    @abstractmethod
    async def do_describe(self, ctx: Context) -> DescribeResult:
        """
        Return this MFE's full manifest. The Registry stores this as the
        component metadata that the daemon uses to route messages.
        """
        ...

    @abstractmethod
    async def do_schema(self, ctx: Context) -> SchemaResult:
        """
        Return the GraphQL SDL (or JSON schema) that describes this MFE's
        data surface. The Registry uses this for introspection queries.
        """
        ...

    @abstractmethod
    async def do_query(self, ctx: Context) -> QueryResult:
        """
        Execute a GraphQL query from ctx.inputs["query"] with variables
        from ctx.inputs["variables"]. Return data or errors.
        Surfaced via Daemon Query.state when the renderer requests data.
        """
        ...

    @abstractmethod
    async def do_emit(self, ctx: Context) -> EmitResult:
        """
        Publish a telemetry event or metric to observers.
        This does NOT trigger registry re-evaluation. Use
        do_update_control_plane_state() when you want the registry to act.
        """
        ...

    @abstractmethod
    async def do_update_control_plane_state(self, ctx: Context) -> ControlPlaneStateResult:
        """
        Push meaningful domain state to the daemon/registry control plane.

        Called when this MFE has produced state that should influence what
        experience the Registry resolves next. Not telemetry — semantic state
        the rules engine acts on.

        ctx.inputs:
          state_key: str       — e.g. "analysis.complete", "form.submitted"
          state_data: dict     — domain data the registry rules engine reads
          correlation_id?: str — link to the originating render/action

        Implementations send this via POST to the daemon's /state endpoint,
        which routes it through sendAction → Registry handleMessage.
        """
        ...


# -----------------------------------------------------------------------------
# Example: CsvAnalyzerMFE  (stubbed concrete implementation)
# -----------------------------------------------------------------------------

class CsvAnalyzerMFE(BaseMFE):
    """
    Concrete MFE implementation — CSV analysis service.
    When the daemon calls render(), this MFE produces its own HTML experience.
    Matches mfe-manifest.yaml in this directory.
    """

    async def do_load(self, ctx: Context) -> LoadResult:
        # TODO: connect to data store, warm caches
        return LoadResult(status="loaded")

    async def do_render(self, ctx: Context) -> RenderResult:
        capability = ctx.inputs.get("capability", "DataAnalysis")
        props = ctx.inputs.get("props", {})

        # TODO: run the actual analysis using props (e.g. props["fileId"])
        # and produce this MFE's own HTML experience.
        # The daemon will relay this output directly to the Renderer.

        html = f"""
        <section class="csv-analysis" data-capability="{capability}">
          <h2>CSV Analysis</h2>
          <p>File: {props.get('fileId', 'unknown')}</p>
          <!-- TODO: render real analysis results here -->
          <table class="results">
            <thead><tr><th>Column</th><th>Mean</th><th>Std Dev</th></tr></thead>
            <tbody><!-- rows populated by real analysis --></tbody>
          </table>
        </section>
        """
        return RenderResult(
            status="rendered",
            element={"contentType": "text/html", "output": html}
        )

    async def do_refresh(self, ctx: Context) -> None:
        # TODO: refetch latest analysis results
        pass

    async def do_authorize_access(self, ctx: Context) -> bool:
        # TODO: validate ctx.jwt — decode, check claims, verify signature
        # For local dev, return True; production must verify against identity provider
        return True

    async def do_health(self, ctx: Context) -> HealthResult:
        # TODO: check DB connection, disk space, memory
        return HealthResult(
            status="healthy",
            checks=[{"name": "self", "status": "pass"}]
        )

    async def do_describe(self, ctx: Context) -> DescribeResult:
        return DescribeResult(
            name=self._manifest.get("name", "csv-analyzer"),
            version=self._manifest.get("version", "1.0.0"),
            type=self._manifest.get("type", "tool"),
            capabilities=["load", "render", "refresh", "authorizeAccess",
                          "health", "describe", "schema", "query", "emit",
                          "updateControlPlaneState"],
            manifest=self._manifest
        )

    async def do_schema(self, ctx: Context) -> SchemaResult:
        # TODO: return actual GraphQL SDL for this MFE's data surface
        return SchemaResult(
            schema="""
                type Query { analysis(id: ID!): Analysis }
                type Analysis { id: ID! rowCount: Int columnCount: Int }
            """,
            format="graphql"
        )

    async def do_query(self, ctx: Context) -> QueryResult:
        # TODO: execute ctx.inputs["query"] against this MFE's GraphQL schema
        return QueryResult(data={"analysis": None}, errors=[])

    async def do_emit(self, ctx: Context) -> EmitResult:
        # TODO: forward telemetry event to observability sink
        event_id = str(uuid.uuid4())
        return EmitResult(emitted=True, event_id=event_id)

    async def do_update_control_plane_state(self, ctx: Context) -> ControlPlaneStateResult:
        state_key = ctx.inputs.get("state_key", "")
        state_data = ctx.inputs.get("state_data", {})
        correlation_id = ctx.inputs.get("correlation_id", ctx.correlation_id)

        if not state_key:
            raise ValueError("update_control_plane_state requires ctx.inputs['state_key']")

        # TODO: POST to daemon /state endpoint (or send via WebSocket sendAction)
        # import httpx
        # await httpx.AsyncClient().post(
        #     "http://daemon:4000/state",
        #     json={"stateKey": state_key, "stateData": state_data,
        #           "correlationId": correlation_id, "mfe": self._manifest["name"]}
        # )
        #
        # Example — CSV analysis complete, signal registry to show visualization:
        #   await mfe.update_control_plane_state(Context(inputs={
        #       "state_key": "analysis.complete",
        #       "state_data": {"result_id": "abc123", "row_count": 5000, "quality": "high"},
        #       "correlation_id": original_render_ctx.correlation_id,
        #   }))

        return ControlPlaneStateResult(
            acknowledged=True,
            correlation_id=correlation_id
        )


# -----------------------------------------------------------------------------
# HTTP Server  (Flask stub — exposes each capability as an endpoint)
# Install: pip install flask
# Run:     python base_mfe.py
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    import asyncio
    import json
    try:
        from flask import Flask, request, jsonify
    except ImportError:
        print("Install Flask to run the HTTP server: pip install flask")
        raise SystemExit(1)

    app = Flask(__name__)
    manifest = {"name": "csv-analyzer", "version": "1.0.0", "type": "tool",
                "language": "python"}
    mfe = CsvAnalyzerMFE(manifest)

    def run_async(coro):
        return asyncio.get_event_loop().run_until_complete(coro)

    def make_context() -> Context:
        body = request.get_json(silent=True) or {}
        return Context(
            jwt=request.headers.get("Authorization", "").removeprefix("Bearer "),
            inputs=body.get("inputs", {}),
        )

    @app.post("/load")
    def endpoint_load():
        result = run_async(mfe.load(make_context()))
        return jsonify({"status": result.status, "timestamp": result.timestamp.isoformat()})

    @app.post("/render")
    def endpoint_render():
        result = run_async(mfe.render(make_context()))
        return jsonify({"status": result.status, "element": result.element})

    @app.post("/refresh")
    def endpoint_refresh():
        run_async(mfe.refresh(make_context()))
        return jsonify({"refreshed": True})

    @app.post("/authorize")
    def endpoint_authorize():
        result = run_async(mfe.authorize_access(make_context()))
        return jsonify({"authorized": result})

    @app.get("/health")
    def endpoint_health():
        result = run_async(mfe.health(make_context()))
        return jsonify({"status": result.status, "checks": result.checks})

    @app.get("/describe")
    def endpoint_describe():
        result = run_async(mfe.describe(make_context()))
        return jsonify({"name": result.name, "version": result.version,
                        "capabilities": result.capabilities})

    @app.get("/schema")
    def endpoint_schema():
        result = run_async(mfe.schema(make_context()))
        return jsonify({"schema": result.schema, "format": result.format})

    @app.post("/query")
    def endpoint_query():
        result = run_async(mfe.query(make_context()))
        return jsonify({"data": result.data, "errors": result.errors})

    @app.post("/emit")
    def endpoint_emit():
        result = run_async(mfe.emit(make_context()))
        return jsonify({"emitted": result.emitted, "eventId": result.event_id})

    @app.post("/state")
    def endpoint_state():
        result = run_async(mfe.update_control_plane_state(make_context()))
        return jsonify({
            "acknowledged": result.acknowledged,
            "correlationId": result.correlation_id,
            "resolution": result.resolution,
        })

    print("CSV Analyzer MFE running on http://localhost:3002")
    app.run(port=3002)
