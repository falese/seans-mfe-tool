/**
 * VesselRegistry Feature Tests
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';

const queryMock = jest.fn();
jest.mock('../../platform/bff/bff', () => ({
  query: (...args: unknown[]) => queryMock(...args),
}));

import { VesselRegistry, latestDocking, formatCredits } from './VesselRegistry';

const DATA = {
  listVessels: [
    { vesselRegistryNo: 'VR-88213', vesselName: 'Aurora Freight Nine', operatorName: 'Helios Cargo Lines', maxCapacityKg: 300000 },
    { vesselRegistryNo: 'VR-77045', vesselName: 'Cinder Hauler', operatorName: 'Vulcan Bulk Haulage', maxCapacityKg: 850000 },
    { vesselRegistryNo: 'VR-00001', vesselName: 'Ghost Tender', operatorName: 'Nobody Ltd', maxCapacityKg: 1000 },
  ],
  listDockings: [
    { dockingId: 4019, vesselRegistryNo: 'VR-77045', statusCode: 'DEPARTED', etaUtc: '2026-07-14T06:00:00Z' },
    { dockingId: 4027, vesselRegistryNo: 'VR-77045', statusCode: 'DOCKED', etaUtc: '2026-07-17T20:15:00Z' },
    { dockingId: 4021, vesselRegistryNo: 'VR-88213', statusCode: 'DOCKED', etaUtc: '2026-07-17T14:30:00Z' },
  ],
  accounts: [
    { accountId: 'ACC-7001', displayName: 'Helios Cargo Lines', standing: 'GOOD', balanceCents: 1250000 },
    { accountId: 'ACC-7002', displayName: 'Vulcan Bulk Haulage', standing: 'DELINQUENT', balanceCents: -2150000 },
  ],
};

describe('VesselRegistry', () => {
  beforeEach(() => queryMock.mockReset().mockResolvedValue(DATA));

  it('takes a vessel’s most recent docking by ETA', () => {
    expect(latestDocking('VR-77045', DATA.listDockings)?.dockingId).toBe(4027);
    expect(latestDocking('VR-00001', DATA.listDockings)).toBeUndefined();
  });

  it('formats ledger cents as credits, negatives included', () => {
    expect(formatCredits(1250000)).toBe('₢ 12,500.00');
    expect(formatCredits(-2150000)).toBe('−₢ 21,500.00');
  });

  it('shows each vessel with its latest docking and its operator’s ledger standing', async () => {
    render(<VesselRegistry />);
    const row = (await screen.findByText('Cinder Hauler')).closest('tr') as HTMLElement;
    expect(within(row).getByText('DOCKED')).toBeInTheDocument();
    expect(within(row).getByText('DCK-004027')).toBeInTheDocument();
    expect(within(row).getByText('DELINQUENT')).toBeInTheDocument();
    expect(within(row).getByText('−₢ 21,500.00')).toBeInTheDocument();
  });

  it('says so when a vessel has no docking or its operator no ledger account', async () => {
    render(<VesselRegistry />);
    const row = (await screen.findByText('Ghost Tender')).closest('tr') as HTMLElement;
    expect(within(row).getByText('never docked')).toBeInTheDocument();
    expect(within(row).getByText('no ledger account')).toBeInTheDocument();
  });

  it('counts the delinquent operators in the header', async () => {
    render(<VesselRegistry />);
    expect(await screen.findByText('3 vessels · 1 with a delinquent operator')).toBeInTheDocument();
  });

  it('shows the error when the BFF fails', async () => {
    queryMock.mockReset().mockRejectedValue(new Error('BFF down'));
    render(<VesselRegistry />);
    expect(await screen.findByText(/Vessel registry unavailable: BFF down/)).toBeInTheDocument();
  });
});
