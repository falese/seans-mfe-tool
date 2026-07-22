/**
 * DockingSimulation — Main React component for the docking simulation MFE.
 * Renders Babylon canvas + neon HUD overlay with game state feedback.
 */

import React, { useRef, useState } from 'react';
import styled from 'styled-components';
import { useInput } from './useInput';
import { useDockingPhysics } from './useDockingPhysics';
import { Ship, Berth } from './GameEngine';

const Container = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  background: #0a0a0f;
  color: #0f0;
  font-family: 'Courier New', monospace;
  overflow: hidden;
`;

const Canvas = styled.canvas`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: block;
`;

const HUD = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 20px;
`;

const Reticle = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 80px;
  height: 80px;
  border: 2px solid #0f0;
  border-radius: 50%;
  pointer-events: none;

  &::before,
  &::after {
    content: '';
    position: absolute;
    background: #0f0;
  }

  &::before {
    width: 30px;
    height: 2px;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  &::after {
    width: 2px;
    height: 30px;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }
`;

const StatusPanel = styled.div`
  background: rgba(0, 15, 0, 0.8);
  border: 1px solid #0f0;
  padding: 12px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.6;
  text-shadow: 0 0 10px #0f0;
`;

const VelocityGauge = styled.div<{ $danger?: boolean }>`
  color: ${(p) => (p.$danger ? '#f00' : '#0f0')};
  text-shadow: ${(p) => (p.$danger ? '0 0 10px #f00' : '0 0 10px #0f0')};
`;

const ControlsHelp = styled(StatusPanel)`
  max-width: 300px;
  font-size: 11px;
  opacity: 0.7;
  align-self: flex-start;
  margin-bottom: auto;
`;

export interface DockingSimulationProps {
  ship?: Ship;
  berth?: Berth;
}

const DEFAULT_SHIP: Ship = {
  mass: 5000,
  rcsThrust: 1000,
  maxAngularVelocity: 1.0,
  maxLinearVelocity: 50,
};

const DEFAULT_BERTH: Berth = {
  centerPosition: { x: 0, y: 0, z: 500 },
  targetOrientation: { x: 0, y: 0, z: 0, w: 1 },
  dockingPortDimensions: { width: 10, height: 8 },
};

export const DockingSimulation: React.FC<DockingSimulationProps> = ({
  ship = DEFAULT_SHIP,
  berth = DEFAULT_BERTH,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showHelp, setShowHelp] = useState(true);
  const input = useInput();
  const gameState = useDockingPhysics({
    canvas: canvasRef.current,
    ship,
    berth,
    input,
  });

  const isDanger = gameState.relativeVelocity > 10 || gameState.distanceToDock < 5;

  return (
    <Container>
      <Canvas ref={canvasRef} />

      <HUD>
        {/* Top-left: Status info */}
        <StatusPanel>
          <div>DOCKING SIMULATION</div>
          <div>Phase: {gameState.phase.toUpperCase()}</div>
          <div>Time: {gameState.time.toFixed(1)}s</div>
          <VelocityGauge $danger={isDanger}>
            Velocity: {gameState.relativeVelocity.toFixed(2)} m/s
          </VelocityGauge>
          <div>Distance: {gameState.distanceToDock.toFixed(1)}m</div>
          <div>Fuel: {gameState.physics.fuel.toFixed(0)}%</div>
          <div>Collisions: {gameState.physics.collisionCount}</div>
        </StatusPanel>

        {/* Center: Reticle */}
        <Reticle />

        {/* Bottom-left: Controls */}
        {showHelp && (
          <ControlsHelp>
            <div>CONTROLS:</div>
            <div>W/A/S/D - Translate</div>
            <div>Q/E - Up/Down</div>
            <div>↑↓←→ - Pitch/Yaw</div>
            <div>Shift+← → - Roll</div>
            <div>Space - RCS Burst</div>
            <button
              onClick={() => setShowHelp(false)}
              style={{
                background: '#0f0',
                color: '#000',
                border: 'none',
                padding: '4px 8px',
                marginTop: '8px',
                cursor: 'pointer',
              }}
            >
              Hide
            </button>
          </ControlsHelp>
        )}

        {/* Bottom-right: Result */}
        {gameState.phase === 'success' && (
          <StatusPanel style={{ alignSelf: 'flex-end', color: '#0f0' }}>
            ✓ DOCKING SUCCESSFUL
            <div style={{ fontSize: '10px', marginTop: '4px' }}>
              Time: {gameState.time.toFixed(1)}s | Fuel: {gameState.physics.fuel.toFixed(0)}%
            </div>
          </StatusPanel>
        )}

        {gameState.phase === 'failure' && (
          <StatusPanel style={{ alignSelf: 'flex-end', color: '#f00' }}>
            ✗ DOCKING FAILED
            <div style={{ fontSize: '10px', marginTop: '4px' }}>
              {gameState.physics.collisionCount > 5 && 'Too many collisions'}
              {gameState.physics.fuel <= 0 && 'Out of fuel'}
              {gameState.time > 120 && 'Time limit exceeded'}
            </div>
          </StatusPanel>
        )}
      </HUD>
    </Container>
  );
};

export default DockingSimulation;
