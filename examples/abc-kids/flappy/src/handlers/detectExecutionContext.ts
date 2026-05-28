/**
 * Lifecycle handler — detect whether this MFE is running inside the shell
 * or standalone. Demonstrates ADR-040: declarative `source:` in the DSL
 * manifest pulls this implementation in via the generated handler registry.
 *
 * Decision rule: compare `window.location.origin` to the MFE's published
 * `remoteEntry` origin. They match in standalone mode (rspack-serve hosts
 * `demo.html` on the MFE's own port) and differ when federated into a
 * shell at a different origin.
 *
 * Result is written to the shared lifecycle context so downstream hooks
 * and the main capability body can branch on it. The user-visible boolean
 * is `context.isShellContext`:
 *   - true  → loaded inside a shell
 *   - false → loaded standalone (e.g. /demo.html on the MFE's own port)
 */
import type { Context } from '@seans-mfe-tool/runtime';

export async function detectExecutionContext(context: Context): Promise<void> {
  // Server-side / Node — neither shell nor standalone applies. Default to
  // standalone so downstream code that gates on "is shell" stays conservative.
  if (typeof window === 'undefined') {
    context.isShellContext = false;
    context.executionContext = 'server';
    return;
  }

  const currentUrl = window.location.href;
  const currentOrigin = window.location.origin;

  // The shell that hosts this MFE federates the remoteEntry from the MFE's
  // own origin. Whichever origin actually rendered the page is the truth:
  // if it matches the MFE's remoteEntry, the page IS the MFE; if it differs,
  // a shell loaded the MFE remotely.
  const remoteEntry = context.inputs?.remoteEntry as string | undefined;
  let mfeOrigin: string | undefined;
  if (remoteEntry) {
    try {
      mfeOrigin = new URL(remoteEntry).origin;
    } catch {
      // remoteEntry was provided but isn't a valid URL — fall through to
      // the path-based heuristic below.
    }
  }

  const isStandalone = mfeOrigin
    ? currentOrigin === mfeOrigin
    // Fallback when no remoteEntry is in context: the generated demo page
    // lives at /demo.html, so its presence indicates standalone mode.
    : window.location.pathname.endsWith('/demo.html');

  context.isShellContext = !isStandalone;
  context.currentUrl = currentUrl;
  context.executionContext = isStandalone ? 'standalone' : 'shell';

  console.log('[flappy][detectExecutionContext]', {
    currentUrl,
    currentOrigin,
    mfeOrigin,
    isShellContext: context.isShellContext,
    executionContext: context.executionContext,
  });
}
