/**
 * BaseControlPlane conformance tests (ADR-059).
 *
 * Tests use a ConcreteControlPlane that implements all abstract members
 * with the minimum viable surface. LayoutManager is mocked so these
 * tests are pure unit tests of the orchestration logic.
 */

jest.mock('./layout-manager', () => ({
  LayoutManager: jest.fn(),
}));

import { LayoutManager } from './layout-manager';
import {
  BaseControlPlane,
  isBaseControlPlane,
} from './base-control-plane';
import type {
  ControlPlaneConfig,
  ControlPlaneHealth,
} from './base-control-plane';
import type { MfeRegistration, Resolution, ActionRecord } from '@seans-mfe/contracts';
import type { DaemonTransport } from './layout-manager';

// ── Test double ──────────────────────────────────────────────────────────────

const mockLmStart = jest.fn();
const mockLmStop  = jest.fn().mockResolvedValue(undefined);
const mockLmSlots = ['main'];

const MockLayoutManager = LayoutManager as jest.MockedClass<typeof LayoutManager>;

function resetLayoutManagerMock(): void {
  MockLayoutManager.mockClear();
  MockLayoutManager.mockImplementation(() => ({
    start:       mockLmStart,
    stop:        mockLmStop,
    activeSlots: mockLmSlots,
  } as unknown as LayoutManager));
}

const FAKE_TRANSPORT: DaemonTransport = {
  start: jest.fn(),
  stop:  jest.fn(),
  send:  jest.fn().mockResolvedValue(undefined),
};

const BASE_CONFIG: ControlPlaneConfig = {
  container: { appendChild: jest.fn() },
};

class ConcreteControlPlane extends BaseControlPlane {
  readonly id             = 'test';
  readonly displayName    = 'Test Control Plane';
  readonly implementation = 'test';

  doStartCalled  = false;
  doStopCalled   = false;
  shouldFailStart = false;

  protected async doStart(): Promise<void> {
    if (this.shouldFailStart) throw new Error('daemon failed to start');
    this.doStartCalled = true;
  }
  protected async doStop(): Promise<void> {
    this.doStopCalled = true;
  }

  async register(_mfe: MfeRegistration):         Promise<void> { /* no-op */ }
  async unregister(_name: string):               Promise<void> { /* no-op */ }
  async resolve(_action: ActionRecord):          Promise<Resolution> { return { mfe: 'x', capability: 'y', props: {} }; }
  async health():                                Promise<ControlPlaneHealth> { return { status: this.status, registered: [] }; }
  createTransport():                             DaemonTransport { return FAKE_TRANSPORT; }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BaseControlPlane (ADR-059)', () => {
  beforeEach(() => {
    resetLayoutManagerMock();
  });

  describe('initial state', () => {
    it('starts with status idle', () => {
      const cp = new ConcreteControlPlane(BASE_CONFIG);
      expect(cp.status).toBe('idle');
    });

    it('activeSlots is empty before start', () => {
      const cp = new ConcreteControlPlane(BASE_CONFIG);
      expect(cp.activeSlots).toEqual([]);
    });

    it('uptime is undefined before start', () => {
      const cp = new ConcreteControlPlane(BASE_CONFIG);
      expect(cp.uptime).toBeUndefined();
    });
  });

