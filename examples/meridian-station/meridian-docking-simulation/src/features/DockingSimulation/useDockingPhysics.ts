/**
 * useDockingPhysics — React hook for 6DOF physics integration.
 * Connects input to GameEngine and manages game state (fuel, collisions, success/failure).
 */

import { useEffect, useRef, useState } from 'react';
import { GameEngine, GameEngineConfig, PhysicsState, Ship, Berth } from './GameEngine';
import { InputState } from './useInput';

export interface DockingGameState {
  phase: 'approach' | 'docking' | 'success' | 'failure' | 'idle';
  physics: PhysicsState;
  distanceToDock: number;
  alignmentError: { position: number; orientation: number };
  relativeVelocity: number;
  time: number;
}

export interface UseDockingPhysicsProps {
  canvas: HTMLCanvasElement | null;
  ship: Ship;
  berth: Berth;
  input: InputState;
  onStateChange?: (state: DockingGameState) => void;
}

const APPROACH_DISTANCE = 500; // meters
const DOCKING_SUCCESS_DISTANCE = 1.0; // meters
const DOCKING_SUCCESS_ORIENTATION = 10 * (Math.PI / 180); // 10 degrees
const DOCKING_SUCCESS_VELOCITY = 0.5; // m/s
const MAX_COLLISIONS_ALLOWED = 5;
const MAX_TIME = 120; // seconds

export function useDockingPhysics({
  canvas,
  ship,
  berth,
  input,
  onStateChange,
}: UseDockingPhysicsProps): DockingGameState {
  const engineRef = useRef<GameEngine | null>(null);
  const [gameState, setGameState] = useState<DockingGameState>({
    phase: 'approach',
    physics: {
      linearVelocity: { x: 0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      position: { x: 0, y: 0, z: -APPROACH_DISTANCE },
      orientation: { x: 0, y: 0, z: 0, w: 1 },
      fuel: 100,
      collisionCount: 0,
    },
    distanceToDock: APPROACH_DISTANCE,
    alignmentError: { position: 0, orientation: 0 },
    relativeVelocity: 0,
    time: 0,
  });

  const startTimeRef = useRef<number>(Date.now());
  const approachCompleteRef = useRef<boolean>(false);

  // Initialize GameEngine
  useEffect(() => {
    if (!canvas) return;

    const config: GameEngineConfig = {
      canvas,
      ship,
      berth,
    };

    engineRef.current = new GameEngine(config);
    engineRef.current.start();
    startTimeRef.current = Date.now();
    approachCompleteRef.current = false;

    // Render loop
    const renderInterval = setInterval(() => {
      if (!engineRef.current) return;

      const physicsState = engineRef.current.getState();
      const elapsed = (Date.now() - startTimeRef.current) / 1000;

      // Auto-approach phase (first 30 sec)
      let phase: DockingGameState['phase'] = 'approach';
      if (elapsed < 30 && !approachCompleteRef.current) {
        // Move ship toward berth automatically (apply thrust along Z axis)
        const autoApproachThrust = [0, 0, 1, 0, 0, 0]; // Forward thrust
        engineRef.current.applyThrust(autoApproachThrust, 0.3);
      } else if (elapsed >= 30) {
        approachCompleteRef.current = true;
        phase = 'docking';

        // Apply player input
        const thrustMagnitude = Math.max(
          Math.abs(input.translation.x),
          Math.abs(input.translation.y),
          Math.abs(input.translation.z),
          Math.abs(input.rotation.pitch),
          Math.abs(input.rotation.yaw),
          Math.abs(input.rotation.roll),
          input.thrust,
        );

        const thrustVector = [
          input.translation.x,
          input.translation.y,
          input.translation.z,
          input.rotation.pitch,
          input.rotation.yaw,
          input.rotation.roll,
        ];

        if (thrustMagnitude > 0) {
          engineRef.current.applyThrust(thrustVector, thrustMagnitude);
        }
      }

      // Calculate metrics
      const distanceToDock = Math.sqrt(
        (physicsState.position.x - berth.centerPosition.x) ** 2 +
        (physicsState.position.y - berth.centerPosition.y) ** 2 +
        (physicsState.position.z - berth.centerPosition.z) ** 2,
      );

      const relativeVelocity = Math.sqrt(
        physicsState.linearVelocity.x ** 2 +
        physicsState.linearVelocity.y ** 2 +
        physicsState.linearVelocity.z ** 2,
      );

      // Check for success
      if (
        distanceToDock < DOCKING_SUCCESS_DISTANCE &&
        relativeVelocity < DOCKING_SUCCESS_VELOCITY &&
        physicsState.collisionCount <= 2
      ) {
        phase = 'success';
      }

      // Check for failure
      if (
        physicsState.collisionCount > MAX_COLLISIONS_ALLOWED ||
        physicsState.fuel <= 0 ||
        elapsed > MAX_TIME
      ) {
        phase = 'failure';
      }

      const nextState: DockingGameState = {
        phase,
        physics: physicsState,
        distanceToDock,
        alignmentError: { position: 0, orientation: 0 }, // TODO: calculate proper alignment
        relativeVelocity,
        time: elapsed,
      };

      setGameState(nextState);
      onStateChange?.(nextState);
    }, 1000 / 60); // 60 FPS

    return () => {
      clearInterval(renderInterval);
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
    };
  }, [canvas, ship, berth, input, onStateChange]);

  return gameState;
}
