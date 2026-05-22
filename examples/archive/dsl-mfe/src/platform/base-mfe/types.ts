/**
 * Placeholder for a React (or other framework) component type.
 * Replace with the specific `React.ComponentType<Props>` once react types are installed.
 */
type ComponentType = (...args: any[]) => any;

// ---------------------------------------------------------------------------
// load — input / output types
// ---------------------------------------------------------------------------

export interface loadInputs {
  /** Optional configuration for initialization */
  config?: Record<string, unknown>;
}

export interface loadOutputs {
  /** Whether MFE successfully initialized */
  ready: boolean;
  /** Time taken to load in milliseconds */
  loadTime: number;
}

// ---------------------------------------------------------------------------
// render — input / output types
// ---------------------------------------------------------------------------

export interface renderInputs {
  /** DOM container for UI MFEs (null for backend MFEs) */
  container?: HTMLElement | null;
  /** Properties/parameters for rendering */
  props?: Record<string, unknown>;
}

export interface renderOutputs {
  /** React/Vue component for UI MFEs, JSON data for backend MFEs */
  rendered: ComponentType | Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// refresh — input / output types
// ---------------------------------------------------------------------------

export interface refreshInputs {
  /** Whether to perform full reload or incremental update */
  full?: boolean;
}

export interface refreshOutputs {
  /** Whether refresh succeeded */
  refreshed: boolean;
  /** When refresh completed */
  timestamp: Date;
}

// ---------------------------------------------------------------------------
// authorizeAccess — input / output types
// ---------------------------------------------------------------------------

export interface authorizeAccessInputs {
  /** JWT token to validate */
  token: string;
  /** Additional context for authorization decision */
  context?: Record<string, unknown>;
}

export interface authorizeAccessOutputs {
  /** Whether access is granted */
  authorized: boolean;
  /** List of granted permissions */
  permissions: any[];
}

// ---------------------------------------------------------------------------
// health — input / output types
// ---------------------------------------------------------------------------

export interface healthInputs {}

export interface healthOutputs {
  /** Overall health status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Detailed health information */
  details: Record<string, unknown>;
  /** When health check was performed */
  timestamp: Date;
}

// ---------------------------------------------------------------------------
// describe — input / output types
// ---------------------------------------------------------------------------

export interface describeInputs {}

export interface describeOutputs {
  /** Complete DSL document */
  dsl: Record<string, unknown>;
  /** Runtime metadata (uptime, version, etc) */
  runtime: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// schema — input / output types
// ---------------------------------------------------------------------------

export interface schemaInputs {}

export interface schemaOutputs {
  /** GraphQL schema in SDL format */
  schema: string;
}

// ---------------------------------------------------------------------------
// query — input / output types
// ---------------------------------------------------------------------------

export interface queryInputs {
  /** JWT for authorization */
  token: string;
  /** GraphQL query string */
  query: string;
  /** Query variables */
  variables?: Record<string, unknown>;
}

export interface queryOutputs {
  /** Query results */
  data: Record<string, unknown>;
  /** Any errors encountered */
  errors: any[];
}

// ---------------------------------------------------------------------------
// emit — input / output types
// ---------------------------------------------------------------------------

export interface emitInputs {
  /** Type of event being emitted */
  eventType: 'error' | 'metric' | 'trace' | 'log' | 'custom';
  /** Event payload (format varies by eventType) */
  eventData: Record<string, unknown>;
  /** Event severity level */
  severity?: 'debug' | 'info' | 'warn' | 'error' | 'critical';
  /** Additional tags for filtering/grouping */
  tags?: any[];
}

export interface emitOutputs {
  /** Whether event was successfully emitted */
  emitted: boolean;
  /** Unique identifier for emitted event */
  eventId: string;
}

// ---------------------------------------------------------------------------
// DataAnalysis — input / output types
// ---------------------------------------------------------------------------

export interface DataAnalysisInputs {}

export interface DataAnalysisOutputs {}

// ---------------------------------------------------------------------------
// ReportViewer — input / output types
// ---------------------------------------------------------------------------

export interface ReportViewerInputs {}

export interface ReportViewerOutputs {}

// ---------------------------------------------------------------------------
// DataAnalysisDetailed — input / output types
// ---------------------------------------------------------------------------

export interface DataAnalysisDetailedInputs {
  /** File to analyze */
  file: File;
  /** Type of analysis to perform */
  analysisType?: 'summary' | 'correlation' | 'regression';
}

export interface DataAnalysisDetailedOutputs {
  /** Analysis results */
  report: Record<string, unknown>;
  /** Analysis metadata */
  metadata: Record<string, unknown>;
}
