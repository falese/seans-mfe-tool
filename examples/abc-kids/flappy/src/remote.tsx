/**
 * Remote Entry Point
 * Exports all domain capabilities for Module Federation
 */
import { PlayGame } from './features/PlayGame/PlayGame';
import { ShowCover } from './features/ShowCover/ShowCover';
import { GetGameInfo } from './features/GetGameInfo/GetGameInfo';

export { PlayGame };
export { ShowCover };
export { GetGameInfo };

export { default } from './App';
