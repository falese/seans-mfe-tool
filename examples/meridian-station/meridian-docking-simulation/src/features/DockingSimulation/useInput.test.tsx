/**
 * useInput — keyboard mapping tests.
 *
 * Validates that each control key maps to the correct 6DOF vector component,
 * that keyup clears it, and that Shift redirects the horizontal arrows from
 * yaw to roll (matching the on-screen controls help) rather than doing both.
 */

import { act, renderHook } from '@testing-library/react';
import { useInput } from './useInput';

function press(key: string): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key }));
}
function release(key: string): void {
  window.dispatchEvent(new KeyboardEvent('keyup', { key }));
}
function tick(): void {
  // Advance one 60 FPS poll so useInput samples keysPressed and emits state.
  act(() => {
    jest.advanceTimersByTime(1000 / 60);
  });
}

describe('useInput keyboard mapping', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();
  });

  it.each([
    ['w', 'translation', 'z', 1],
    ['s', 'translation', 'z', -1],
    ['a', 'translation', 'x', -1],
    ['d', 'translation', 'x', 1],
    ['q', 'translation', 'y', -1],
    ['e', 'translation', 'y', 1],
    ['ArrowUp', 'rotation', 'pitch', 1],
    ['ArrowDown', 'rotation', 'pitch', -1],
    ['ArrowLeft', 'rotation', 'yaw', 1],
    ['ArrowRight', 'rotation', 'yaw', -1],
  ] as const)('maps %s to %s.%s = %d', (key, group, axis, expected) => {
    const { result } = renderHook(() => useInput());
    act(() => press(key));
    tick();
    expect((result.current as any)[group][axis]).toBe(expected);
  });

  it('maps Space to thrust', () => {
    const { result } = renderHook(() => useInput());
    act(() => press(' '));
    tick();
    expect(result.current.thrust).toBe(1);
  });

  it('clears the input when the key is released', () => {
    const { result } = renderHook(() => useInput());
    act(() => press('w'));
    tick();
    expect(result.current.translation.z).toBe(1);
    act(() => release('w'));
    tick();
    expect(result.current.translation.z).toBe(0);
  });

  it('combines simultaneous keys into one vector', () => {
    const { result } = renderHook(() => useInput());
    act(() => {
      press('w');
      press('d');
      press(' ');
    });
    tick();
    expect(result.current.translation).toEqual({ x: 1, y: 0, z: 1 });
    expect(result.current.thrust).toBe(1);
  });

  it('redirects Shift+ArrowLeft to roll only (not yaw)', () => {
    const { result } = renderHook(() => useInput());
    act(() => {
      press('Shift');
      press('ArrowLeft');
    });
    tick();
    expect(result.current.rotation.roll).toBe(-1);
    expect(result.current.rotation.yaw).toBe(0);
  });

  it('redirects Shift+ArrowRight to roll only (not yaw)', () => {
    const { result } = renderHook(() => useInput());
    act(() => {
      press('Shift');
      press('ArrowRight');
    });
    tick();
    expect(result.current.rotation.roll).toBe(1);
    expect(result.current.rotation.yaw).toBe(0);
  });
});
