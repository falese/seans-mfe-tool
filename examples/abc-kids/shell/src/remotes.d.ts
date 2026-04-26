declare module 'abcKidsFlappy/App' {
  import React from 'react';
  const App: React.ComponentType<{ capability?: 'PlayGame' | 'ShowCover' | 'GetGameInfo' }>;
  export default App;
  export const PlayGame: React.ComponentType;
  export const ShowCover: React.ComponentType;
  export const GetGameInfo: React.ComponentType;
}

declare module 'abcKidsHockey/App' {
  import React from 'react';
  const App: React.ComponentType<{ capability?: 'PlayGame' | 'ShowCover' | 'GetGameInfo' }>;
  export default App;
  export const PlayGame: React.ComponentType;
  export const ShowCover: React.ComponentType;
  export const GetGameInfo: React.ComponentType;
}
