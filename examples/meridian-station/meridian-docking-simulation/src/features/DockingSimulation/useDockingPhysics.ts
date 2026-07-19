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
const DOCKING_RANGE = 40; // within this range the HUD reads "docking", else "approach"
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

  // Latest input/callback are read through refs so the game loop always sees
  // fresh values WITHOUT being a dependency of the engine effect. `useInput`
  // emits a new object on every change; if `input` were an effect dependency
  // the GameEngine (and its WebGL context) would be disposed and recreated on
  // every keystroke/frame — the browser's WebGL-context cap is hit almost
  // immediately and the scene never renders.
  const inputRef = useRef<InputState>(input);
  inputRef.current = input;
  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;

  // Initialize GameEngine. Keyed only on canvas + the simulation inputs (ship,
  // berth); the engine is created exactly once per docking scenario.
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

    // Game-state loop: reads engine physics, applies input, updates React state.
    const renderInterval = setInterval(() => {
      if (!engineRef.current) return;

      const physicsState = engineRef.current.getState();
      const elapsed = (Date.now() - startTimeRef.current) / 1000;

      // Player has full manual RCS control from t=0 — the ship spawns at an
      // approach standoff with the berth already framed. Read input live from
      // the ref (never a closed-over value) so the engine effect never restarts.
      const currentInput = inputRef.current;
      const thrustMagnitude = Math.max(
        Math.abs(currentInput.translation.x),
        Math.abs(currentInput.translation.y),
        Math.abs(currentInput.translation.z),
        Math.abs(currentInput.rotation.pitch),
        Math.abs(currentInput.rotation.yaw),
        Math.abs(currentInput.rotation.roll),
        currentInput.thrust,
      );

      const thrustVector = [
        currentInput.translation.x,
        currentInput.translation.y,
        currentInput.translation.z,
        currentInput.rotation.pitch,
        currentInput.rotation.yaw,
        currentInput.rotation.roll,
      ];

      if (thrustMagnitude > 0) {
        engineRef.current.applyThrust(thrustVector, thrustMagnitude);
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

      // Phase is a HUD label driven by range: close in = 'docking', else 'approach'.
      let phase: DockingGameState['phase'] =
        distanceToDock <= DOCKING_RANGE ? 'docking' : 'approach';

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
      onStateChangeRef.current?.(nextState);
    }, 1000 / 60); // 60 FPS

    return () => {
      clearInterval(renderInterval);
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
    };
    // `input`/`onStateChange` are intentionally excluded — they are read through
    // refs so the engine is created once and lives for the scenario's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas, ship, berth]);

  return gameState;
}