  describe('start()', () => {
    it('transitions idle → starting → running', async () => {
      const cp = new ConcreteControlPlane(BASE_CONFIG);
      const statuses: string[] = [];
      jest.spyOn(cp as unknown as { _status: string }, '_status', 'set').mockImplementation(
        function(this: { _status: string }, v: string) { this._status = v; statuses.push(v); }
      );
      await cp.start();
      expect(statuses).toContain('starting');
      expect(cp.status).toBe('running');
    });

    it('calls doStart() before wiring LayoutManager', async () => {
      const cp = new ConcreteControlPlane(BASE_CONFIG);
      let doStartCalledBeforeLM = false;
      const origDoStart = cp['doStart'].bind(cp);
      cp['doStart'] = async () => {
        doStartCalledBeforeLM = MockLayoutManager.mock.instances.length === 0;
        return origDoStart();
      };
      await cp.start();
      expect(doStartCalledBeforeLM).toBe(true);
    });

    it('creates LayoutManager with transport from createTransport()', async () => {
      const cp = new ConcreteControlPlane(BASE_CONFIG);
      await cp.start();
      expect(MockLayoutManager).toHaveBeenCalledTimes(1);
      const [cfg] = MockLayoutManager.mock.calls[0];
      expect(cfg.transport).toBe(FAKE_TRANSPORT);
    });

    it('passes container and session to LayoutManager', async () => {
      const session = { sessionId: 'abc', jwt: 'tok' };
      const cp = new ConcreteControlPlane({ ...BASE_CONFIG, session });
      await cp.start();
      const [cfg] = MockLayoutManager.mock.calls[0];
      expect(cfg.container).toBe(BASE_CONFIG.container);
      expect(cfg.session).toBe(session);
    });

    it('calls layoutManager.start()', async () => {
      const cp = new ConcreteControlPlane(BASE_CONFIG);
      await cp.start();
      expect(mockLmStart).toHaveBeenCalledTimes(1);
    });

    it('sets status to error and re-throws when doStart() fails', async () => {
      const cp = new ConcreteControlPlane(BASE_CONFIG);
      cp.shouldFailStart = true;
      await expect(cp.start()).rejects.toThrow('daemon failed to start');
      expect(cp.status).toBe('error');
    });

    it('does not create LayoutManager when doStart() fails', async () => {
      const cp = new ConcreteControlPlane(BASE_CONFIG);
      cp.shouldFailStart = true;
      await expect(cp.start()).rejects.toThrow();
      expect(MockLayoutManager).not.toHaveBeenCalled();
    });

    it('uptime is defined after start', async () => {
      const cp = new ConcreteControlPlane(BASE_CONFIG);
      await cp.start();
      expect(typeof cp.uptime).toBe('number');
    });
  });

  describe('stop()', () => {
    it('tears down LayoutManager before calling doStop()', async () => {
      const cp = new ConcreteControlPlane(BASE_CONFIG);
      await cp.start();
      let lmStoppedBeforeDoStop = false;
      const origDoStop = cp['doStop'].bind(cp);
      cp['doStop'] = async () => {
        lmStoppedBeforeDoStop = mockLmStop.mock.calls.length > 0;
        return origDoStop();
      };
      await cp.stop();
      expect(lmStoppedBeforeDoStop).toBe(true);
    });

    it('calls doStop()', async () => {
      const cp = new ConcreteControlPlane(BASE_CONFIG);
      await cp.start();
      await cp.stop();
      expect(cp.doStopCalled).toBe(true);
    });

    it('transitions running → stopping → stopped', async () => {
      const cp = new ConcreteControlPlane(BASE_CONFIG);
      await cp.start();
      await cp.stop();
      expect(cp.status).toBe('stopped');
    });

    it('activeSlots returns [] after stop', async () => {
      const cp = new ConcreteControlPlane(BASE_CONFIG);
      await cp.start();
      await cp.stop();
      expect(cp.activeSlots).toEqual([]);
    });

    it('uptime is undefined after stop', async () => {
      const cp = new ConcreteControlPlane(BASE_CONFIG);
      await cp.start();
      await cp.stop();
      expect(cp.uptime).toBeUndefined();
    });

    it('is a no-op when already stopped', async () => {
      const cp = new ConcreteControlPlane(BASE_CONFIG);
      await cp.start();
      await cp.stop();
      mockLmStop.mockClear();
      await cp.stop(); // second call
      expect(mockLmStop).not.toHaveBeenCalled();
    });

    it('is a no-op when never started', async () => {
      const cp = new ConcreteControlPlane(BASE_CONFIG);
      await expect(cp.stop()).resolves.not.toThrow();
      expect(cp.status).toBe('idle');
    });
  });

  describe('activeSlots', () => {
    it('delegates to LayoutManager when running', async () => {
      const cp = new ConcreteControlPlane(BASE_CONFIG);
      await cp.start();
      expect(cp.activeSlots).toEqual(mockLmSlots);
    });
  });

  describe('brand / guard', () => {
    it('isBaseControlPlane returns true for a concrete implementation', () => {
      const cp = new ConcreteControlPlane(BASE_CONFIG);
      expect(isBaseControlPlane(cp)).toBe(true);
    });

    it('isBaseControlPlane returns false for a plain object', () => {
      expect(isBaseControlPlane({ id: 'node' })).toBe(false);
    });

    it('isBaseControlPlane returns false for null', () => {
      expect(isBaseControlPlane(null)).toBe(false);
    });

    it('__controlPlaneBrand is the expected constant', () => {
      const cp = new ConcreteControlPlane(BASE_CONFIG);
      expect(cp.__controlPlaneBrand).toBe('__BaseControlPlane__');
    });
  });
});
