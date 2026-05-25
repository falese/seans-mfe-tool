/**
 * Framework plugin resolution (ADR-071, #169).
 *
 * Loads a concrete BaseFrameworkPlugin by framework name.
 * No custom registry — uses require() + instanceof check.
 */

import { BaseFrameworkPlugin, ValidationError } from '@seans-mfe/contracts';

/**
 * Resolve a framework name to its concrete BaseFrameworkPlugin instance.
 *
 * @param framework - Framework name matching a manifest `framework` field (e.g. 'react', 'angular').
 * @returns The singleton plugin instance exported by `@seans-mfe/framework-<name>`.
 * @throws ValidationError if the package is not installed or exports an invalid plugin.
 */
export function loadFrameworkPlugin(framework: string): BaseFrameworkPlugin {
  const packageName = `@seans-mfe/framework-${framework}`;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(packageName);
    const plugin: unknown = mod.frameworkPlugin ?? mod.default;

    if (!(plugin instanceof BaseFrameworkPlugin)) {
      throw new ValidationError(
        `${packageName} does not export a valid BaseFrameworkPlugin instance`,
        'framework',
        framework,
      );
    }

    return plugin;
  } catch (err: unknown) {
    if (err instanceof ValidationError) throw err;

    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'MODULE_NOT_FOUND') {
      throw new ValidationError(
        `Framework "${framework}" is not available. Install the plugin:\n` +
          `  npm install ${packageName}`,
        'framework',
        framework,
      );
    }

    throw err;
  }
}
