/**
 * Control-plane message protocol contract tests (ADR-053).
 *
 * These tests pin the wire protocol shared between the daemon control plane
 * (falese/daemon) and the MFE runtime: envelope shape, resolution shape,
 * rendered-experience shape, session context, and the runtime guards that
 * non-TypeScript implementations rely on to validate payloads.
 */
import {
  buildMessage,
  isActionRecord,
  isRenderedExperience,
  isResolution,
  EXPERIENCE_CONTENT_TYPES,
  type ActionRecord,
  type Message,
  type MessageKind,
  type RenderedExperience,
  type Resolution,
  type SessionContext,
} from '../messages';

const action: ActionRecord = {
  id: 'a-1',
  componentId: 'exp-1',
  actionType: 'CLICK',
  data: { x: 1 },
  timestamp: '2026-06-10T00:00:00.000Z',
};

const experience: RenderedExperience = {
  id: 'exp-1',
  mfe: 'csv-analyzer',
  capability: 'DataAnalysis',
  output: '<section>done</section>',
  contentType: 'text/html',
  createdAt: '2026-06-10T00:00:00.000Z',
};

const resolution: Resolution = {
  mfe: 'csv-analyzer',
  capability: 'DataAnalysis',
  props: { fileId: 'abc' },
};

describe('control-plane message protocol', () => {
  describe('Message envelope', () => {
    it('accepts every PLATFORM-CONTRACT v3.2 kind', () => {
      const kinds: MessageKind[] = [
        'COMPONENT_UPDATE',
        'STATE_SNAPSHOT',
        'ACTION_ECHO',
        'ACTION',
        'ACTION_FORWARD',
      ];
      for (const kind of kinds) {
        const message: Message = {
          direction: kind === 'COMPONENT_UPDATE' || kind === 'STATE_SNAPSHOT' ? 'COMPONENT' : 'ACTION',
          kind,
          payload: kind === 'COMPONENT_UPDATE' ? experience : action,
          metadata: { correlationId: 'c-1', acknowledged: false, error: null },
        };
        expect(message.kind).toBe(kind);
      }
    });

    it('carries session context on the action payload for per-user resolution', () => {
      const session: SessionContext = {
        sessionId: 's-1',
        user: { id: 'u-1', roles: ['analyst'] },
        jwt: 'token',
        application: 'web',
        locale: 'en-US',
      };
      const contextualAction: ActionRecord = { ...action, context: session };
      expect(contextualAction.context?.user?.id).toBe('u-1');
      expect(contextualAction.context?.application).toBe('web');
    });
  });

  describe('buildMessage', () => {
    it('applies protocol defaults: acknowledged=false, error=null', () => {
      const message = buildMessage({
        direction: 'ACTION',
        kind: 'ACTION',
        payload: action,
        correlationId: 'corr-9',
      });
      expect(message).toEqual({
        direction: 'ACTION',
        kind: 'ACTION',
        payload: action,
        metadata: { correlationId: 'corr-9', acknowledged: false, error: null },
      });
    });

    it('generates a correlationId when none is supplied', () => {
      const a = buildMessage({ direction: 'ACTION', kind: 'ACTION', payload: action });
      const b = buildMessage({ direction: 'ACTION', kind: 'ACTION', payload: action });
      expect(a.metadata.correlationId).toBeTruthy();
      expect(a.metadata.correlationId).not.toBe(b.metadata.correlationId);
    });

    it('honours explicit acknowledged and error overrides', () => {
      const message = buildMessage({
        direction: 'COMPONENT',
        kind: 'ACTION_ECHO',
        payload: action,
        correlationId: 'corr-1',
        acknowledged: true,
        error: 'registry unreachable',
      });
      expect(message.metadata.acknowledged).toBe(true);
      expect(message.metadata.error).toBe('registry unreachable');
    });
  });

  describe('isResolution', () => {
    it('accepts a registry resolution {mfe, capability, props}', () => {
      expect(isResolution(resolution)).toBe(true);
    });

    it.each([
      ['missing mfe', { capability: 'x', props: {} }],
      ['missing capability', { mfe: 'x', props: {} }],
      ['missing props', { mfe: 'x', capability: 'y' }],
      ['props not an object', { mfe: 'x', capability: 'y', props: 'nope' }],
      ['null', null],
      ['a component-era payload', { id: 'c1', type: 'CARD', data: {} }],
    ])('rejects %s', (_label, value) => {
      expect(isResolution(value)).toBe(false);
    });
  });

  describe('isRenderedExperience', () => {
    it('accepts an MFE-produced experience', () => {
      expect(isRenderedExperience(experience)).toBe(true);
    });

    it('accepts any contentType string (open contract, ADR-036 precedent)', () => {
      expect(isRenderedExperience({ ...experience, contentType: 'application/wasm' })).toBe(true);
    });

    it.each([
      ['missing mfe', { ...experience, mfe: undefined }],
      ['missing capability', { ...experience, capability: undefined }],
      ['missing contentType', { ...experience, contentType: undefined }],
      ['null', null],
    ])('rejects %s', (_label, value) => {
      expect(isRenderedExperience(value)).toBe(false);
    });
  });

  describe('isActionRecord', () => {
    it('accepts a renderer action', () => {
      expect(isActionRecord(action)).toBe(true);
    });

    it('accepts a control-plane state update (stateKey present)', () => {
      expect(
        isActionRecord({ ...action, actionType: 'STATE_UPDATE', stateKey: 'analysis.complete' })
      ).toBe(true);
    });

    it.each([
      ['missing actionType', { ...action, actionType: undefined }],
      ['missing componentId', { ...action, componentId: undefined }],
      ['null', null],
    ])('rejects %s', (_label, value) => {
      expect(isActionRecord(value)).toBe(false);
    });
  });

  describe('isModuleFederationOutput', () => {
    const mfOutput = {
      remoteEntryUrl: 'http://localhost:3001/remoteEntry.js',
      scope: 'abc_kids_flappy',
      module: './App',
      component: 'PlayGame',
    };

    it('accepts a module-federation experience output (ADR-055)', () => {
      const { isModuleFederationOutput } = require('../messages');
      expect(isModuleFederationOutput(mfOutput)).toBe(true);
    });

    it.each([
      ['missing remoteEntryUrl', { scope: 's', module: './App' }],
      ['missing scope', { remoteEntryUrl: 'u', module: './App' }],
      ['missing module', { remoteEntryUrl: 'u', scope: 's' }],
      ['an html string', '<p>hi</p>'],
      ['null', null],
    ])('rejects %s', (_label, value) => {
      const { isModuleFederationOutput } = require('../messages');
      expect(isModuleFederationOutput(value)).toBe(false);
    });
  });

  describe('EXPERIENCE_CONTENT_TYPES', () => {
    it('names the three canonical delivery mechanisms', () => {
      expect(EXPERIENCE_CONTENT_TYPES).toEqual({
        html: 'text/html',
        json: 'application/json',
        moduleFederation: 'module-federation',
      });
    });
  });
});
