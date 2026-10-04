import React from 'react';
import { render, screen } from '@testing-library/react';
import ConcoursePage from '../ConcoursePage';
import { AppContext } from '../../store/AppContext';

jest.mock('../../api/client', () => ({
  getVendors: jest.fn().mockResolvedValue([
    { vendorId: 105, vendorName: 'Red Dust Noodle Bar', concourseZone: 'CONCOURSE-A', cuisineOrCategory: 'Noodles', licenseStatus: 'ACTIVE' },
  ]),
  getStalls: jest.fn().mockResolvedValue([]),
  getSettlements: jest.fn().mockResolvedValue([{ merchantId: 'ACC-105', netCents: 1, status: 'SETTLED' }]),
}));

const state: any = { dockings: [] };

describe('ConcoursePage', () => {
  it('shows a loading message', () => {
    render(<AppContext.Provider value={state}><ConcoursePage /></AppContext.Provider>);
    expect(screen.getByText('Loading vendors...')).toBeInTheDocument();
  });

  it('shows settled vendors with a check mark', async () => {
    render(<AppContext.Provider value={state}><ConcoursePage /></AppContext.Provider>);
    expect(await screen.findByText('Settled ✓')).toBeInTheDocument();
  });
});
