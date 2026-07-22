/** Minimal interface for the mfe instance exported by remote bootstraps */
interface RemoteMFEInstance {
  render(context: { requestId: string; timestamp: Date; inputs: { component: string; containerId: string; props?: Record<string, unknown> } }): Promise<{ status: string; component: string; element: unknown; duration: number }>;
  getState(): string;
  unmount(containerId: string): void;
}

declare module 'abcKidsFlappy/App' {
  import React from 'react';
  const App: React.ComponentType<{ capability?: 'PlayGame' | 'ShowCover' | 'GetGameInfo' }>;
  export default App;
  export const PlayGame: React.ComponentType;
  export const ShowCover: React.ComponentType;
  export const GetGameInfo: React.ComponentType;
  export const mfe: RemoteMFEInstance;
  export const mfeReady: Promise<void>;
}

declare module 'abcKidsHockey/App' {
  import React from 'react';
  const App: React.ComponentType<{ capability?: 'PlayGame' | 'ShowCover' | 'GetGameInfo' }>;
  export default App;
  export const PlayGame: React.ComponentType;
  export const ShowCover: React.ComponentType;
  export const GetGameInfo: React.ComponentType;
  export const mfe: RemoteMFEInstance;
  export const mfeReady: Promise<void>;
}

declare module 'abcKidsMultiplicationQuiz/App' {
  export const PlayGameComponent: any;
  export const ShowCoverComponent: any;
  export const GetGameInfoComponent: any;
  export const mfe: RemoteMFEInstance;
  export const mfeReady: Promise<void>;
}
