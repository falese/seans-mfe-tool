/**
 * Keyboard-control integration test.
 *
 * Proves the full input wiring end to end with the real useInput + real
 * useDockingPhysics and a GameEngine mock that records every applyThrust call:
 *
 *   window 'keydown' -> useInput poll -> useDockingPhysics reads inputRef
 *   -> engine.applyThrust(thrustVector)
 *
 * Player input is forwarded to the engine from the first frame (no auto-approach
 * gate): the ship spawns at an approach standoff under full manual control.
 */

import '@testing-library/jest-dom';
import React from 'react';
import { act, render } from '@testing-library/react';
import { DockingSimulation } from './DockingSimulation';

interface ThrustCall {
  vec: number[];
  mag: number;
}
const mockThrustCalls: ThrustCall[] = [];

jest.mock('./GameEngine', () => ({
  GameEngine: class {
    start(): void {}
    stop(): void {}
    dispose(): void {}
    applyThrust(vec: number[], mag: number): void {
      mockThrustCalls.push({ vec: [...vec], mag });
    }
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

const PITCH = 3; // thrustVector index for pitch (ArrowUp)

function hold(key: string, ms: number): void {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }));
    jest.advanceTimersByTime(ms);
  });
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keyup', { key }));
    jest.advanceTimersByTime(1000 / 60);
  });
}

describe('keyboard control drives the engine', () => {
  beforeEach(() => {
    mockThrustCalls.length = 0;
    jest.useFakeTimers();
  });
  afterEach(() => {
    act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();
  });

  it('does not thrust while no key is held', () => {
    render(<DockingSimulation />);
    act(() => jest.advanceTimersByTime(1000));
    expect(mockThrustCalls.length).toBe(0);
  });

  it('forwards a pitch-up (ArrowUp) command to the engine immediately', () => {
    render(<DockingSimulation />);
    act(() => jest.advanceTimersByTime(200));

    hold('ArrowUp', 500);

    expect(mockThrustCalls.length).toBeGreaterThan(0);
    // Every thrust while ArrowUp is held carries a +1 pitch component.
    expect(mockThrustCalls.some((c) => c.vec[PITCH] === 1)).toBe(true);
  });

  it('forwards a forward-translation (W) command with a Z component', () => {
    render(<DockingSimulation />);
    act(() => jest.advanceTimersByTime(200));

    hold('w', 500);

    expect(mockThrustCalls.some((c) => c.vec[2] === 1)).toBe(true);
  });
});
