// MFE Platform Contract — Go Stub
//
// This file demonstrates how the 9-capability platform contract is expressed
// in Go. It is a *teaching stub* — the structure and method signatures are
// correct, but the bodies are left as TODOs for your implementation.
//
// In a real Go MFE this base implementation would ship as:
//
//	go get github.com/your-org/seans-mfe-sdk
//
// Daemon ↔ MFE capability mapping:
//
//	describe()        → Registry stores manifest as component metadata
//	load()            → Registry renderComponent() initializes this MFE
//	render()          → Daemon Subscription.messages COMPONENT_UPDATE push
//	refresh()         → Registry componentUpdate subscription triggers re-render
//	emit()            → Renderer sendAction → Daemon → Registry handleMessage
//	query()           → Daemon Query.state returns component store
//	schema()          → MFE exposes GraphQL schema for Registry introspection
//	authorizeAccess() → Registry rules engine gates component creation
//	health()          → Registry monitors component liveness
//
// See: PLATFORM-CONTRACT.md for the full reference.
package mfe

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
)

// ---------------------------------------------------------------------------
// State Machine
// ---------------------------------------------------------------------------

// MFEState represents the lifecycle state of an MFE.
type MFEState string

const (
	StateUninitialized MFEState = "uninitialized"
	StateLoading       MFEState = "loading"
	StateReady         MFEState = "ready"
	StateRendering     MFEState = "rendering"
	StateError         MFEState = "error"
	StateDestroyed     MFEState = "destroyed"
)

var validTransitions = map[MFEState][]MFEState{
	StateUninitialized: {StateLoading},
	StateLoading:       {StateReady, StateError},
	StateReady:         {StateLoading, StateRendering, StateDestroyed},
	StateRendering:     {StateReady, StateError},
	StateError:         {StateLoading, StateDestroyed},
	StateDestroyed:     {},
}

// ---------------------------------------------------------------------------
// Context  (passed to every capability method)
// ---------------------------------------------------------------------------

// MFEContext is the execution context shared across lifecycle phases.
// Mirrors src/runtime/context.ts — Context interface.
type MFEContext struct {
	MFEID         string         `json:"mfeId"`
	CorrelationID string         `json:"correlationId"`
	Timestamp     time.Time      `json:"timestamp"`
	JWT           string         `json:"jwt,omitempty"`    // bearer token from daemon
	Inputs        map[string]any `json:"inputs,omitempty"`
	Outputs       map[string]any `json:"outputs,omitempty"`
	Phase         string         `json:"phase,omitempty"`      // before | main | after | error
	Capability    string         `json:"capability,omitempty"` // current capability
	Err           error          `json:"-"`
}

// NewContext creates a context with a fresh correlation ID.
func NewContext(jwt string, inputs map[string]any) MFEContext {
	return MFEContext{
		MFEID:         uuid.New().String(),
		CorrelationID: uuid.New().String(),
		Timestamp:     time.Now().UTC(),
		JWT:           jwt,
		Inputs:        inputs,
		Outputs:       make(map[string]any),
	}
}

// ---------------------------------------------------------------------------
// Return Types  (mirror TypeScript interfaces in base-mfe.ts)
// ---------------------------------------------------------------------------

type LoadResult struct {
	Status    string         `json:"status"` // "loaded" | "error"
	Timestamp time.Time      `json:"timestamp"`
	Container any            `json:"container,omitempty"`
	Extra     map[string]any `json:"extra,omitempty"`
}

type RenderResult struct {
	Status    string    `json:"status"` // "rendered" | "error"
	Timestamp time.Time `json:"timestamp"`
	Element   any       `json:"element,omitempty"`
}

type HealthCheck struct {
	Name    string `json:"name"`
	Status  string `json:"status"` // "pass" | "fail"
	Message string `json:"message,omitempty"`
}

type HealthResult struct {
	Status    string        `json:"status"` // "healthy" | "degraded" | "unhealthy"
	Timestamp time.Time     `json:"timestamp"`
	Checks    []HealthCheck `json:"checks"`
}

type DescribeResult struct {
	Name         string         `json:"name"`
	Version      string         `json:"version"`
	Type         string         `json:"type"`
	Capabilities []string       `json:"capabilities"`
	Manifest     map[string]any `json:"manifest"`
}

type SchemaResult struct {
	Schema string `json:"schema"` // GraphQL SDL or JSON schema
	Format string `json:"format"` // "graphql" | "json" | "openapi"
}

type QueryResult struct {
	Data   any              `json:"data"`
	Errors []map[string]any `json:"errors,omitempty"`
}

