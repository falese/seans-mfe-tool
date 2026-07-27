/**
 * Runtime React error boundary factory (ADR-044).
 *
 * A federated remote is mounted in its own React root, so a render-time throw
 * inside it cannot be caught by any error boundary in the host's React tree.
 * Wrapping the mounted component in this boundary contains the failure to the
 * remote's subtree and shows a fallback instead of tearing down the root.
 *
 * `React` is injected rather than imported so this module carries no React
 * dependency and stays unit-testable in a Node environment.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export type ErrorBoundaryHandler = (error: unknown, info: unknown) => void;

/** Which fallback ended up on screen — carried on the render-fallback telemetry. */
export type FallbackType = 'mfe-provided' | 'default';

const DEFAULT_FALLBACK_MESSAGE = 'This component failed to load.';

/** Read a human-usable message off anything that can be thrown. */
function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '';
}

/** Escape for interpolation into markup, including both quote styles. */
function escapeHTML(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * The default fallback as a markup string, for frameworks with no boundary
 * component to render into (Angular bootstraps into a host element, so its
 * only recovery is to replace that element's content).
 *
 * The message is escaped because it can carry upstream response text and this
 * string is assigned to innerHTML.
 */
export function defaultFallbackHTML(error?: unknown): string {
  const detail = messageOf(error);
  const body = detail ? `${DEFAULT_FALLBACK_MESSAGE} ${detail}` : DEFAULT_FALLBACK_MESSAGE;
  return `<div role="alert" class="mfe-error-boundary">${escapeHTML(body)}</div>`;
}

/**
 * Build an error-boundary class bound to the supplied React implementation.
 *
 * `Fallback`, when given, is a component the MFE itself exposed. It receives
 * the caught error as a prop, because an MFE that ships a fallback knows what
 * its own failure means in a way the built-in string cannot (ADR-044, #247).
 */
export function createErrorBoundary(
  React: any,
  onError?: ErrorBoundaryHandler,
  Fallback?: unknown,
): any {
  return class MFEErrorBoundary extends React.Component {
    constructor(props: any) {
      super(props);
      this.state = { hasError: false };
    }

    static getDerivedStateFromError(error?: unknown): { hasError: boolean; error?: unknown } {
      return error === undefined ? { hasError: true } : { hasError: true, error };
    }

    componentDidCatch(error: unknown, info: unknown): void {
      if (onError) {
        onError(error, info);
      }
    }

    render(): unknown {
      if (this.state.hasError) {
        if (Fallback) {
          return React.createElement(Fallback, { error: this.state.error });
        }
        return React.createElement(
          'div',
          { role: 'alert', className: 'mfe-error-boundary' },
          DEFAULT_FALLBACK_MESSAGE,
        );
      }
      return this.props.children;
    }
  };
}
