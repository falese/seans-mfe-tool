/**
 * ErrorBoundary — REQ-RUNTIME-011
 *
 * React class component (must be class — function components cannot be error boundaries).
 * Wraps MFE component renders so component-level throws produce fallback UI instead of
 * a white screen.
 *
 * Also exports defaultFallbackHTML() for use in non-React runtimes (e.g. Angular).
 */

import React from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FallbackProps {
  error: Error;
  reset: () => void;
}

interface ErrorBoundaryProps {
  fallbackComponent?: React.ComponentType<FallbackProps>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  children?: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

// ---------------------------------------------------------------------------
// Default fallback (framework-free, also used by Angular path)
// ---------------------------------------------------------------------------

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function defaultFallbackHTML(error: Error): string {
  return `<div data-testid="mfe-error-fallback" style="padding:16px;background:#fff3f3;border:1px solid #f00;border-radius:4px;font-family:sans-serif;">
  <strong style="color:#c00;">Something went wrong</strong>
  <p style="margin:8px 0 0;color:#333;font-size:14px;">${escapeHTML(error.message)}</p>
</div>`;
}

function DefaultErrorFallback({ error, reset }: FallbackProps) {
  return (
    <div
      data-testid="mfe-error-fallback"
      style={{
        padding: '16px',
        background: '#fff3f3',
        border: '1px solid #f00',
        borderRadius: '4px',
        fontFamily: 'sans-serif',
      }}
    >
      <strong style={{ color: '#c00' }}>Something went wrong</strong>
      <p style={{ margin: '8px 0 0', color: '#333', fontSize: '14px' }}>{error.message}</p>
      <button onClick={reset} style={{ marginTop: '8px', cursor: 'pointer' }}>
        Retry
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ErrorBoundary class component
// ---------------------------------------------------------------------------

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
    this.reset = this.reset.bind(this);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.props.onError?.(error, errorInfo);
  }

  reset(): void {
    this.setState({ error: null });
  }

  render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    const Fallback = this.props.fallbackComponent ?? DefaultErrorFallback;
    return <Fallback error={error} reset={this.reset} />;
  }
}
