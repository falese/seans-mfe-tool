/**
 * Unit tests for the runtime React error boundary factory.
 *
 * The factory takes `React` as a parameter so it can be exercised without a
 * real React dependency — a minimal fake supplies Component + createElement.
 */
import { createErrorBoundary } from '../error-boundary';

class FakeComponent {
  props: Record<string, unknown>;
  state: Record<string, unknown> = {};
  constructor(props: Record<string, unknown>) {
    this.props = props;
  }
}

const FakeReact = {
  Component: FakeComponent,
  createElement: (type: unknown, props: unknown, ...children: unknown[]) => ({ type, props, children }),
};

describe('createErrorBoundary', () => {
  it('renders children when there is no error', () => {
    const Boundary = createErrorBoundary(FakeReact);
    const instance = new Boundary({ children: 'the-remote' });
    instance.state = { hasError: false };
    expect(instance.render()).toBe('the-remote');
  });

  it('flags an error via getDerivedStateFromError', () => {
    const Boundary = createErrorBoundary(FakeReact);
    expect(Boundary.getDerivedStateFromError()).toEqual({ hasError: true });
  });

  it('renders a fallback element when an error has occurred', () => {
    const Boundary = createErrorBoundary(FakeReact);
    const instance = new Boundary({ children: 'the-remote' });
    instance.state = { hasError: true };
    const rendered = instance.render() as { type: string; props: Record<string, unknown> };
    expect(rendered.type).toBe('div');
    expect(rendered.props).toMatchObject({ role: 'alert' });
  });

  it('invokes the onError callback from componentDidCatch', () => {
    const onError = jest.fn();
    const Boundary = createErrorBoundary(FakeReact, onError);
    const instance = new Boundary({ children: 'x' });
    const err = new Error('boom');
    instance.componentDidCatch(err, { componentStack: 'stack' });
    expect(onError).toHaveBeenCalledWith(err, { componentStack: 'stack' });
  });

  it('does not throw from componentDidCatch when no callback is supplied', () => {
    const Boundary = createErrorBoundary(FakeReact);
    const instance = new Boundary({ children: 'x' });
    expect(() => instance.componentDidCatch(new Error('boom'), {})).not.toThrow();
  });
});
