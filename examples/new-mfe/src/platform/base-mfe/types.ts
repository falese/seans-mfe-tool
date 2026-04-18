

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
  config?: Record&lt;string, unknown&gt;;

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

  /** DOM container for UI rendering */
  container?: HTMLElement | null;

  /** Properties for rendering */
  props?: Record&lt;string, unknown&gt;;

}

export interface renderOutputs {

  /** React component or JSON data */
  rendered: ComponentType | Record&lt;string, unknown&gt;;

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
  token?: string;

  /** Additional context for authorization decision */
  context?: Record&lt;string, unknown&gt;;

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

export interface healthInputs {

}

export interface healthOutputs {

  /** Overall health status */
  status: string;

  /** Detailed health information */
  details: Record&lt;string, unknown&gt;;

  /** When health check was performed */
  timestamp: Date;

}

// ---------------------------------------------------------------------------
// describe — input / output types
// ---------------------------------------------------------------------------

export interface describeInputs {

}

export interface describeOutputs {

  /** Complete DSL document */
  dsl: Record&lt;string, unknown&gt;;

  /** Runtime metadata (uptime, version, etc) */
  runtime: Record&lt;string, unknown&gt;;

}

// ---------------------------------------------------------------------------
// schema — input / output types
// ---------------------------------------------------------------------------

export interface schemaInputs {

}

export interface schemaOutputs {

  /** GraphQL schema in SDL format */
  schema: string;

}

// ---------------------------------------------------------------------------
// query — input / output types
// ---------------------------------------------------------------------------

export interface queryInputs {

  /** JWT for authorization */
  token?: string;

  /** GraphQL query string */
  query?: string;

  /** Query variables */
  variables?: Record&lt;string, unknown&gt;;

}

export interface queryOutputs {

  /** Query results */
  data: Record&lt;string, unknown&gt;;

  /** Any errors encountered */
  errors: any[];

}

// ---------------------------------------------------------------------------
// emit — input / output types
// ---------------------------------------------------------------------------

export interface emitInputs {

  /** Type of event being emitted */
  eventType?: &#39;error&#39; | &#39;metric&#39; | &#39;trace&#39; | &#39;log&#39; | &#39;custom&#39;;

  /** Event payload */
  eventData?: Record&lt;string, unknown&gt;;

  /** Event severity level */
  severity?: &#39;debug&#39; | &#39;info&#39; | &#39;warn&#39; | &#39;error&#39; | &#39;critical&#39;;

}

export interface emitOutputs {

  /** Whether event was successfully emitted */
  emitted: boolean;

  /** Unique identifier for emitted event */
  eventId: string;

}

// ---------------------------------------------------------------------------
// UpdateControlPlaneState — input / output types
// ---------------------------------------------------------------------------

export interface UpdateControlPlaneStateInputs {

  /** Domain state to push to the registry */
  state?: Record&lt;string, unknown&gt;;

  /** JWT for authorization */
  token?: string;

}

export interface UpdateControlPlaneStateOutputs {

  /** Whether the registry accepted the state update */
  accepted: boolean;

  /** The MFE the registry resolved to after re-evaluation */
  nextMfe: Record&lt;string, unknown&gt;;

}

// ---------------------------------------------------------------------------
// UserProfile — input / output types
// ---------------------------------------------------------------------------

export interface UserProfileInputs {

  /** ID of the user whose profile to display */
  userId?: string;

  /** Whether to render in edit mode */
  editable?: boolean;

}

export interface UserProfileOutputs {

  /** Rendered profile component or profile data */
  profile: Record&lt;string, unknown&gt;;

}

