/**
 * Manifest lifecycle hooks in the native lane (ADR-098).
 *
 * Two things are under test and they are different in kind:
 *
 *  1. The PIPELINE — that `MFEBase.execute` composes the same eight steps
 *     `BaseMFE.executeCapability` composes, in the same order. Ordering is the
 *     contract (ADR-002 fixes when each phase fires relative to the guard, the
 *     transitions and the error boundary), so the order is asserted positionally
 *     against the TypeScript source rather than as a list of substrings.
 *
 *  2. The ENGINE — that each ADR-002 guarantee is present in the rendering:
 *     handler arrays, `contained`, main-phase propagation, telemetry on every
 *     failure, and ADR-001's re-entrancy guard.
 *
 * Nothing here compiles Swift. These are assertions about generated text, which
 * is the same limitation ADR-096 records for the whole lane.
 */
import * as path from 'path';
import * as fs from 'fs-extra';
import { generateAllFiles } from '@seans-mfe/codegen';
import type { DSLManifest } from '@seans-mfe/dsl';
import { registerSwiftCodegen } from '../codegen';

registerSwiftCodegen();

const basePath = path.join(__dirname, 'hooks-output');
const BASE_MFE_TS = path.resolve(__dirname, '../../../runtime/src/base-mfe.ts');

afterAll(async () => {
  await fs.remove(basePath);
});

/** A manifest whose Load capability declares hooks in three phases. */
function manifest(): DSLManifest {
  return {
    name: 'crew-services',
    version: '1.0.0',
    type: 'remote',
    language: 'typescript',
    framework: 'react',
    bundler: 'rspack',
    owner: 'meridian-station',
    endpoint: 'http://localhost:5005',
    targets: { swift: {} },
    capabilities: [
      { CrewRoster: { type: 'domain', description: 'Crew roster' } },
      {
        Load: {
          type: 'platform',
          description: 'Initialization',
          lifecycle: {
            before: [{ onLoadBegin: { handler: 'onLoadBegin', description: 'Log entry' } }],
            after: [{ onLoadComplete: { handler: ['flushCache', 'onLoadComplete'] } }],
            error: [{ onLoadError: { handler: 'onLoadError', contained: true } }],
          },
        },
      },
    ],
  } as unknown as DSLManifest;
}

async function generate(m: DSLManifest) {
  const { files } = await generateAllFiles(m, basePath);
  return files.map((f) => ({
    ...f,
    path: path.relative(basePath, f.path).split(path.sep).join('/'),
  }));
}

const fileNamed = async (m: DSLManifest, suffix: string) =>
  (await generate(m)).find((f) => f.path.endsWith(suffix))!;

/**
 * Swift with its comments removed.
 *
 * Needed for any "X does NOT appear" assertion: this file documents what the
 * native lane deliberately lacks (`lifecycleExecutor`, `manifestParser`), so a
 * raw substring search matches the explanation rather than the code.
 */
const codeOnly = (swift: string) =>
  swift
    .split('\n')
    .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('///'))
    .join('\n');

describe('The capability pipeline is composed middleware (ADR-098 §1)', () => {
  it('composes the same eight steps, in the order TypeScript composes them', async () => {
    // Read the order out of base-mfe.ts rather than restating it, so a change
    // to the web lane's composition fails here instead of drifting silently.
    const ts = fs.readFileSync(BASE_MFE_TS, 'utf8');
    const tsPipeline = ts.slice(ts.indexOf('const pipeline: Middleware[] = ['));
    const tsOrder = [
      'this.stateGuard(',
      'this.stateTransition(desc.enterState)',
      'this.errorBoundary(',
      "this.lifecyclePhase(name, 'before')",
      "this.lifecyclePhase(name, 'main')",
      'doFn(ctx)',
      "this.lifecyclePhase(name, 'after')",
      'this.stateTransition(desc.exitState)',
    ].map((needle) => tsPipeline.indexOf(needle));
    expect(tsOrder.every((i) => i > -1)).toBe(true);
    expect([...tsOrder].sort((a, b) => a - b)).toEqual(tsOrder);

    const swift = (await fileNamed(manifest(), 'Platform/MFEBase.swift')).content;
    const swiftPipeline = swift.slice(swift.indexOf('let pipeline: [Middleware] = ['));
    const swiftOrder = [
      'stateGuard(capability)',
      'stateTransition(capability.enterState)',
      'errorBoundary(capability)',
      'lifecyclePhase(capability, .before)',
      'lifecyclePhase(capability, .main)',
      'try await body()',
      'lifecyclePhase(capability, .after)',
      'stateTransition(capability.exitState)',
    ].map((needle) => swiftPipeline.indexOf(needle));
    expect(swiftOrder.every((i) => i > -1)).toBe(true);
    expect([...swiftOrder].sort((a, b) => a - b)).toEqual(swiftOrder);
  });

  it('puts the error boundary AFTER the guard and the enter transition', async () => {
    // Deliberate in TypeScript: an invalid-state or invalid-transition error
    // must propagate WITHOUT running the capability's error phase or error
    // state. Getting this backwards is silent and changes behaviour.
    const swift = (await fileNamed(manifest(), 'Platform/MFEBase.swift')).content;
    const pipeline = swift.slice(swift.indexOf('let pipeline: [Middleware] = ['));
    expect(pipeline.indexOf('errorBoundary(capability)')).toBeGreaterThan(
      pipeline.indexOf('stateTransition(capability.enterState)'),
    );
    expect(pipeline.indexOf('errorBoundary(capability)')).toBeGreaterThan(
      pipeline.indexOf('stateGuard(capability)'),
    );
  });

  it('no longer inlines the pipeline as a do/catch', async () => {
    const swift = (await fileNamed(manifest(), 'Platform/MFEBase.swift')).content;
    expect(swift).toContain('private func runPipeline(');
    expect(swift).toContain('public typealias Middleware =');
    // The shape that had nowhere to attach a hook.
    expect(codeOnly(swift)).not.toContain('if let enter = capability.enterState { try transition(to: enter) }');
  });
});

