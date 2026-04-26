import React, { useState } from 'react';
import Splash from './components/Splash';
import GameBrowser from './components/GameBrowser';
import GameLauncher from './components/GameLauncher';

type Screen = 'splash' | 'browser' | 'launcher';

export interface GameMeta {
  id: string;
  title: string;
  emoji: string;
  coverBg: string;
  desc: string;
  ageMin: number;
  ageMax: number;
  categories: string[];
  color: string;
}

const App: React.FC = () => {
  const [screen, setScreen] = useState<Screen>('splash');
  const [activeGame, setActiveGame] = useState<GameMeta | null>(null);

  const handleGameSelect = (game: GameMeta) => {
    setActiveGame(game);
    setScreen('launcher');
  };

  return (
    <>
      {screen === 'splash' && (
        <Splash onEnter={() => setScreen('browser')} />
      )}
      {(screen === 'browser' || screen === 'launcher') && (
        <GameBrowser onGameSelect={handleGameSelect} />
      )}
      {screen === 'launcher' && activeGame && (
        <GameLauncher
          game={activeGame}
          onClose={() => setScreen('browser')}
        />
      )}
    </>
  );
};

export default App;
