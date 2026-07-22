/**
 * DockingSimulation Feature Tests
 */

import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { DockingSimulation } from './DockingSimulation';

// Babylon needs a real WebGL context, which jsdom lacks; stub the engine so the
// HUD/React layer can be exercised in isolation.
jest.mock('./GameEngine', () => ({
  GameEngine: class {
    start(): void {}
    stop(): void {}
    dispose(): void {}
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

describe('DockingSimulation', () => {
  it('renders the HUD without crashing', () => {
    render(<DockingSimulation />);
    expect(screen.getByText('DOCKING SIMULATION')).toBeInTheDocument();
  });

  // TODO: Add more tests based on capability inputs/outputs
});
