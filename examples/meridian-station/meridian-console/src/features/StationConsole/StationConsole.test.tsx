/**
 * StationConsole Feature Tests
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';

const updateControlPlaneState = jest.fn().mockResolvedValue(undefined);
jest.mock('../../platform/base-mfe/bootstrap', () => ({
  mfe: { updateControlPlaneState: (...args: unknown[]) => updateControlPlaneState(...args) },
  mfeReady: Promise.resolve(),
}));

import { StationConsole, DEFAULT_DOMAINS } from './StationConsole';

describe('StationConsole (Meridian Station console)', () => {
  beforeEach(() => updateControlPlaneState.mockClear());

  it('renders a card per domain from the injected catalog', () => {
    render(
      <StationConsole
        domains={[{ id: 'docking', title: 'Docking Control', emoji: '🛰️' }]}
        berths={[]}
      />
    );
    expect(screen.getByText('Docking Control')).toBeInTheDocument();
  });

  it('falls back to the built-in domain catalog when none is injected', () => {
    render(<StationConsole berths={[]} />);
    for (const domain of DEFAULT_DOMAINS) {
      expect(screen.getByText(domain.title)).toBeInTheDocument();
    }
  });

  it('drives the control plane with meridian.open.<domain> when a card is selected', () => {
    render(
      <StationConsole
        domains={[{ id: 'cargo', title: 'Cargo Operations', emoji: '📦' }]}
        berths={[]}
      />
    );
    fireEvent.click(screen.getByText('Cargo Operations'));
    expect(updateControlPlaneState).toHaveBeenCalledWith(
      expect.objectContaining({ inputs: { stateKey: 'meridian.open.cargo' } })
    );
  });

  it('contributes main, status and one keyed berth slot per berth (ADR-058/069)', () => {
    const provided: string[] = [];
    render(
      <StationConsole
        berths={['b1', 'b2', 'b3']}
        provideSlot={(id) => provided.push(id)}
      />
    );
    expect(provided).toEqual(
      expect.arrayContaining(['main', 'status', 'berth.b1', 'berth.b2', 'berth.b3'])
    );
  });

  it('fires one meridian.berth.<id> action per berth on mount so the strip self-populates', () => {
    render(<StationConsole berths={['b1', 'b2']} />);
    const fired = updateControlPlaneState.mock.calls.map(
      (call) => (call[0] as { inputs: { stateKey: string } }).inputs.stateKey
    );
    expect(fired).toEqual(expect.arrayContaining(['meridian.berth.b1', 'meridian.berth.b2']));
  });

  it('releases its slots on unmount', () => {
    const calls: Array<[string, HTMLElement | null]> = [];
    const { unmount } = render(
      <StationConsole berths={['b1']} provideSlot={(id, element) => calls.push([id, element])} />
    );
    unmount();
    expect(calls).toEqual(
      expect.arrayContaining([
        ['main', null],
        ['status', null],
        ['berth.b1', null],
      ])
    );
  });
});
