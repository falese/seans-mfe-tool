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
import { resolveFrameworkName, findVariant } from '@seans-mfe/codegen';
import type { FrameworkVariant } from '@seans-mfe/codegen';

/** Built-in framework names and their package directory names. */
const BUILTIN_FRAMEWORKS: Record<string, string> = {
  react: 'framework-react',
  angular: 'framework-angular',
};

/**
 * Built-in SECONDARY target ids and their package directory names (ADR-095).
 *
 * Keyed by the `targets:` key, not by a framework name — `targets.swift`
 * resolves `@seans-mfe/framework-swift`, whose plugin reports
 * `framework: 'swiftui'`. Separate from BUILTIN_FRAMEWORKS because the two
 * are selected by different manifest fields and a target is additive: it runs
 * alongside the primary plugin rather than instead of it.
 */
const BUILTIN_TARGETS: Record<string, string> = {
  swift: 'framework-swift',
  rust: 'framework-rust',
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
  // The name-resolution rule lives in exactly one place (ADR-092). It has to be
  // the NAME rule, not `deriveBuiltinVariant`: that function answers "which of
  // the two built-in trios", so reading `.framework` off it collapses every
  // third-party framework to `react` and hands loadFrameworkPlugin the wrong
  // name — silently generating a complete React MFE from a manifest that asked
  // for something else. Pinned by `__tests__/resolve-framework-variant.test.ts`.
  const frameworkName = resolveFrameworkName(manifest);
  const plugin = loadFrameworkPlugin(frameworkName);

  // The plugin declares its own codegen (ADR-097). Doing it here rather than
  // asking every caller to remember is the same move `registerTargetCodegen`
  // makes for secondary targets.
  plugin.registerCodegen?.();

  // A plugin resolved, so a missing variant is a broken plugin — not a
  // condition to recover from. `renderFiles` falls back to `reactRspack` and
  // emits an `unregistered-variant` diagnostic, which is right for the
  // NO-PLUGIN path that ADR-061 requires to stay independently runnable, and
  // wrong here: it would hand back a complete React MFE for a manifest that
  // asked for something else, which is the failure ADR-092 §4 already had to
  // fix once in this same function.
  if (!findVariant(plugin.id)) {
    throw new ValidationError(
      `Framework plugin "${plugin.displayName}" (${plugin.id}) resolved, but no codegen ` +
        `variant is registered as "${plugin.id}". Implement registerCodegen() on the plugin ` +
        `and have it call registerVariant() with a CodegenVariant whose id is "${plugin.id}".`,
      'framework',
      'registered-variant',
    );
  }

  return {
    framework: plugin.framework,
    bundler: plugin.bundler,
    // Not cast to the two built-in literals. `templateVariant` is an open
    // string (ADR-093) and narrowing it here was a lie the compiler could not
    // catch, because the built-in ids happen to satisfy it.
    templateVariant: plugin.id,
  };
}


/**
 * Load a secondary target's plugin by its `targets:` key (ADR-095).
 *
 * Same two-step resolution as `loadFrameworkPlugin`: built-in from
 * `packages/<dir>`, then `@seans-mfe/framework-<id>` for a third-party target.
 */
export function loadTargetPlugin(targetId: string): BaseFrameworkPlugin {
  const builtinDir = BUILTIN_TARGETS[targetId];
  if (builtinDir) {
    try {
      const builtinPath = path.resolve(__dirname, '..', '..', 'packages', builtinDir);
       
      const mod = require(builtinPath);
      const plugin: unknown = mod.frameworkPlugin ?? mod.default;
      if (isFrameworkPlugin(plugin)) return plugin;
    } catch {
      // Fall through to external resolution.
    }
  }
  return loadFrameworkPlugin(targetId);
}

/**
 * Every plugin that builds something for this manifest (ADR-097).
 *
 * The primary framework plugin first, then one per declared `targets:` key.
 * This is the plural form the five single-plugin call sites assumed away: a
 * manifest declaring `targets.swift` produces two artifacts and therefore has
 * two plugins, and anything that checks environments or runs builds has to see
 * both.
 *
 * An unknown target id is skipped with a warning rather than failing the
 * command, matching the open-world policy `framework` and `bundler` already
 * follow (ADR-036, #181): a manifest naming a target this installation has no
 * generator for is not an invalid manifest.
 */
export function loadTargetPlugins(manifest: DSLManifest): BaseFrameworkPlugin[] {
  const plugins: BaseFrameworkPlugin[] = [loadFrameworkPlugin(resolveFrameworkName(manifest))];

  for (const targetId of Object.keys(manifest.targets ?? {})) {
    // `web` is the primary build, already loaded above from the single
    // resolution rule — it is a spelling of framework/bundler, not a second
    // plugin to resolve (ADR-095 §6).
    if (targetId === 'web') continue;
    try {
      plugins.push(loadTargetPlugin(targetId));
    } catch {
      process.stderr.write(
        `[seans-mfe-tool] Warning: no plugin for build target "${targetId}"; skipping it.\n`,
      );
    }
  }
  return plugins;
}

/**
 * Register the codegen contribution of every plugin this manifest uses.
 *
 * Replaces the side-effect `import '@seans-mfe/framework-swift/codegen'` that
 * each generating call site previously carried. That shape had a failure mode
 * worth naming: forgetting one import did not error, because the drift gate
 * compares against a MAXIMAL generation, so files the unregistered contributor
 * would have produced surfaced as `orphaned` — a diagnostic pointing at a file
 * nobody had touched. Driving registration from the manifest makes the set of
 * contributors a function of what is being generated instead of a list four
 * files have to keep in step.
 *
 * Idempotent: both codegen registries key by id.
 */
export function registerTargetCodegen(manifest: DSLManifest): void {
  for (const plugin of loadTargetPlugins(manifest)) {
    plugin.registerCodegen?.();
  }
}


/**
 * A plugin whose target is served over HTTP.
 *
 * `defaultPort`, `startDevServer` and `getDockerStrategy` became optional in
 * ADR-097 so a natively-linked target could decline them honestly instead of
 * stubbing a port it has no use for. The three commands that assume an HTTP
 * surface — `build:dev`, `build:docker` and `remote:init` — narrow to this.
 */
export type ServedFrameworkPlugin = BaseFrameworkPlugin & {
  defaultPort: number;
  startDevServer: NonNullable<BaseFrameworkPlugin['startDevServer']>;
  getDockerStrategy: NonNullable<BaseFrameworkPlugin['getDockerStrategy']>;
};

/**
 * Narrow a plugin to one that serves over HTTP, or fail with a message that
 * names the command and the target rather than a TypeError deeper in.
 */
export function assertServesHttp(
  plugin: BaseFrameworkPlugin,
  command: string,
): asserts plugin is ServedFrameworkPlugin {
  if (
    typeof plugin.defaultPort === 'number' &&
    typeof plugin.startDevServer === 'function' &&
    typeof plugin.getDockerStrategy === 'function'
  ) {
    return;
  }
  throw new ValidationError(
    `${command} needs a target served over HTTP, but "${plugin.displayName}" ` +
      `(target "${plugin.targetId}") declares no dev server, port or container strategy. ` +
      `Run ${command} against the MFE's primary web build.`,
    'target',
    'http-served',
  );
}
