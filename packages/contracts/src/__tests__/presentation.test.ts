/**
 * Presentation handle contract tests (ADR-056) — the framework-neutral half
 * of the thin waist: guards plus the host/MFE negotiation primitive.
 */
import {
  assertPresentationHandles,
  isImperativeMountHandle,
  isNativeComponentHandle,
  selectHandle,
  type ImperativeMountHandle,
  type NativeComponentHandle,
  type PresentationHandles,
} from '../presentation';

const imperative: ImperativeMountHandle = {
  kind: 'imperative-dom',
  framework: 'react',
  mount: () => () => undefined,
};

const reactNative: NativeComponentHandle = {
  kind: 'react-component',
  framework: 'react',
  component: function C() {
    return null;
  },
};

const angularNative: NativeComponentHandle = {
  kind: 'angular-component',
  framework: 'angular',
  component: {},
};

const handles: PresentationHandles = { imperative, native: [reactNative, angularNative] };

describe('presentation handles (ADR-056)', () => {
  describe('isImperativeMountHandle', () => {
    it('accepts the imperative floor', () => {
      expect(isImperativeMountHandle(imperative)).toBe(true);
    });
    it.each([
      ['a native handle', reactNative],
      ['kind imperative-dom but no mount fn', { kind: 'imperative-dom' }],
      ['null', null],
    ])('rejects %s', (_label, value) => {
      expect(isImperativeMountHandle(value)).toBe(false);
    });
  });

  describe('isNativeComponentHandle', () => {
    it('accepts a framework-tagged component handle', () => {
      expect(isNativeComponentHandle(reactNative)).toBe(true);
    });
    it.each([
      ['the imperative handle', imperative],
      ['missing framework', { kind: 'react-component', component: {} }],
      ['missing component', { kind: 'react-component', framework: 'react' }],
      ['null', null],
    ])('rejects %s', (_label, value) => {
      expect(isNativeComponentHandle(value)).toBe(false);
    });
  });

  describe('assertPresentationHandles', () => {
    it('accepts a bundle with a callable imperative floor', () => {
      expect(() => assertPresentationHandles(handles)).not.toThrow();
      expect(() => assertPresentationHandles({ imperative })).not.toThrow();
    });
    it.each([
      ['null', null],
      ['missing imperative floor', { native: [reactNative] }],
      ['imperative without a mount fn', { imperative: { kind: 'imperative-dom' } }],
      ['native not an array', { imperative, native: reactNative }],
    ])('rejects %s (the floor is mandatory for polyglot composition)', (_label, value) => {
      expect(() => assertPresentationHandles(value)).toThrow();
    });
  });

  describe('selectHandle — boundary negotiation', () => {
    it('returns the matching-framework native handle (integration path)', () => {
      expect(selectHandle(handles, 'react')).toBe(reactNative);
      expect(selectHandle(handles, 'angular')).toBe(angularNative);
    });
    it('falls back to the imperative floor when no native match (isolation path)', () => {
      expect(selectHandle(handles, 'vue')).toBe(imperative);
      expect(selectHandle(handles, undefined)).toBe(imperative);
      expect(selectHandle({ imperative }, 'react')).toBe(imperative);
    });
  });
});