type EmitResult struct {
	Emitted bool   `json:"emitted"`
	EventID string `json:"eventId,omitempty"`
}

// ---------------------------------------------------------------------------
// BaseMFE Interface  (the platform contract)
// ---------------------------------------------------------------------------

// BaseMFE is the interface every Go MFE must satisfy.
// A production SDK provides BaseMFEImpl to handle state and lifecycle;
// your MFE only needs to implement the Do* methods.
type BaseMFE interface {
	// Public capabilities — called by daemon/registry
	Load(ctx context.Context, mfeCtx MFEContext) (LoadResult, error)
	Render(ctx context.Context, mfeCtx MFEContext) (RenderResult, error)
	Refresh(ctx context.Context, mfeCtx MFEContext) error
	AuthorizeAccess(ctx context.Context, mfeCtx MFEContext) (bool, error)
	Health(ctx context.Context, mfeCtx MFEContext) (HealthResult, error)
	Describe(ctx context.Context, mfeCtx MFEContext) (DescribeResult, error)
	Schema(ctx context.Context, mfeCtx MFEContext) (SchemaResult, error)
	Query(ctx context.Context, mfeCtx MFEContext) (QueryResult, error)
	Emit(ctx context.Context, mfeCtx MFEContext) (EmitResult, error)

	// State access
	State() MFEState
}

// ---------------------------------------------------------------------------
// BaseMFEImpl  (embed this in your concrete MFE struct)
// ---------------------------------------------------------------------------

// BaseMFEImpl provides state management and lifecycle orchestration.
// Embed it in your concrete MFE and implement the DoXxx methods.
type BaseMFEImpl struct {
	mu       sync.RWMutex
	state    MFEState
	manifest map[string]any
	history  []map[string]any
}

// NewBaseMFEImpl creates a new base implementation with the given manifest.
func NewBaseMFEImpl(manifest map[string]any) BaseMFEImpl {
	return BaseMFEImpl{
		state:    StateUninitialized,
		manifest: manifest,
	}
}

// State returns the current lifecycle state.
func (b *BaseMFEImpl) State() MFEState {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.state
}

func (b *BaseMFEImpl) transition(to MFEState) error {
	b.mu.Lock()
	defer b.mu.Unlock()
	valid := validTransitions[b.state]
	for _, s := range valid {
		if s == to {
			b.history = append(b.history, map[string]any{
				"from": b.state, "to": to, "at": time.Now().UTC(),
			})
			b.state = to
			return nil
		}
	}
	return fmt.Errorf("invalid state transition: %s → %s (valid: %v)", b.state, to, valid)
}

func (b *BaseMFEImpl) assertState(allowed ...MFEState) error {
	b.mu.RLock()
	defer b.mu.RUnlock()
	for _, s := range allowed {
		if b.state == s {
			return nil
		}
	}
	return fmt.Errorf("invalid state: expected %v, got %s", allowed, b.state)
}

// ---------------------------------------------------------------------------
// CsvAnalyzerMFE  (concrete implementation — YOU fill in the Do* methods)
// ---------------------------------------------------------------------------

// CsvAnalyzerMFE implements the platform contract for CSV analysis.
// When the daemon calls Render(), this MFE produces its own HTML experience.
// Matches mfe-manifest.yaml in this directory.
type CsvAnalyzerMFE struct {
	BaseMFEImpl
}

// NewCsvAnalyzerMFE creates a new CSV analyzer MFE with the given manifest.
func NewCsvAnalyzerMFE(manifest map[string]any) *CsvAnalyzerMFE {
	return &CsvAnalyzerMFE{BaseMFEImpl: NewBaseMFEImpl(manifest)}
}

// -- Public capabilities (orchestrate lifecycle, delegate to Do* methods) --

func (m *CsvAnalyzerMFE) Load(ctx context.Context, mfeCtx MFEContext) (LoadResult, error) {
	if err := m.assertState(StateUninitialized, StateReady, StateError); err != nil {
		return LoadResult{}, err
	}
	if err := m.transition(StateLoading); err != nil {
		return LoadResult{}, err
	}
	result, err := m.DoLoad(ctx, mfeCtx)
	if err != nil {
		_ = m.transition(StateError)
		return LoadResult{}, err
	}
	_ = m.transition(StateReady)
	return result, nil
}

func (m *CsvAnalyzerMFE) Render(ctx context.Context, mfeCtx MFEContext) (RenderResult, error) {
	if err := m.assertState(StateReady); err != nil {
		return RenderResult{}, err
	}
	if err := m.transition(StateRendering); err != nil {
		return RenderResult{}, err
	}
	result, err := m.DoRender(ctx, mfeCtx)
	if err != nil {
		_ = m.transition(StateError)
		return RenderResult{}, err
	}
	_ = m.transition(StateReady)
	return result, nil
}

