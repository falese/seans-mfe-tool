/**
 * useInput — React hook for WASD + arrow key input binding.
 * Captures keyboard events and provides a normalized 6DOF control vector.
 */

import { useEffect, useRef, useState } from 'react';

export interface InputState {
  translation: { x: number; y: number; z: number }; // WASD + Q/E
  rotation: { pitch: number; yaw: number; roll: number }; // Arrow keys
  thrust: number; // Space key intensity
}

export function useInput(): InputState {
  const [input, setInput] = useState<InputState>({
    translation: { x: 0, y: 0, z: 0 },
    rotation: { pitch: 0, yaw: 0, roll: 0 },
    thrust: 0,
  });

  const keysPressed = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysPressed.current[key] = true;

      // Prevent default for game keys to avoid scrolling, etc.
      if (['w', 'a', 's', 'd', 'q', 'e', ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysPressed.current[key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Poll input state at 60 FPS
    const inputPoll = setInterval(() => {
      const nextInput: InputState = {
        translation: { x: 0, y: 0, z: 0 },
        rotation: { pitch: 0, yaw: 0, roll: 0 },
        thrust: 0,
      };

      // Translation: WASD + Q/E
      if (keysPressed.current['w']) nextInput.translation.z += 1;
      if (keysPressed.current['s']) nextInput.translation.z -= 1;
      if (keysPressed.current['a']) nextInput.translation.x -= 1;
      if (keysPressed.current['d']) nextInput.translation.x += 1;
      if (keysPressed.current['q']) nextInput.translation.y -= 1;
      if (keysPressed.current['e']) nextInput.translation.y += 1;

      // Rotation: Arrow keys
      if (keysPressed.current['arrowup']) nextInput.rotation.pitch += 1;
      if (keysPressed.current['arrowdown']) nextInput.rotation.pitch -= 1;
      if (keysPressed.current['arrowleft']) nextInput.rotation.yaw += 1;
      if (keysPressed.current['arrowright']) nextInput.rotation.yaw -= 1;

      // Roll: Shift + arrow left/right (or separate keys)
      if (keysPressed.current['shift']) {
        if (keysPressed.current['arrowleft']) nextInput.rotation.roll -= 1;
        if (keysPressed.current['arrowright']) nextInput.rotation.roll += 1;
      }

      // Thrust: Space
      if (keysPressed.current[' ']) nextInput.thrust = 1;

      setInput(nextInput);
    }, 1000 / 60); // 60 FPS polling

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      clearInterval(inputPoll);
    };
  }, []);

  return input;
}
