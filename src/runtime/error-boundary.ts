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

/**
 * Build an error-boundary class bound to the supplied React implementation.
 */
export function createErrorBoundary(React: any, onError?: ErrorBoundaryHandler): any {
  return class MFEErrorBoundary extends React.Component {
    constructor(props: any) {
      super(props);
      this.state = { hasError: false };
    }

    static getDerivedStateFromError(): { hasError: boolean } {
      return { hasError: true };
    }

    componentDidCatch(error: unknown, info: unknown): void {
      if (onError) {
        onError(error, info);
      }
    }

    render(): unknown {
      if (this.state.hasError) {
        return React.createElement(
          'div',
          { role: 'alert', className: 'mfe-error-boundary' },
          'This component failed to load.',
        );
      }
      return this.props.children;
    }
  };
}
