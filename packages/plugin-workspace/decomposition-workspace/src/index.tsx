/**
 * Standalone App Entry Point
 *
 * The decomposition workspace runs standalone (ADR-116 §7): `decompose:workspace`
 * serves this page with the BFF and the workspace API on one origin. All four
 * capabilities share one proposal here; a shell composes them one at a time.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { SystemError } from '@seans-mfe-tool/runtime';
import { WorkspaceLayout } from './features/workspace/WorkspaceLayout';

const container = document.getElementById('root');
if (!container) {
  throw new SystemError('Root element not found');
}

createRoot(container).render(
  <React.StrictMode>
    <WorkspaceLayout />
  </React.StrictMode>
);
