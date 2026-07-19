/**
 * useDockingPhysics — engine-lifecycle regression tests.
 *
 * Guards the fix for the fatal render bug: the GameEngine (and its WebGL
 * context) must be created exactly once for a scenario and must NOT be torn
 * down/recreated when player input changes. Previously `input` was an effect
 * dependency, so `useInput`'s per-frame state churn disposed and recreated the
 * Babylon engine ~60×/second, exhausting the browser's WebGL-context budget and
 * leaving the canvas blank.
 */

import '@testing-library/jest-dom';
import React from 'react';
import { act, render } from '@testing-library/react';
import { DockingSimulation } from './DockingSimulation';

let constructCount = 0;
let disposeCount = 0;

jest.mock('./GameEngine', () => ({
  GameEngine: class {
    constructor() {
      constructCount += 1;
    }
    start(): void {}
    stop(): void {}
    dispose(): void {
      disposeCount += 1;
    }
    applyThrust(): void {}
    getState() {
      return {
        linearVelocity: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        position: { x: 0, y: 0, z: 0 },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
        fuel: 100,
        collisionCount: 0,
      };
    }
  },
}));

describe('useDockingPhysics engine lifecycle', () => {
  beforeEach(() => {
    constructCount = 0;
    disposeCount = 0;
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('constructs the GameEngine exactly once when the canvas mounts', () => {
    render(<DockingSimulation />);
    expect(constructCount).toBe(1);
  });

  it('does not recreate the engine when player input changes', () => {
    render(<DockingSimulation />);
    expect(constructCount).toBe(1);

    // Press a translation key and let the 60 FPS input poll flush several times,
    // then release it. Each transition changes the input object.
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
      jest.advanceTimersByTime(100);
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w' }));
      jest.advanceTimersByTime(100);
    });

    // Input churned, but the engine lifecycle is keyed only on canvas/ship/berth.
    expect(constructCount).toBe(1);
    expect(disposeCount).toBe(0);
  });

  it('disposes the engine on unmount', () => {
    const { unmount } = render(<DockingSimulation />);
    expect(constructCount).toBe(1);
    act(() => {
      unmount();
    });
    expect(disposeCount).toBe(1);
  });
});