func (m *CsvAnalyzerMFE) Refresh(ctx context.Context, mfeCtx MFEContext) error {
	if err := m.assertState(StateReady); err != nil {
		return err
	}
	return m.DoRefresh(ctx, mfeCtx)
}

func (m *CsvAnalyzerMFE) AuthorizeAccess(ctx context.Context, mfeCtx MFEContext) (bool, error) {
	if err := m.assertState(StateReady); err != nil {
		return false, err
	}
	return m.DoAuthorizeAccess(ctx, mfeCtx)
}

func (m *CsvAnalyzerMFE) Health(ctx context.Context, mfeCtx MFEContext) (HealthResult, error) {
	return m.DoHealth(ctx, mfeCtx)
}

func (m *CsvAnalyzerMFE) Describe(ctx context.Context, mfeCtx MFEContext) (DescribeResult, error) {
	return m.DoDescribe(ctx, mfeCtx)
}

func (m *CsvAnalyzerMFE) Schema(ctx context.Context, mfeCtx MFEContext) (SchemaResult, error) {
	if err := m.assertState(StateReady); err != nil {
		return SchemaResult{}, err
	}
	return m.DoSchema(ctx, mfeCtx)
}

func (m *CsvAnalyzerMFE) Query(ctx context.Context, mfeCtx MFEContext) (QueryResult, error) {
	if err := m.assertState(StateReady); err != nil {
		return QueryResult{}, err
	}
	return m.DoQuery(ctx, mfeCtx)
}

func (m *CsvAnalyzerMFE) Emit(ctx context.Context, mfeCtx MFEContext) (EmitResult, error) {
	return m.DoEmit(ctx, mfeCtx)
}

// -- Do* methods — IMPLEMENT THESE in your MFE --

// DoLoad initializes the Go runtime (DB connections, config, etc.)
func (m *CsvAnalyzerMFE) DoLoad(ctx context.Context, mfeCtx MFEContext) (LoadResult, error) {
	// TODO: connect to database, warm caches, validate config
	return LoadResult{Status: "loaded", Timestamp: time.Now().UTC()}, nil
}

// DoRender produces this MFE's own experience — an HTML fragment the daemon
// relays back to the renderer. The renderer displays whatever the MFE returns;
// there is no fixed component type library.
func (m *CsvAnalyzerMFE) DoRender(ctx context.Context, mfeCtx MFEContext) (RenderResult, error) {
	// TODO: run real analysis on mfeCtx.Inputs["file"], then build the HTML
	capability, _ := mfeCtx.Inputs["capability"].(string)
	if capability == "" {
		capability = "DataAnalysis"
	}
	html := fmt.Sprintf(`<section class="csv-analysis" data-capability="%s">
  <h2>CSV Analysis</h2>
  <table class="results">
    <thead><tr><th>Column</th><th>Mean</th><th>Std Dev</th></tr></thead>
    <tbody><!-- rows populated by real analysis --></tbody>
  </table>
</section>`, capability)
	element := map[string]any{
		"contentType": "text/html",
		"output":      html,
	}
	return RenderResult{Status: "rendered", Timestamp: time.Now().UTC(), Element: element}, nil
}

// DoRefresh reloads fresh data without full re-initialization.
func (m *CsvAnalyzerMFE) DoRefresh(ctx context.Context, mfeCtx MFEContext) error {
	// TODO: refetch latest analysis results
	return nil
}

// DoAuthorizeAccess validates the JWT from mfeCtx.JWT.
// The daemon forwards the token from the renderer's sendAction call.
func (m *CsvAnalyzerMFE) DoAuthorizeAccess(ctx context.Context, mfeCtx MFEContext) (bool, error) {
	// TODO: decode JWT, verify signature, check claims
	// For local dev return true; production must verify against identity provider
	return mfeCtx.JWT != "", nil
}

// DoHealth checks liveness of all dependencies.
func (m *CsvAnalyzerMFE) DoHealth(ctx context.Context, mfeCtx MFEContext) (HealthResult, error) {
	// TODO: ping DB, check memory, check disk
	return HealthResult{
		Status:    "healthy",
		Timestamp: time.Now().UTC(),
		Checks:    []HealthCheck{{Name: "self", Status: "pass"}},
	}, nil
}

