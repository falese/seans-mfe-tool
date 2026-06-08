/**
 * Remote Entry Point
 * Exports all domain capabilities for Module Federation
 * Generated from mfe-manifest.yaml
 */
import './platform/base-mfe/bootstrap';

import React from 'react';
import { InnerVoice } from './features/InnerVoice/InnerVoice.tsx';

export { InnerVoice };

export { mfe, mfeReady } from './platform/base-mfe/bootstrap';
export { default } from './App.tsx';
