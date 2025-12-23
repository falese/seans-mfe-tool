/**
 * Orchestration Telemetry System
 *
 * Captures and aggregates telemetry events across multiple MFE instances.
 * Provides workflow-level tracing and cross-MFE event correlation.
 *
 * Part of Alpha Orchestration System (Phase 3)
 */

/**
 * Orchestration-level telemetry event
 *
 * Extends individual MFE telemetry with workflow tracking
 * and cross-MFE correlation capabilities.
 */
export interface OrchestrationTelemetryEvent {
  /** Event name/type */
  name: string;

  /** Workflow ID for cross-MFE tracing */
  workflowId?: string;

  /** Specific MFE identifier */
  mfeId?: string;

  /** Source of the event */
  sourceType?: 'orchestration' | 'mfe';

  /** Event metadata */
  metadata?: {
    /** Total MFEs in orchestration */
    totalMFEs?: number;

    /** Number of loaded MFEs */
    loadedCount?: number;

    /** Number of failed MFEs */
    failedCount?: number;

    /** Duration in milliseconds */
    duration?: number;

    /** Orchestration state */
    state?: string;

    /** Critical path MFE IDs */
    criticalPath?: string[];

    /** Additional metadata */
    [key: string]: unknown;
  };

  /** Event timestamp */
  timestamp: Date;
}

/**
 * Orchestration Telemetry Collector
 *
 * Manages telemetry events for multi-MFE orchestration operations.
 * Provides filtering, aggregation, and workflow-level tracing.
 */
export class OrchestrationTelemetry {
  private events: OrchestrationTelemetryEvent[] = [];

  /**
   * Emit a telemetry event
   *
   * @param event - Telemetry event to emit
   */
  emit(event: OrchestrationTelemetryEvent): void {
    const enrichedEvent: OrchestrationTelemetryEvent = {
      ...event,
      sourceType: event.sourceType || 'orchestration',
      timestamp: event.timestamp || new Date(),
    };

    this.events.push(enrichedEvent);
    this.logEvent(enrichedEvent);
  }

  /**
   * Get all captured events
   *
   * @returns Array of all telemetry events
   */
  getEvents(): OrchestrationTelemetryEvent[] {
    return [...this.events];
  }

  /**
   * Get events for a specific workflow
   *
   * @param workflowId - Workflow identifier
   * @returns Events belonging to the workflow
   */
  getEventsByWorkflow(workflowId: string): OrchestrationTelemetryEvent[] {
    return this.events.filter(e => e.workflowId === workflowId);
  }

  /**
   * Get events for a specific MFE
   *
   * @param mfeId - MFE identifier
   * @returns Events belonging to the MFE
   */
  getEventsByMFE(mfeId: string): OrchestrationTelemetryEvent[] {
    return this.events.filter(e => e.mfeId === mfeId);
  }

  /**
   * Get events by name pattern
   *
   * @param pattern - Event name pattern (supports wildcards)
   * @returns Matching events
   */
  getEventsByName(pattern: string): OrchestrationTelemetryEvent[] {
    const regex = new RegExp(pattern.replace('*', '.*'));
    return this.events.filter(e => regex.test(e.name));
  }

  /**
   * Get orchestration-level events only
   *
   * @returns Events emitted by orchestration runtime
   */
  getOrchestrationEvents(): OrchestrationTelemetryEvent[] {
    return this.events.filter(e => e.sourceType === 'orchestration');
  }

  /**
   * Get MFE-level events only
   *
   * @returns Events emitted by individual MFEs
   */
  getMFEEvents(): OrchestrationTelemetryEvent[] {
    return this.events.filter(e => e.sourceType === 'mfe');
  }

  /**
   * Clear all captured events
   */
  clear(): void {
    this.events = [];
  }

  /**
   * Get event count statistics
   *
   * @returns Event count by source type
   */
  getEventStats(): {
    total: number;
    orchestration: number;
    mfe: number;
    byWorkflow: Map<string, number>;
  } {
    const byWorkflow = new Map<string, number>();
    let orchestrationCount = 0;
    let mfeCount = 0;

    this.events.forEach(event => {
      if (event.sourceType === 'orchestration') {
        orchestrationCount++;
      } else if (event.sourceType === 'mfe') {
        mfeCount++;
      }

      if (event.workflowId) {
        byWorkflow.set(
          event.workflowId,
          (byWorkflow.get(event.workflowId) || 0) + 1
        );
      }
    });

    return {
      total: this.events.length,
      orchestration: orchestrationCount,
      mfe: mfeCount,
      byWorkflow,
    };
  }

  /**
   * Log event to console (development mode)
   *
   * @param event - Event to log
   */
  private logEvent(event: OrchestrationTelemetryEvent): void {
    if (process.env.NODE_ENV === 'development') {
      const prefix = event.sourceType === 'orchestration' ? '🎭' : '📦';
      const color = event.sourceType === 'orchestration' ? '#9C27B0' : '#2196F3';

      console.log(
        `%c${prefix} [${event.sourceType?.toUpperCase()}] ${event.name}`,
        `color: ${color}; font-weight: bold`,
        {
          workflowId: event.workflowId,
          mfeId: event.mfeId,
          metadata: event.metadata,
          timestamp: event.timestamp.toISOString(),
        }
      );
    }
  }
}
