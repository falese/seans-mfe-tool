/**
 * The Rust native target plugin (ADR-097, ADR-099).
 *
 * A `BaseFrameworkPlugin` like the React, Angular and Swift plugins, not a
 * separate kind of thing. `framework` is `rust` and `bundler` is `cargo` — the
 * same framework+bundler id shape as `react-rspack` and `swiftui-spm`. There
 * is no Rust UI framework in the name because the crate ships none (ADR-099).
 *
 * `targetId` is `'rust'`, so it is selected by the manifest's `targets.rust`
 * block and runs ALONGSIDE the web plugin rather than instead of it (ADR-095).
 */

import { execSync } from 'child_process';
import * as path from 'path';
import { registerRustCodegen } from './codegen';
import {
  BaseFrameworkPlugin,
  parseBuildOutput,
  type EnvCheckResult,
  type SharedDep,
  type BuildResult,
} from '@seans-mfe/contracts';

/**
 * Minimum Rust toolchain — `rust-version` in the generated Cargo.toml.
 *
 * 1.75 is the floor the generated code needs: `std::pin::pin!` and
 * `impl Trait` in return position are older; nothing newer is used, so the
 * crate builds on any toolchain from the last two years.
 */
const MIN_RUST = '1.75';

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

export class RustCargoPlugin extends BaseFrameworkPlugin {
  readonly id = 'rust-cargo';
  readonly displayName = 'Rust + Cargo';
  readonly framework = 'rust';
  readonly bundler = 'cargo';

  /** Selected by `targets.rust`, not by the manifest `framework` field. */
  readonly targetId = 'rust';

  /**
   * No `defaultPort`, `startDevServer` or `getDockerStrategy`.
   *
   * A library crate linked into its host has no HTTP surface of its own, so
   * those members are absent rather than stubbed, and a caller can tell from
   * the type (ADR-097).
   */

  readonly directoryStructure = ['rust', 'rust/src/platform', 'rust/src/features', 'rust/tests'];

  getTestExtension(): string {
    return '.rs';
  }

  /**
   * Empty, and deliberately so — the Swift lane's reasoning (ADR-096 §4)
   * holds unchanged. Cargo resolves one version per semver-compatible range
   * at build time and the linker emits one copy, so there is no runtime
   * shared scope to negotiate.
   */
  getSharedDependencies(_manifest: unknown): SharedDep[] {
    return [];
  }

  /** Register the Rust file contribution with the generator (ADR-097). */
  registerCodegen(): void {
    registerRustCodegen();
  }

  async checkEnvironment(): Promise<EnvCheckResult[]> {
    const checks: EnvCheckResult[] = [];
    let found: string | null = null;
    try {
      const out = execSync('cargo --version', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      found = /cargo (\d+\.\d+(?:\.\d+)?)/.exec(out)?.[1] ?? null;
    } catch {
      found = null;
    }
    checks.push({
      tool: 'cargo',
      required: `>=${MIN_RUST}`,
      found,
      ok: found !== null && satisfies(found, MIN_RUST),
      fix: 'Install a Rust toolchain with rustup: https://rustup.rs',
    });
    return checks;
  }

  /**
   * `cargo build --release` inside the generated crate — and, when the
   * manifest sets `targets.rust.wasm`, the browser remote too (ADR-100).
   *
   * The crate lives under `rust/` in the MFE, so the build runs there rather
   * than at the MFE root — the same directory `remote:generate` emits. The
   * browser build is the generated `rust/web/build.sh`, so the CLI and a
   * developer running it by hand build the same thing.
   */
  async buildProduction(
    manifest: unknown,
    opts: { cwd: string; outputDir: string },
  ): Promise<BuildResult> {
    const started = Date.now();
    const crateDir = path.join(opts.cwd, 'rust');
    const wasm =
      (manifest as { targets?: { rust?: { wasm?: unknown } } } | undefined)?.targets?.rust?.wasm === true;
    try {
      execSync('cargo build --release', {
        cwd: crateDir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      if (wasm) {
        execSync('bash build.sh', {
          cwd: path.join(crateDir, 'web'),
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      }
      return {
        success: true,
        artifacts: [
          path.join(crateDir, 'target', 'release'),
          ...(wasm ? [path.join(crateDir, 'web', 'www')] : []),
        ],
        duration_ms: Date.now() - started,
        warnings: [],
        errors: [],
      };
    } catch (e) {
      // rustc diagnostics and cargo's own failures both go to stderr, but read
      // both streams the way the other plugins do.
      const err = e as { stdout?: Buffer | string; stderr?: Buffer | string; message?: string };
      const output = [err.stdout, err.stderr]
        .map((s) => (s ? s.toString() : ''))
        .filter(Boolean)
        .join('\n');
      const errors = parseBuildOutput(output);
      if (errors.length === 0) {
        errors.push({
          message: err.message?.trim() || 'cargo build failed with no diagnostic output',
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
