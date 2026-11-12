/**
 * PassengerManifest Feature Tests
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';

const queryMock = jest.fn();
jest.mock('../../platform/bff/bff', () => ({
  query: (...args: unknown[]) => queryMock(...args),
}));

import { PassengerManifest, groupByDocking } from './PassengerManifest';

const DATA = {
  passengers: [
    { passengerId: 30011, passengerName: 'Rosa Delgado', dockingNo: 4025, cabinClass: 'BUSINESS', clearanceStatus: 'CLEARED' },
    { passengerId: 30014, passengerName: 'Ivo Marek', dockingNo: 4025, cabinClass: 'ECONOMY', clearanceStatus: 'FLAGGED' },
    { passengerId: 30018, passengerName: 'Lena Brandt', dockingNo: 4030, cabinClass: 'ECONOMY', clearanceStatus: 'PENDING' },
    { passengerId: 30099, passengerName: 'Stray Walker', dockingNo: 9999, cabinClass: 'ECONOMY', clearanceStatus: 'CLEARED' },
  ],
  listDockings: [
    { dockingId: 4025, vesselRegistryNo: 'VR-91102', statusCode: 'DOCKED', etaUtc: '2026-07-16T11:00:00Z' },
    { dockingId: 4030, vesselRegistryNo: 'VR-72410', statusCode: 'APPROACH', etaUtc: '2026-07-18T09:55:00Z' },
  ],
};

describe('PassengerManifest', () => {
  beforeEach(() => queryMock.mockReset().mockResolvedValue(DATA));

  it('groups passengers by the docking they arrived on, in arrival order', () => {
    const groups = groupByDocking(DATA.passengers, DATA.listDockings);
    expect(groups.map((g) => [g.dockingNo, g.passengers.length])).toEqual([
      [4025, 2],
      [4030, 1],
      [9999, 1],
    ]);
    expect(groups[2].docking).toBeUndefined();
  });

  it('heads each group with its vessel, docking status and clearance tally', async () => {
    render(<PassengerManifest />);
    const group = (await screen.findByText('DCK-004025 · VR-91102')).closest('section') as HTMLElement;
    expect(within(group).getByText('DOCKED')).toBeInTheDocument();
    expect(within(group).getByText('1 cleared · 1 flagged')).toBeInTheDocument();
  });

  it('marks a flagged passenger, and an arrival Harbormaster does not know', async () => {
    render(<PassengerManifest />);
    const ivo = (await screen.findByText('Ivo Marek')).closest('li') as HTMLElement;
    expect(within(ivo).getByText('FLAGGED')).toBeInTheDocument();
    expect(screen.getByText('DCK-009999 · no Harbormaster record')).toBeInTheDocument();
  });

  it('shows the error when the BFF fails', async () => {
    queryMock.mockReset().mockRejectedValue(new Error('BFF down'));
    render(<PassengerManifest />);
    expect(await screen.findByText(/Passenger manifest unavailable: BFF down/)).toBeInTheDocument();
  });
});