describe('The hook engine is ADR-002’s, rendered (ADR-098 §2)', () => {
  const base = () => fileNamed(manifest(), 'Platform/MFEBase.swift').then((f) => f.content);

  it('runs a hook’s handlers in order — REQ-045', async () => {
    expect(await base()).toContain('for handler in hook.handlers {');
  });

  it('contains a contained hook’s failure, and reports it — REQ-042', async () => {
    const swift = await base();
    const contained = swift.slice(swift.indexOf('if hook.contained {'));
    expect(contained).toContain('emitHookFailure(hook.hook, handler, error, context, "warn")');
  });

  it('propagates a main-phase failure and continues otherwise — REQ-042/045', async () => {
    const swift = await base();
    expect(swift).toContain('phase == .main ? "error" : "warn"');
    expect(swift).toContain('if phase == .main { throw error }');
  });

  it('reports every failure — REQ-043', async () => {
    const swift = await base();
    expect(swift).toContain('deps.telemetry?.emit(MFETelemetryEvent(');
    expect(swift).toContain('name: "lifecycle-error"');
  });

  it('guards re-entrancy by capability+phase, and SKIPS rather than throws — ADR-001', async () => {
    const swift = await base();
    expect(swift).toContain('if lifecycleStack.contains(key) { return }');
    // A throw here would turn one authoring mistake into a broken capability.
    expect(swift).not.toContain('if lifecycleStack.contains(key) { throw');
  });

  it('keeps invokeHandler as the ONLY substitution seam — ADR-079', async () => {
    const swift = await base();
    // deps.lifecycleExecutor was deleted from the web lane because a seam
    // around the phase loop bypasses containment, propagation and telemetry.
    expect(codeOnly(swift)).not.toContain('lifecycleExecutor');
    const executeHook = swift.slice(swift.indexOf('private func executeHook('));
    expect(executeHook.indexOf('invokeHandler')).toBeGreaterThan(-1);
  });
});

describe('Handler resolution differs by necessity (ADR-098 §3)', () => {
  const base = () => fileNamed(manifest(), 'Platform/MFEBase.swift').then((f) => f.content);

  it('routes platform.* to the injected map, and says so when it is absent', async () => {
    const swift = await base();
    expect(swift).toContain('if name.hasPrefix("platform.")');
    expect(swift).toContain('deps.platformHandlers[platformName]');
    expect(swift).toContain('There is no native platform handler library');
  });

  it('falls back to the last segment, as TypeScript does', async () => {
    expect(await base()).toContain('name.contains(".") ? String(name.split(separator: ".").last!) : name');
  });

  it('throws naming the exact map key instead of looking up a method', async () => {
    // Swift cannot resolve a handler to a method by name on a plain class, so
    // the map IS the mechanism. The error has to say that, or a manifest that
    // works on the web fails natively with nothing actionable.
    const swift = await base();
    expect(swift).toContain('Register it as deps.customHandlers[');
    expect(swift).toContain('Swift cannot resolve a handler to a method by name');
  });

  it('declares only the four dependencies this lane consumes — ADR-092 §5', async () => {
    const swift = await base();
    for (const member of ['platformHandlers', 'customHandlers', 'telemetry', 'errorHandler']) {
      expect(swift).toContain(`public var ${member}`);
    }
    for (const absent of ['wsClient', 'bffUrl', 'manifestParser', 'stateValidator']) {
      expect(codeOnly(swift)).not.toContain(`public var ${absent}`);
    }
  });

  it('reports state errors through the error handler, which it never did', async () => {
    const swift = await base();
    expect(swift).toContain('deps.errorHandler?.handle(error,');
  });
});

