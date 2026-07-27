/**
 * Unit tests for the runtime React error boundary factory.
 *
 * The factory takes `React` as a parameter so it can be exercised without a
 * real React dependency — a minimal fake supplies Component + createElement.
 */
import { createErrorBoundary, defaultFallbackHTML } from '../error-boundary';

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

  /**
   * An MFE that ships its own fallback knows what its failure means; the
   * built-in string cannot ("This component failed to load" tells a user
   * nothing about a payments widget). #247.
   */
  describe('MFE-provided fallback', () => {
    const MfeFallback = (props: { error?: unknown }) => ({ mfeFallback: true, ...props });

    it('renders the supplied fallback instead of the built-in one', () => {
      const Boundary = createErrorBoundary(FakeReact, undefined, MfeFallback);
      const instance = new Boundary({ children: 'the-remote' });
      instance.state = { hasError: true };

      const rendered = instance.render() as { type: unknown };
      expect(rendered.type).toBe(MfeFallback);
    });

    it('hands the fallback the error it caught, for custom messaging', () => {
      const Boundary = createErrorBoundary(FakeReact, undefined, MfeFallback);
      const instance = new Boundary({ children: 'x' });
      const err = new Error('checkout unavailable');

      expect(Boundary.getDerivedStateFromError(err)).toEqual({ hasError: true, error: err });

      instance.state = { hasError: true, error: err };
      const rendered = instance.render() as { props: Record<string, unknown> };
      expect(rendered.props).toEqual({ error: err });
    });

    it('still renders children when nothing has failed', () => {
      const Boundary = createErrorBoundary(FakeReact, undefined, MfeFallback);
      const instance = new Boundary({ children: 'the-remote' });
      instance.state = { hasError: false };
      expect(instance.render()).toBe('the-remote');
    });

    it('falls back to the built-in element when no fallback is supplied', () => {
      const Boundary = createErrorBoundary(FakeReact);
      const instance = new Boundary({ children: 'x' });
      instance.state = { hasError: true };
      const rendered = instance.render() as { type: string };
      expect(rendered.type).toBe('div');
    });
  });

  /**
   * Angular has no boundary component to render into, so its fallback is a
   * markup string. Escaping is not cosmetic here: the error message can carry
   * upstream response text, and this string is assigned to innerHTML.
   */
  describe('defaultFallbackHTML', () => {
    it('produces an alert region with the default message', () => {
      const html = defaultFallbackHTML();
      expect(html).toContain('role="alert"');
      expect(html).toContain('This component failed to load.');
    });

    it('escapes markup in the error message rather than injecting it', () => {
      const html = defaultFallbackHTML(new Error('<img src=x onerror="alert(1)">'));
      expect(html).not.toContain('<img');
      expect(html).toContain('&lt;img');
      expect(html).toContain('&quot;');
    });

    it('accepts a non-Error throw without producing "undefined"', () => {
      const html = defaultFallbackHTML('just a string');
      expect(html).toContain('just a string');
      expect(html).not.toContain('undefined');
    });
  });
});