// DoDescribe returns the manifest stored by the Registry as component metadata.
func (m *CsvAnalyzerMFE) DoDescribe(ctx context.Context, mfeCtx MFEContext) (DescribeResult, error) {
	return DescribeResult{
		Name:    fmt.Sprintf("%v", m.manifest["name"]),
		Version: fmt.Sprintf("%v", m.manifest["version"]),
		Type:    fmt.Sprintf("%v", m.manifest["type"]),
		Capabilities: []string{
			"load", "render", "refresh", "authorizeAccess",
			"health", "describe", "schema", "query", "emit",
		},
		Manifest: m.manifest,
	}, nil
}

// DoSchema returns the GraphQL SDL for Registry introspection.
func (m *CsvAnalyzerMFE) DoSchema(ctx context.Context, mfeCtx MFEContext) (SchemaResult, error) {
	// TODO: return actual GraphQL SDL for this MFE's data surface
	return SchemaResult{
		Schema: `type Query { analysis(id: ID!): Analysis }
type Analysis { id: ID! rowCount: Int columnCount: Int }`,
		Format: "graphql",
	}, nil
}

// DoQuery executes a GraphQL query surfaced via Daemon Query.state.
func (m *CsvAnalyzerMFE) DoQuery(ctx context.Context, mfeCtx MFEContext) (QueryResult, error) {
	// TODO: execute mfeCtx.Inputs["query"] against this MFE's GraphQL schema
	return QueryResult{Data: map[string]any{"analysis": nil}}, nil
}

// DoEmit publishes an action up through Daemon sendAction → Registry handleMessage.
func (m *CsvAnalyzerMFE) DoEmit(ctx context.Context, mfeCtx MFEContext) (EmitResult, error) {
	// TODO: connect to daemon WebSocket and send sendAction mutation
	// ws.WriteJSON(map[string]any{"type": "sendAction", "payload": mfeCtx.Inputs})
	return EmitResult{Emitted: true, EventID: uuid.New().String()}, nil
}

// ---------------------------------------------------------------------------
// HTTP Server  (net/http stub — exposes each capability as an endpoint)
// Run: go run base_mfe.go
// ---------------------------------------------------------------------------

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}

func contextFromRequest(r *http.Request) MFEContext {
	var body map[string]any
	_ = json.NewDecoder(r.Body).Decode(&body)
	inputs, _ := body["inputs"].(map[string]any)
	if inputs == nil {
		inputs = make(map[string]any)
	}
	jwt := r.Header.Get("Authorization")
	if len(jwt) > 7 && jwt[:7] == "Bearer " {
		jwt = jwt[7:]
	}
	return NewContext(jwt, inputs)
}

func StartHTTPServer(mfe *CsvAnalyzerMFE, port int) {
	mux := http.NewServeMux()

	mux.HandleFunc("POST /load", func(w http.ResponseWriter, r *http.Request) {
		result, err := mfe.Load(r.Context(), contextFromRequest(r))
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, result)
	})

	mux.HandleFunc("POST /render", func(w http.ResponseWriter, r *http.Request) {
		result, err := mfe.Render(r.Context(), contextFromRequest(r))
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, result)
	})

	mux.HandleFunc("POST /refresh", func(w http.ResponseWriter, r *http.Request) {
		if err := mfe.Refresh(r.Context(), contextFromRequest(r)); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, map[string]bool{"refreshed": true})
	})

	mux.HandleFunc("POST /authorize", func(w http.ResponseWriter, r *http.Request) {
		ok, err := mfe.AuthorizeAccess(r.Context(), contextFromRequest(r))
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, map[string]bool{"authorized": ok})
	})

	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		result, err := mfe.Health(r.Context(), NewContext("", nil))
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, result)
	})

	mux.HandleFunc("GET /describe", func(w http.ResponseWriter, r *http.Request) {
		result, err := mfe.Describe(r.Context(), NewContext("", nil))
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, result)
	})

	mux.HandleFunc("GET /schema", func(w http.ResponseWriter, r *http.Request) {
		result, err := mfe.Schema(r.Context(), NewContext("", nil))
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, result)
	})

	mux.HandleFunc("POST /query", func(w http.ResponseWriter, r *http.Request) {
		result, err := mfe.Query(r.Context(), contextFromRequest(r))
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, result)
	})

	mux.HandleFunc("POST /emit", func(w http.ResponseWriter, r *http.Request) {
		result, err := mfe.Emit(r.Context(), contextFromRequest(r))
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, result)
	})

	addr := fmt.Sprintf(":%d", port)
	fmt.Printf("CSV Analyzer MFE (Go) running on http://localhost%s\n", addr)
	_ = http.ListenAndServe(addr, mux)
}
