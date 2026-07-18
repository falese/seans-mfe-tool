/**
 * MarketDirectory Feature Tests
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

const queryMock = jest.fn();
jest.mock('../../platform/bff/bff', () => ({
  query: (...args: unknown[]) => queryMock(...args),
}));

import { MarketDirectory, toMerchantId } from './MarketDirectory';

const DATA = {
  vendors: [
    { vendorId: 105, vendorName: 'Red Dust Noodle Bar', concourseZone: 'CONCOURSE-A', cuisineOrCategory: 'Noodles', licenseStatus: 'ACTIVE' },
    { vendorId: 107, vendorName: 'Lagrange Coffee', concourseZone: 'CONCOURSE-B', cuisineOrCategory: 'Coffee', licenseStatus: 'PROBATION' },
  ],
  stalls: [
    { vendorId: 105, stallNo: 'A-18', leaseCredits: 5400.5 },
  ],
  settlements: [
    { merchantId: 'ACC-7105', netCents: 2099500, status: 'SETTLED' },
    { merchantId: 'ACC-7107', netCents: 608000, status: 'HELD' },
  ],
  listDockings: [
    { dockingId: 4030, vesselRegistryNo: 'VR-72410', statusCode: 'APPROACH', etaUtc: '2026-07-18T09:55:00Z' },
    { dockingId: 4021, vesselRegistryNo: 'VR-88213', statusCode: 'DOCKED', etaUtc: '2026-07-17T14:30:00Z' },
  ],
};

describe('MarketDirectory', () => {
  beforeEach(() => queryMock.mockReset().mockResolvedValue(DATA));

  it('maps VendorId to the ledger merchant account', () => {
    expect(toMerchantId(105)).toBe('ACC-7105');
  });

  it('renders vendors with stall and settlement standing across three sources', async () => {
    render(<MarketDirectory />);
    expect(await screen.findByText('Red Dust Noodle Bar')).toBeInTheDocument();
    expect(screen.getByText(/stall A-18/)).toBeInTheDocument();
    expect(screen.getByText(/settlement HELD/)).toBeInTheDocument();
  });

  it('lists only inbound (not docked) supply movements', async () => {
    render(<MarketDirectory />);
    expect(await screen.findByText('VR-72410')).toBeInTheDocument();
    expect(screen.queryByText('VR-88213')).not.toBeInTheDocument();
  });
});
