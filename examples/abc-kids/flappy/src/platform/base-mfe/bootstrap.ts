/**
 * Flappy MFE bootstrap
 *
 * Instantiates abckidsflappyMFE and calls load() so the full doLoad lifecycle
 * runs and its console logs are visible in the browser DevTools.
 *
 * This fires once when the Module Federation remote bundle is first imported
 * by the shell (i.e. when remote.tsx is evaluated).
 */
import { abckidsflappyMFE } from './mfe';

const manifest = {
  name: 'abc-kids-flappy',
  version: '1.0.0',
  type: 'remote' as const,
  description: 'Flappy Bird — tap to flap, avoid pipes, keep score!',
  endpoint: 'http://localhost:3001',
  remoteEntry: 'http://localhost:3001/remoteEntry.js',
  capabilities: [
    { PlayGame: { type: 'domain', description: 'Play the Flappy Bird game on an HTML5 Canvas' } },
    {
      ShowCover: {
        type: 'domain',
        description: 'Show the Flappy Bird game cover card with title and art',
      },
    },
    {
      GetGameInfo: {
        type: 'domain',
        description: 'Return game metadata including title, age range, and description',
      },
    },
    {
      Load: {
        type: 'platform',
        lifecycle: {
          before: [
            { onLoadBegin: { handler: 'onLoadBegin', description: 'Log load lifecycle entry' } },
          ],
          after: [
            {
              onLoadComplete: {
                handler: 'onLoadComplete',
                description: 'Log load success and available components',
              },
            },
          ],
          error: [
            {
              onLoadError: {
                handler: 'onLoadError',
                contained: true,
                description: 'Log load failure',
              },
            },
          ],
        },
      },
    },
    {
      Render: {
        type: 'platform',
        lifecycle: {
          before: [
            {
              onRenderBegin: {
                handler: 'onRenderBegin',
                description: 'Log render lifecycle entry',
              },
            },
          ],
          after: [
            {
              onRenderComplete: { handler: 'onRenderComplete', description: 'Log render success' },
            },
          ],
          error: [
            {
              onRenderError: {
                handler: 'onRenderError',
                contained: true,
                description: 'Log render failure',
              },
            },
          ],
        },
      },
    },
  ],
};

const mfe = new abckidsflappyMFE(manifest);

export const mfeReady: Promise<void> = mfe
  .load({
    inputs: {
      remoteEntry: manifest.remoteEntry,
    },
  })
  .then((result) => {
    console.log(
      '[abckidsflappyMFE] bootstrap load() complete — status:',
      result.status,
      '— components:',
      result.availableComponents
    );
  })
  .catch((err) => {
    console.error('[abckidsflappyMFE] bootstrap load() failed:', err);
  });
