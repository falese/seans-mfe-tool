/**
 * The shell must be 100% generic: it renders only the connection chrome and
 * an empty layout host until the daemon publishes experiences (ADR-055).
 */
import React from 'react';
import { render, screen, act } from '@testing-library/react';

const start = jest.fn();
const stop = jest.fn().mockResolvedValue(undefined);
let capturedConfig: { onStatus?: (s: string) => void } = {};

jest.mock('@seans-mfe-tool/runtime', () => ({
  LayoutManager: jest.fn().mockImplementation((config) => {
    capturedConfig = config;
    return { start, stop };
  }),
  GraphQLTransportWsDaemonTransport: jest.fn(),
}));

import App from './App';

describe('ABC Kids shell (daemon-driven layout host)', () => {
  beforeEach(() => {
    start.mockClear();
    stop.mockClear();
  });

  it('starts empty: placeholder + layout host, no MFE knowledge', () => {
    render(<App />);
    expect(screen.getByText(/Waiting for the control plane/)).toBeInTheDocument();
    expect(screen.getByTestId('layout-host')).toBeEmptyDOMElement();
  });

  it('starts the LayoutManager with a per-tab session', () => {
    render(<App />);
    expect(start).toHaveBeenCalledTimes(1);
    const session = (capturedConfig as { session?: { sessionId: string; application: string } }).session;
    expect(session?.sessionId).toMatch(/^shell-/);
    expect(session?.application).toBe('web');
  });

  it('reflects the control-plane connection status', () => {
    render(<App />);
    act(() => capturedConfig.onStatus?.('connected'));
    expect(screen.getByText(/control plane: connected/)).toBeInTheDocument();
  });

  it('stops the LayoutManager on unmount', () => {
    const { unmount } = render(<App />);
    unmount();
    expect(stop).toHaveBeenCalledTimes(1);
  });
});
