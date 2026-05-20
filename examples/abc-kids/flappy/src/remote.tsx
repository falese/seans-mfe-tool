/**
 * Remote Entry Point
 * Exports all domain capabilities for Module Federation
 * Generated from mfe-manifest.yaml
 */
import './platform/base-mfe/bootstrap';

import React from 'react';
import { PlayGame } from './features/PlayGame/PlayGame.tsx';
import { ShowCover } from './features/ShowCover/ShowCover.tsx';
import { GetGameInfo } from './features/GetGameInfo/GetGameInfo.tsx';

export { PlayGame };
export { ShowCover };
export { GetGameInfo };

export { default } from './App.tsx';
