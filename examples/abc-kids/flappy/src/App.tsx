import React from 'react';
import { PlayGame } from './features/PlayGame/PlayGame';
import { ShowCover } from './features/ShowCover/ShowCover';
import { GetGameInfo } from './features/GetGameInfo/GetGameInfo';

interface AppProps {
  capability?: 'PlayGame' | 'ShowCover' | 'GetGameInfo';
}

const App: React.FC<AppProps> = ({ capability = 'PlayGame' }) => {
  switch (capability) {
    case 'ShowCover':   return <ShowCover />;
    case 'GetGameInfo': return <GetGameInfo />;
    default:            return <PlayGame />;
  }
};

export default App;
