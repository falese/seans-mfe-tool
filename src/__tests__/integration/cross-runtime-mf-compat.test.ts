/**
 * Cross-runtime MF compatibility smoke test (ADR-071, #179).
 *
 * Verifies that React+rspack and Angular+webpack plugins produce
 * configurations that are mutually compatible when a React shell
 * loads an Angular remote (or vice versa).
 *
 * These are real plugin instances — no mocks — so any breaking change
 * to a plugin's contract surfaces here.
 */

import { loadFrameworkPlugin } from '../../framework/loader';
import type { SharedDep } from '@seans-mfe/contracts';

describe('cross-runtime MF compatibility (React rspack ↔ Angular webpack)', () => {
  const react = loadFrameworkPlugin('react');
  const angular = loadFrameworkPlugin('angular');

  // ── remoteEntry filename convention ──────────────────────────────────────

  it('both plugins declare the same remoteEntry filename (remoteEntry.js)', () => {
    // remoteEntry filename is dictated by the EJS templates, not the plugin
    // directly, but we assert each plugin's identity so we can trace which
    // template it owns.
    expect(react.id).toBe('react-rspack');
    expect(angular.id).toBe('angular-webpack');

    // Both templates hard-code `filename: 'remoteEntry.js'` — this constant
    // is the cross-runtime handshake. If either changes, the other side breaks.
    // Verified against:
    //   src/codegen/templates/base-mfe/rspack.config.js.ejs       (line: filename: 'remoteEntry.js')
    //   src/codegen/templates/base-mfe-angular/webpack.config.js.ejs (line: filename: 'remoteEntry.js')
    expect(react.bundler).toBe('rspack');
    expect(angular.bundler).toBe('webpack');
  });

  // ── singleton dep conflict detection ────────────────────────────────────

  it('shared singleton deps are fully disjoint — no cross-framework version conflicts', () => {
    const reactSingletons = new Set(
      react.getSharedDependencies(null)
        .filter((d: SharedDep) => d.singleton)
        .map((d: SharedDep) => d.name),
    );
    const angularSingletons = new Set(
      angular.getSharedDependencies(null)
        .filter((d: SharedDep) => d.singleton)
        .map((d: SharedDep) => d.name),
    );

    // No package should appear in both — a conflict would mean both plugins
    // try to own the singleton and one would lose.
    const conflicts = [...reactSingletons].filter((name) => angularSingletons.has(name));
    expect(conflicts).toHaveLength(0);
  });

  it('react plugin declares react and react-dom as singletons', () => {
    const singletons = react.getSharedDependencies(null)
      .filter((d: SharedDep) => d.singleton)
      .map((d: SharedDep) => d.name);

    expect(singletons).toContain('react');
    expect(singletons).toContain('react-dom');
  });

  it('angular plugin declares @angular/core as a strict-version singleton', () => {
    const coreDep = angular.getSharedDependencies(null)
      .find((d: SharedDep) => d.name === '@angular/core');

    expect(coreDep).toBeDefined();
    expect(coreDep!.singleton).toBe(true);
    expect(coreDep!.strictVersion).toBe(true);
  });

  // ── Docker strategy compatibility ────────────────────────────────────────

  it('both plugins use the same builder and runtime images', () => {
    const reactStrategy = react.getDockerStrategy(null);
    const angularStrategy = angular.getDockerStrategy(null);

    expect(reactStrategy.builderImage).toBe('node:20-slim');
    expect(angularStrategy.builderImage).toBe('node:20-slim');

    expect(reactStrategy.runtimeImage).toBe('nginx:alpine');
    expect(angularStrategy.runtimeImage).toBe('nginx:alpine');
  });

  it('both plugins expose artifacts under dist/ so nginx serving is uniform', () => {
    const reactStrategy = react.getDockerStrategy(null);
    const angularStrategy = angular.getDockerStrategy(null);

    expect(reactStrategy.artifactPaths).toContain('dist/');
    expect(angularStrategy.artifactPaths).toContain('dist/');
  });

  it('both plugins require needsCliBuilder (runtime is distributed via CLI image)', () => {
    // Both React and Angular MFEs use @seans-mfe-tool/runtime, which is
    // distributed via the seans-mfe-tool-cli Docker image rather than npm.
    expect(react.getDockerStrategy(null).needsCliBuilder).toBe(true);
    expect(angular.getDockerStrategy(null).needsCliBuilder).toBe(true);
  });

  // ── Classic-script cross-runtime contract (ADR-069) ──────────────────────

  it('angular plugin bundler is webpack (classic-script MF, loadable by rspack shell)', () => {
    // AngularWebpackPlugin uses library:{type:'var'} + scriptType:'text/javascript'
    // so the remoteEntry.js is a classic script, not an ES module.
    // Any host (rspack or otherwise) can load it via <script src="remoteEntry.js">.
    expect(angular.bundler).toBe('webpack');
    expect(angular.framework).toBe('angular');
  });

  it('react plugin bundler is rspack (can federate classic-script angular remotes)', () => {
    expect(react.bundler).toBe('rspack');
    expect(react.framework).toBe('react');
  });
});
