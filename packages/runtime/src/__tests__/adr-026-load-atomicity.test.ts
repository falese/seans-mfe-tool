/**
 * ADR-026 Validation Criteria — the atomic load capability (#318).
 *
 * ADR-026 closes with eleven Validation Criteria and none of them had a test
 * behind them, which is why the decision sat `Accepted, impl phased` with
 * nothing guiding the remaining work.
 *
 * These tests exercise the **real** `doLoad`. That distinction matters: the
 * shared `MFETestHarness` replaces `doLoad` wholesale with a fixture that
 * returns a hand-built `LoadResult` and emits hand-built telemetry, so every
 * existing load test asserts against the mock rather than the implementation.
 * The subclass below stubs only what ADR-036 already quarantines as
 * framework-specific — the shared-scope map, mounting, unmounting — plus the
 * network fetch, and lets the three subphases run for real.
 *
 * One criterion is deliberately absent: "Retry: transient errors retry
 * correctly with exponential backoff". `withRetry` (ADR-030) exists and is
 * tested, but nothing wires it to a capability, and the config ADR-026
 * describes (`errorHandling.retry.maxAttempts`) has no field in the DSL
 * schema. Adding one is a decision, not an implementation detail — see #318.
 */

import { BaseRemoteMFE, type ModuleFederationContainer } from '../base-remote-mfe';
import type { Context, LoadResult } from '../base-mfe';
import type { TelemetryEvent, TelemetryService } from '../base-mfe';
import type { DSLManifest } from '@seans-mfe/dsl';

class TelemetryLog implements TelemetryService {
  public readonly events: TelemetryEvent[] = [];
  emit(event: TelemetryEvent): void {
    this.events.push(event);
  }
  /** Phase labels in emission order — the sequence the criteria talk about. */
  phases(): string[] {
    return this.events.filter((e) => e.capability === 'load').map((e) => String(e.phase));
  }
}

/** A container that records what it was initialised with. */
function makeContainer(): ModuleFederationContainer & { initArgs: unknown[] } {
  const initArgs: unknown[] = [];
  return {
    initArgs,
    init: async (shared: Record<string, unknown>) => {
      initArgs.push(shared);
    },
    get: async () => () => ({ default: class {} }),
  };
}

const SHARED_DEPS = { react: { singleton: true } };

class TestRemoteMFE extends BaseRemoteMFE {
  /** Swapped per test to drive a failure into a chosen subphase. */
  public fetchImpl: () => Promise<ModuleFederationContainer> = async () => makeContainer();

  protected getSharedDependencies(): Record<string, unknown> {
    return SHARED_DEPS;
  }
  protected async fetchContainer(): Promise<ModuleFederationContainer> {
    return this.fetchImpl();
  }
  protected async mountComponent(): Promise<unknown> {
    return { tagName: 'DIV' };
  }
  public unmount(): void {
    /* not exercised by the load criteria */
  }
}

function manifest(overrides: Partial<DSLManifest> = {}): DSLManifest {
  return {
    name: 'criteria-mfe',
    version: '1.0.0',
    type: 'remote',
    language: 'typescript',
    remoteEntry: 'http://remote-mfe:3001/remoteEntry.js',
    capabilities: [
      { load: { type: 'platform', description: 'Load remote MFE' } },
      { render: { type: 'platform', description: 'Render', components: ['View1', 'View2'] } },
    ],
    ...overrides,
  } as DSLManifest;
}

function makeContext(overrides: Partial<Context> = {}): Context {
  return {
    requestId: 'req-adr-026',
    timestamp: new Date(),
    ...overrides,
  } as Context;
}

function build(over: Partial<DSLManifest> = {}): { mfe: TestRemoteMFE; telemetry: TelemetryLog } {
  const telemetry = new TelemetryLog();
  return { mfe: new TestRemoteMFE(manifest(over), { telemetry }), telemetry };
}

