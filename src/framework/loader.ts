/**
 * Framework plugin resolution (ADR-036, #169).
 *
 * Loads a concrete BaseFrameworkPlugin by framework name.
 * Built-in plugins (react, angular) are resolved from the known
 * packages/ directory so they work both in development (ts source)
 * and after npm link / global install (compiled dist/).
 * Third-party plugins fall back to require('@seans-mfe/framework-<name>').
 */

import * as path from 'path';
import { BaseFrameworkPlugin, ValidationError } from '@seans-mfe/contracts';
import type { DSLManifest } from '@seans-mfe/dsl';
import type { FrameworkVariant } from '@seans-mfe/codegen';

/** Built-in framework names and their package directory names. */
const BUILTIN_FRAMEWORKS: Record<string, string> = {
  react: 'framework-react',
  angular: 'framework-angular',
};

/**
 * Check if an object is a BaseFrameworkPlugin.
 *
 * Uses the brand tag first (survives cross-module class identity
 * differences from npm link / global installs), falls back to
 * native instanceof for third-party plugins compiled against the
 * same contracts package.
 */
function isFrameworkPlugin(obj: unknown): obj is BaseFrameworkPlugin {
  if (obj instanceof BaseFrameworkPlugin) return true;
  if (
    typeof obj === 'object' &&
    obj !== null &&
    (obj as Record<string, unknown>).__frameworkPluginBrand === '__BaseFrameworkPlugin__'
  ) {
    return true;
  }
  return false;
}

/**
 * Resolve a framework name to its concrete BaseFrameworkPlugin instance.
 *
 * Resolution order:
 * 1. Built-in: resolve from packages/<dir> relative to project root
 * 2. External: require('@seans-mfe/framework-<name>')
 *
 * @param framework - Framework name matching a manifest `framework` field (e.g. 'react', 'angular').
 * @returns The singleton plugin instance.
 * @throws ValidationError if the plugin is not found or exports an invalid instance.
 */
export function loadFrameworkPlugin(framework: string): BaseFrameworkPlugin {
  const packageName = `@seans-mfe/framework-${framework}`;

  // 1. Try built-in resolution (works with npm link and global installs)
  const builtinDir = BUILTIN_FRAMEWORKS[framework];
  if (builtinDir) {
    try {
      // In compiled dist/: __dirname is <root>/dist/framework/
      // In ts source:      __dirname is <root>/src/framework/
      // Either way, ../../packages/<dir> reaches the package.
      const builtinPath = path.resolve(__dirname, '..', '..', 'packages', builtinDir);
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(builtinPath);
      const plugin: unknown = mod.frameworkPlugin ?? mod.default;
      if (isFrameworkPlugin(plugin)) {
        return plugin;
      }
    } catch {
      // Fall through to external resolution
    }
  }

  // 2. Try npm package resolution (third-party plugins)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(packageName);
    const plugin: unknown = mod.frameworkPlugin ?? mod.default;

    if (!isFrameworkPlugin(plugin)) {
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

/**
 * Resolve the codegen variant a manifest maps to (ADR-061 injection point).
 *
 * The CLI owns framework resolution: it loads the plugin (built-in or
 * third-party, ADR-036) and hands the generator the `{ framework, bundler,
 * templateVariant }` trio via `generateAllFiles(..., { frameworkVariant })`.
 * The generator itself never loads a plugin. Resolution rule matches the
 * generator's built-in default: explicit `framework`, else `bundler:'webpack'`
 * selects Angular.
 */
export function resolveFrameworkVariant(manifest: DSLManifest): FrameworkVariant {
  const frameworkName = manifest.framework ?? (manifest.bundler === 'webpack' ? 'angular' : 'react');
  const plugin = loadFrameworkPlugin(frameworkName);
  return {
    framework: plugin.framework,
    bundler: plugin.bundler,
    templateVariant: plugin.id as 'react-rspack' | 'angular-webpack',
  };
}
