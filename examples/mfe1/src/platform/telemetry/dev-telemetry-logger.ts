/**
 * Development Telemetry Logger
 * Shows load capability telemetry in browser DevTools console
 * Only active in development mode (process.env.NODE_ENV === 'development')
 */

export interface TelemetryEvent {
  name: string;
  capability: string;
  phase: string;
  status: string;
  metadata?: Record<string, unknown>;
  duration?: number;
  timestamp: Date;
}

/**
 * Development telemetry logger for browser console
 * Shows load capability telemetry in a readable, color-coded format
 */
export class DevTelemetryLogger {
  private events: TelemetryEvent[] = [];
  private loadStartTime: number | null = null;

  emit(event: TelemetryEvent): void {
    this.events.push(event);

    // Pretty-print load events
    if (event.capability === 'load') {
      this.logLoadEvent(event);
    }
  }

  private logLoadEvent(event: TelemetryEvent): void {
    const { name, phase, status, metadata, duration } = event;

    // Track load start
    if (phase === 'entry' && status === 'start') {
      this.loadStartTime = Date.now();
      console.group('%c🚀 Load Capability Started', 'color: #4CAF50; font-weight: bold; font-size: 14px');
      console.log('%cADR-060 Three-Phase Load', 'color: #757575; font-style: italic');
    }

    // Phase start telemetry
    if (status === 'start') {
      const color = this.getPhaseColor(phase);
      console.log(
        `%c▶ Starting ${phase} phase...`,
        `color: ${color}; font-weight: bold`
      );
    }

    // Phase completion telemetry
    if (name.endsWith('-metric') && duration !== undefined) {
      const color = this.getPhaseColor(phase);
      console.log(
        `%c✓ ${phase} phase: ${duration}ms`,
        `color: ${color}; font-weight: bold`,
        { metadata }
      );
    }

    // Retry events
    if (name === 'lifecycle.error.retry') {
      console.warn(
        `%c⟳ Retry attempt ${metadata?.attempt}/${metadata?.maxRetries}`,
        'color: #FF9800; font-weight: bold',
        {
          previousError: metadata?.previousError,
          handler: metadata?.handler
        }
      );
    }

    // Backoff events
    if (name === 'lifecycle.error.backoff') {
      console.log(
        `%c⏱ Backoff delay: ${metadata?.delay}ms (${metadata?.backoff})`,
        'color: #FF9800; font-style: italic',
        { attempt: metadata?.attempt }
      );
    }

    // Error classification events
    if (name === 'lifecycle.error.classified') {
      const retryable = metadata?.retryable ? '✓ Retryable' : '✗ Non-retryable';
      console.log(
        `%c🔍 Error classified: ${metadata?.errorType} (${retryable})`,
        'color: #9C27B0; font-weight: bold'
      );
    }

    // Load completion
    if (name === 'load-completed' || (phase === 'enable_render' && status === 'end')) {
      const totalTime = this.loadStartTime ? Date.now() - this.loadStartTime : duration || 0;
      console.log(
        `%c✓ Load completed in ${totalTime}ms`,
        'color: #4CAF50; font-weight: bold; font-size: 14px'
      );

      // Show performance breakdown
      this.logPerformanceBreakdown();
      console.groupEnd();

      // Reset for next load
      this.loadStartTime = null;
    }

    // Load error
    if (name === 'load-error' || status === 'error') {
      console.error(
        `%c✗ Load failed at ${metadata?.failedPhase || phase} phase`,
        'color: #F44336; font-weight: bold; font-size: 14px',
        {
          error: metadata?.error,
          retryable: metadata?.retryable,
          retryCount: metadata?.retryCount
        }
      );
      console.groupEnd();

      // Reset for next load
      this.loadStartTime = null;
    }
  }

  private logPerformanceBreakdown(): void {
    const phases = ['entry', 'mount', 'enable_render'];
    const metrics = phases.map(phase => {
      const metricEvent = this.events.find(e =>
        e.phase === phase && (e.name.endsWith('-metric') || e.status === 'end')
      );
      return { phase, duration: metricEvent?.duration || 0 };
    });

    const total = metrics.reduce((sum, m) => sum + m.duration, 0);

    if (total === 0) return;

    console.log('%c📊 Performance Breakdown', 'color: #2196F3; font-weight: bold; margin-top: 8px');
    console.table(
      metrics.map(m => ({
        Phase: m.phase,
        Duration: `${m.duration}ms`,
        Percentage: `${total > 0 ? ((m.duration / total) * 100).toFixed(1) : 0}%`
      }))
    );
  }

  private getPhaseColor(phase: string): string {
    const colors: Record<string, string> = {
      entry: '#2196F3',
      mount: '#9C27B0',
      enable_render: '#FF5722',
      before: '#FFC107',
      after: '#4CAF50',
      error: '#F44336'
    };
    return colors[phase] || '#757575';
  }

  /**
   * Get all captured events
   */
  getAllEvents(): TelemetryEvent[] {
    return [...this.events];
  }

  /**
   * Clear all captured events
   */
  clear(): void {
    this.events = [];
    this.loadStartTime = null;
  }
}
