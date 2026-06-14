/**
 * Standalone entry — renders the GameMenu home with a sample catalog so the MFE
 * can run in isolation (npm run dev). In the shell, the daemon supplies the
 * catalog and the host provides the slots. Generated — do not edit by hand.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { GameMenu } from './features/GameMenu/GameMenu';

const sample = [
  { id: 'flappy', title: 'Flappy', emoji: '🐤', color: '#0277bd' },
  { id: 'hockey', title: 'Hockey', emoji: '🏒', color: '#37474f' },
  { id: 'rocket-math', title: 'Rocket Math', emoji: '🚀', color: '#0d47a1' },
];

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element not found');
}
createRoot(container).render(
  <React.StrictMode>
    <GameMenu games={sample} />
  </React.StrictMode>
);