describe('ADR-026 validation criteria: atomic load', () => {
  describe('criterion 1 — entry phase fetches the remote entry', () => {
    it('resolves the URL from context.inputs ahead of the manifest', async () => {
      const { mfe } = build();
      const seen: string[] = [];
      mfe.fetchImpl = async () => makeContainer();
      // Capture what the phase resolved by re-entering through the protected seam.
      const spy = jest
        .spyOn(mfe as unknown as { fetchContainer: (u: string) => Promise<unknown> }, 'fetchContainer')
        .mockImplementation(async (url: string) => {
          seen.push(url);
          return makeContainer();
        });

      await mfe.load(makeContext({ inputs: { remoteEntry: 'http://override:9/remoteEntry.js' } }));

      expect(seen).toEqual(['http://override:9/remoteEntry.js']);
      spy.mockRestore();
    });

    it('falls back to the manifest remoteEntry when the context carries none', async () => {
      const { mfe } = build();
      const seen: string[] = [];
      jest
        .spyOn(mfe as unknown as { fetchContainer: (u: string) => Promise<unknown> }, 'fetchContainer')
        .mockImplementation(async (url: string) => {
          seen.push(url);
          return makeContainer();
        });

      await mfe.load(makeContext());

      expect(seen).toEqual(['http://remote-mfe:3001/remoteEntry.js']);
    });

    it('fails the load when neither source supplies a remote entry', async () => {
      const { mfe } = build({ remoteEntry: undefined });

      const result = await mfe.load(makeContext());

      expect(result.status).toBe('error');
      expect(result.error?.message).toMatch(/remote entry url not provided/i);
    });
  });

  describe('criterion 2 — mount phase initialises the container with shared deps', () => {
    it('passes the framework shared-scope map to container.init', async () => {
      const container = makeContainer();
      const { mfe } = build();
      mfe.fetchImpl = async () => container;

      await mfe.load(makeContext());

      expect(container.initArgs).toEqual([SHARED_DEPS]);
    });
  });

  describe('criterion 3 — enable-render extracts components and capabilities', () => {
    it('takes availableComponents from an explicit render.components list', async () => {
      const { mfe } = build();

      const result = await mfe.load(makeContext());

      expect(result.availableComponents).toEqual(['View1', 'View2']);
    });

    it('falls back to domain capability names when render declares no components', async () => {
      const { mfe } = build({
        capabilities: [
          { load: { type: 'platform' } },
          { DataAnalysisView: { type: 'domain' } },
          { UploadForm: { type: 'domain' } },
        ],
      } as Partial<DSLManifest>);

      const result = await mfe.load(makeContext());

      expect(result.availableComponents).toEqual(['DataAnalysisView', 'UploadForm']);
    });

    it('exposes capability metadata the shell can inspect', async () => {
      const { mfe } = build();

      const result = await mfe.load(makeContext());

      expect(result.capabilities).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: 'load', type: 'platform' })]),
      );
    });
  });

  describe('criterion 4 — LoadResult carries every documented field', () => {
    it('returns status, container, manifest, components, capabilities, timing and telemetry', async () => {
      const { mfe } = build();

      const result = await mfe.load(makeContext());

      expect(result.status).toBe('loaded');
      expect(result.container).toBeDefined();
      expect(result.manifest?.name).toBe('criteria-mfe');
      expect(Array.isArray(result.availableComponents)).toBe(true);
      expect(Array.isArray(result.capabilities)).toBe(true);
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(typeof result.duration).toBe('number');
      expect(result.telemetry).toEqual({
        entry: { start: expect.any(Date), duration: expect.any(Number) },
        mount: { start: expect.any(Date), duration: expect.any(Number) },
        enableRender: { start: expect.any(Date), duration: expect.any(Number) },
      });
    });

    it('populates context.outputs for the handlers that run after the main phase', async () => {
      const { mfe } = build();
      const context = makeContext();

      expect(context.outputs).toBeUndefined();
      const result = await mfe.load(context);

      expect(context.outputs).toEqual({
        container: result.container,
        manifest: result.manifest,
        availableComponents: result.availableComponents,
        capabilities: result.capabilities,
      });
    });
  });

  describe('criterion 5 — atomicity: a failure in any subphase yields an error result', () => {
    /**
     * The phase label is the whole point of the criterion. A load that failed
     * at mount but reports `phase: 'entry'` sends whoever reads the telemetry
     * to the wrong side of the network boundary.
     */
    it('labels an entry-phase failure as entry and skips the later subphases', async () => {
      const { mfe, telemetry } = build();
      mfe.fetchImpl = async () => {
        throw new Error('network down');
      };

      const result = await mfe.load(makeContext());

      expect(result.status).toBe('error');
      expect(result.error?.phase).toBe('entry');
      expect(result.container).toBeUndefined();
      expect(telemetry.phases()).not.toContain('mount');
      expect(telemetry.phases()).not.toContain('enable_render');
    });

    it('labels a mount-phase failure as mount and skips enable-render', async () => {
      const { mfe, telemetry } = build();
      mfe.fetchImpl = async () => ({
        init: async () => {
          throw new Error('shared scope rejected');
        },
        get: async () => () => ({ default: class {} }),
      });

      const result = await mfe.load(makeContext());

      expect(result.status).toBe('error');
      expect(result.error?.phase).toBe('mount');
      expect(telemetry.phases()).toContain('entry');
      expect(telemetry.phases()).not.toContain('enable_render');
    });

    it('labels an enable-render failure as enable-render', async () => {
      const { mfe, telemetry } = build();
      jest
        .spyOn(mfe as unknown as { extractCapabilities: () => unknown }, 'extractCapabilities')
        .mockImplementation(() => {
          throw new Error('manifest capabilities unreadable');
        });

      const result = await mfe.load(makeContext());

      expect(result.status).toBe('error');
      expect(result.error?.phase).toBe('enable-render');
      expect(telemetry.phases()).toContain('mount');
    });

    it('never reports a partially-loaded result', async () => {
      const { mfe } = build();
      mfe.fetchImpl = async () => ({
        init: async () => {
          throw new Error('boom');
        },
        get: async () => () => ({ default: class {} }),
      });

      const result = await mfe.load(makeContext());

      // Error results carry diagnostics, never half the success payload.
      expect(result.status).toBe('error');
      expect(result.availableComponents).toBeUndefined();
      expect(result.capabilities).toBeUndefined();
      expect(result.manifest).toBeUndefined();
    });
  });

  describe('criterion 6 — subphase telemetry is accurate and sums to the total', () => {
    it('emits start and success for each subphase, in order, then load-completed', async () => {
      const { mfe, telemetry } = build();

      await mfe.load(makeContext());

      const names = telemetry.events.map((e) => e.name);
      expect(names).toEqual([
        'load-entry',
        'load-entry-metric',
        'load-mount',
        'load-mount-metric',
        'load-enable-render',
        'load-enable-render-metric',
        'load-completed',
      ]);
    });

    it('reports subphase durations that account for the total', async () => {
      const { mfe } = build();

      const result = await mfe.load(makeContext());

      const { entry, mount, enableRender } = result.telemetry!;
      for (const phase of [entry, mount, enableRender]) {
        expect(phase.duration).toBeGreaterThanOrEqual(0);
        expect(phase.start).toBeInstanceOf(Date);
      }
      const summed = entry.duration + mount.duration + enableRender.duration;
      expect(summed).toBeLessThanOrEqual(result.duration!);
    });

    it('tags every load event with the MFE name so events can be correlated', async () => {
      const { mfe, telemetry } = build();

      await mfe.load(makeContext());

      for (const event of telemetry.events) {
        expect(event.metadata).toEqual(expect.objectContaining({ mfe: 'criteria-mfe' }));
      }
    });
  });

  describe('criterion 7 — before / main / after hooks run in order around the load', () => {
    it('runs the lifecycle phases in the documented sequence', async () => {
      const order: string[] = [];
      const { mfe } = build({
        capabilities: [
          {
            load: {
              type: 'platform',
              lifecycle: {
                before: [{ pre: { handler: 'custom.pre' } }],
                after: [{ post: { handler: 'custom.post' } }],
              },
            },
          },
          { render: { type: 'platform', components: ['View1'] } },
        ],
      } as Partial<DSLManifest>);

      (mfe as unknown as Record<string, unknown>).pre = async () => {
        order.push('before');
      };
      (mfe as unknown as Record<string, unknown>).post = async () => {
        order.push('after');
      };
      jest
        .spyOn(mfe as unknown as { fetchContainer: () => Promise<unknown> }, 'fetchContainer')
        .mockImplementation(async () => {
          order.push('main');
          return makeContainer();
        });

      await mfe.load(makeContext());

      expect(order).toEqual(['before', 'main', 'after']);
    });
  });

  describe('criterion 9 — the shell can validate the result before rendering', () => {
    it('lets a shell detect an unavailable component without attempting render', async () => {
      const { mfe } = build();

      const result: LoadResult = await mfe.load(makeContext());

      expect(result.status).toBe('loaded');
      expect(result.availableComponents).not.toContain('View3');
      expect(result.availableComponents).toContain('View1');
    });

    it('surfaces a load failure the shell can branch on instead of rendering', async () => {
      const { mfe } = build();
      mfe.fetchImpl = async () => {
        throw new Error('unreachable');
      };

      const result = await mfe.load(makeContext());

      expect(result.status).not.toBe('loaded');
      expect(result.error?.message).toBe('unreachable');
      expect(typeof result.error?.retryable).toBe('boolean');
    });
  });
});
