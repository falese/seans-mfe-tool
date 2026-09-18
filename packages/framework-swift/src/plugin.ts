/**
 * The Swift native target plugin (ADR-096, ADR-097).
 *
 * A `BaseFrameworkPlugin` like `@seans-mfe/framework-react` and
 * `@seans-mfe/framework-angular`, not a separate kind of thing. `framework` is
 * `swiftui` and `bundler` is `spm`, which is the same framework+bundler
 * spelling the other two use (`react-rspack`, `angular-webpack`).
 *
 * What distinguishes it is `targetId`: `'swift'` rather than `'web'`, so it is
 * selected by the manifest's `targets.swift` block rather than by `framework`,
 * and runs ALONGSIDE the web plugin rather than instead of it (ADR-095).
 */

import { execSync } from 'child_process';
import * as path from 'path';
import { registerSwiftCodegen } from './codegen';
import {
  BaseFrameworkPlugin,
  parseBuildOutput,
  type EnvCheckResult,
  type SharedDep,
  type BuildResult,
} from '@seans-mfe/contracts';

/** Minimum Swift toolchain — `swift-tools-version:5.9` in the generated Package.swift. */
const MIN_SWIFT = '5.9';

/** Numeric compare of dotted versions; `found >= required`. */
function satisfies(found: string, required: string): boolean {
  const f = found.split('.').map(Number);
  const r = required.split('.').map(Number);
  for (let i = 0; i < Math.max(f.length, r.length); i++) {
    const a = f[i] ?? 0;
    const b = r[i] ?? 0;
    if (a !== b) return a > b;
  }
  return true;
}

export class SwiftSpmPlugin extends BaseFrameworkPlugin {
  readonly id = 'swiftui-spm';
  readonly displayName = 'SwiftUI + SPM';
  readonly framework = 'swiftui';
  readonly bundler = 'spm';

  /** Selected by `targets.swift`, not by the manifest `framework` field. */
  readonly targetId = 'swift';

  /**
   * No `defaultPort`, `startDevServer` or `getDockerStrategy`.
   *
   * Not oversights and not stubs: a natively-linked module has no HTTP
   * surface, so those members are absent rather than throwing, and a caller
   * can tell from the type (ADR-097).
   */

  readonly directoryStructure = [
    'swift',
    'swift/Sources/MFE/Platform',
    'swift/Sources/MFE/Features',
    'swift/Tests/MFETests',
  ];

  getTestExtension(): string {
    return '.swift';
  }

  /**
   * Empty, and deliberately so (ADR-096).
   *
   * A Module Federation shared scope deduplicates singletons across
   * separately-fetched bundles at runtime. SPM resolves versions at build time
   * and the linker emits one copy, so there is nothing to negotiate. This
   * returns `[]` rather than the web lane's singleton list because the concept
   * does not cross, not because the list happens to be empty.
   */
  getSharedDependencies(_manifest: unknown): SharedDep[] {
    return [];
  }

  /** Register the Swift file contribution with the generator (ADR-097). */
  registerCodegen(): void {
    registerSwiftCodegen();
  }

  async checkEnvironment(): Promise<EnvCheckResult[]> {
    const checks: EnvCheckResult[] = [];
    let found: string | null = null;
    try {
      const out = execSync('swift --version', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      found = /Swift version (\d+\.\d+(?:\.\d+)?)/.exec(out)?.[1] ?? null;
    } catch {
      found = null;
    }
    checks.push({
      tool: 'swift',
      required: `>=${MIN_SWIFT}`,
      found,
      ok: found !== null && satisfies(found, MIN_SWIFT),
      fix: 'Install Xcode (macOS) or a Swift toolchain from https://swift.org/download/',
    });
    return checks;
  }

  /**
   * `swift build -c release` inside the generated package.
   *
   * The package lives under `swift/` in the MFE, so the build runs there
   * rather than at the MFE root — the same directory `remote:generate` emits.
   */
  async buildProduction(
    _manifest: unknown,
    opts: { cwd: string; outputDir: string },
  ): Promise<BuildResult> {
    const started = Date.now();
    const packageDir = path.join(opts.cwd, 'swift');
    try {
      execSync('swift build -c release', {
        cwd: packageDir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return {
        success: true,
        artifacts: [path.join(packageDir, '.build', 'release')],
        duration_ms: Date.now() - started,
        warnings: [],
        errors: [],
      };
    } catch (e) {
      // swiftc writes diagnostics to stderr, but SPM's own failures go to
      // stdout. Read both, the same way the React and Angular plugins do.
      const err = e as { stdout?: Buffer | string; stderr?: Buffer | string; message?: string };
      const output = [err.stdout, err.stderr]
        .map((s) => (s ? s.toString() : ''))
        .filter(Boolean)
        .join('\n');
      const errors = parseBuildOutput(output);
      if (errors.length === 0) {
        errors.push({
          message: err.message?.trim() || 'swift build failed with no diagnostic output',
          category: 'unknown',
        });
      }
      return {
        success: false,
        artifacts: [],
        duration_ms: Date.now() - started,
        warnings: [],
        errors,
      };
    }
  }
}