describe('The manifest’s lifecycle: block reaches Swift (ADR-098 §5)', () => {
  it('projects every phase into mfe-manifest.json, flattened', async () => {
    const sidecar = await fileNamed(manifest(), 'swift/mfe-manifest.json');
    const parsed = JSON.parse(sidecar.content) as {
      capabilities: Array<{
        name: string;
        lifecycle?: Array<{ phase: string; hook: string; handlers: string[]; contained: boolean }>;
      }>;
    };
    const load = parsed.capabilities.find((c) => c.name === 'Load')!;
    expect(load.lifecycle).toEqual([
      { phase: 'before', hook: 'onLoadBegin', handlers: ['onLoadBegin'], contained: false },
      // REQ-045: an array handler stays an array, in order.
      { phase: 'after', hook: 'onLoadComplete', handlers: ['flushCache', 'onLoadComplete'], contained: false },
      { phase: 'error', hook: 'onLoadError', handlers: ['onLoadError'], contained: true },
    ]);
  });

  it('omits lifecycle entirely for a capability that declares none', async () => {
    const sidecar = await fileNamed(manifest(), 'swift/mfe-manifest.json');
    const parsed = JSON.parse(sidecar.content) as { capabilities: Array<Record<string, unknown>> };
    const crew = parsed.capabilities.find((c) => c.name === 'CrewRoster')!;
    expect(crew).not.toHaveProperty('lifecycle');
  });

  it('is rendered into ManifestMetadata.hooks by the SPM build-tool plugin', async () => {
    // The Swift side filters a static table; the generator is a decoder, not a
    // parser, which is why the flattening happens in TypeScript.
    const gen = await fileNamed(manifest(), 'ManifestMetadataGen/main.swift');
    expect(gen.content).toContain('struct HookSpec: Decodable');
    expect(gen.content).toContain('let lifecycle: [HookSpec]?');
    expect(gen.content).toContain('public static let hooks: [MFEHookSpec] = [');
    expect(gen.content).toContain('MFEHookSpec(capability:');
  });

  it('looks hooks up from that table, not from a parsed manifest', async () => {
    const swift = (await fileNamed(manifest(), 'Platform/MFEBase.swift')).content;
    expect(swift).toContain('ManifestMetadata.hooks.filter');
    // Which is why deps.manifestParser has no native analogue.
    expect(codeOnly(swift)).not.toContain('manifestParser');
  });
});

describe('A manifest that runs on the web runs natively (ADR-098 §3)', () => {
  it('seeds a handler for every hook the manifest names', async () => {
    // The web lane generates a stub METHOD per hook on mfe.ts. Swift cannot
    // resolve a handler to a method by name, so without a generated map entry
    // a `before` hook — which is NOT contained — would throw on load() for a
    // manifest the web lane runs happily.
    const mfe = await fileNamed(manifest(), 'Platform/GeneratedMFE.swift');
    for (const handler of ['onLoadBegin', 'flushCache', 'onLoadComplete', 'onLoadError']) {
      expect(mfe.content).toContain(`"${handler}": { context in`);
    }
  });

  it('lets a host override a seeded handler', async () => {
    const mfe = await fileNamed(manifest(), 'Platform/GeneratedMFE.swift');
    // merging(_:uniquingKeysWith:) keeps the host's entry on a collision.
    expect(mfe.content).toContain(
      'Self.generatedHandlers.merging(deps.customHandlers) { _, host in host }',
    );
  });

  it('seeds each handler once, however many hooks name it', async () => {
    const mfe = await fileNamed(manifest(), 'Platform/GeneratedMFE.swift');
    const seeded = [...mfe.content.matchAll(/^\s+"(\w+)": \{ context in/gm)].map((m) => m[1]);
    expect(seeded).toEqual([...new Set(seeded)]);
  });

  it('emits an empty map when the manifest declares no hooks', async () => {
    const bare = { ...manifest(), capabilities: [{ CrewRoster: { type: 'domain', description: 'x' } }] } as unknown as DSLManifest;
    const mfe = await fileNamed(bare, 'Platform/GeneratedMFE.swift');
    expect(mfe.content).toContain('public static let generatedHandlers: [String: MFEHandler] = [');
    expect(mfe.content).not.toContain('": { context in');
  });
});
