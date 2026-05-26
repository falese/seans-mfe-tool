/**
 * @jest-environment jsdom
 *
 * ErrorBoundary unit tests — REQ-RUNTIME-011
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary, defaultFallbackHTML } from '../ErrorBoundary';

// A component that throws on render when told to
function BrokenComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('render kaboom');
  return <div>ok</div>;
}

// Suppress React's console.error for expected error boundary catches
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('ErrorBoundary')) return;
    if (typeof args[0] === 'string' && args[0].includes('The above error')) return;
    originalConsoleError(...args);
  };
});
afterEach(() => {
  console.error = originalConsoleError;
});

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <BrokenComponent shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText('ok')).toBeDefined();
  });

  it('renders default fallback when child throws and no custom fallback provided', () => {
    render(
      <ErrorBoundary>
        <BrokenComponent shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.getByTestId('mfe-error-fallback')).toBeDefined();
    expect(screen.getByText(/render kaboom/i)).toBeDefined();
  });

  it('renders custom fallback component when child throws', () => {
    const CustomFallback = ({ error }: { error: Error; reset: () => void }) => (
      <div data-testid="custom-fallback">custom: {error.message}</div>
    );

    render(
      <ErrorBoundary fallbackComponent={CustomFallback}>
        <BrokenComponent shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.getByTestId('custom-fallback')).toBeDefined();
    expect(screen.getByText(/custom: render kaboom/i)).toBeDefined();
  });

  it('calls onError callback with the error when child throws', () => {
    const onError = jest.fn();
    render(
      <ErrorBoundary onError={onError}>
        <BrokenComponent shouldThrow />
      </ErrorBoundary>
    );
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0][0].message).toBe('render kaboom');
  });

  it('reset clears error state and re-renders children', () => {
    let triggerReset: (() => void) | undefined;
    const CustomFallback = ({ error, reset }: { error: Error; reset: () => void }) => {
      triggerReset = reset;
      return <button onClick={reset}>reset</button>;
    };

    const { rerender } = render(
      <ErrorBoundary fallbackComponent={CustomFallback}>
        <BrokenComponent shouldThrow />
      </ErrorBoundary>
    );

    expect(screen.getByText('reset')).toBeDefined();

    // Re-render with non-throwing component and trigger reset
    rerender(
      <ErrorBoundary fallbackComponent={CustomFallback}>
        <BrokenComponent shouldThrow={false} />
      </ErrorBoundary>
    );
    fireEvent.click(screen.getByText('reset'));
    expect(screen.getByText('ok')).toBeDefined();
  });
});

describe('defaultFallbackHTML', () => {
  it('returns an HTML string containing the error message', () => {
    const html = defaultFallbackHTML(new Error('something broke'));
    expect(html).toContain('something broke');
    expect(html).toContain('mfe-error-fallback');
  });

  it('escapes HTML in the error message', () => {
    const html = defaultFallbackHTML(new Error('<script>alert(1)</script>'));
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
