/**
 * Hockey MFE bootstrap
 *
 * Instantiates abckidshockeyMFE and calls load() so the full doLoad lifecycle
 * runs and its console logs are visible in the browser DevTools.
 *
 * This fires once when the Module Federation remote bundle is first imported
 * by the shell (i.e. when remote.tsx is evaluated).
 */
import { abckidshockeyMFE } from './mfe';

const manifest = {
  name: 'abc-kids-hockey',
  version: '1.0.0',
  type: 'remote' as const,
  description: 'Ice Hockey — move your paddle, score goals against the AI!',
  endpoint: 'http://localhost:3002',
  remoteEntry: 'http://localhost:3002/remoteEntry.js',
  capabilities: [
    { PlayGame: { type: 'domain', description: 'Play the Ice Hockey game on an HTML5 Canvas' } },
    {
      ShowCover: {
        type: 'domain',
        description: 'Show the Ice Hockey game cover card with title and art',
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

export const mfe = new abckidshockeyMFE(manifest);

export const mfeReady: Promise<void> = mfe
  .load({
    inputs: {
      remoteEntry: manifest.remoteEntry,
    },
  })
  .then((result) => {
    console.log(
      '[abckidshockeyMFE] bootstrap load() complete — status:',
      result.status,
      '— components:',
      result.availableComponents
    );
  })
  .catch((err) => {
    console.error('[abckidshockeyMFE] bootstrap load() failed:', err);
  });
