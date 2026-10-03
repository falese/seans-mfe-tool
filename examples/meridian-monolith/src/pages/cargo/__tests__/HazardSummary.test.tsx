import React from 'react';
import { act, render, screen } from '@testing-library/react';
import HazardSummary from '../HazardSummary';
import { AppContext } from '../../../store/AppContext';

jest.mock('../../../api/client', () => ({
  getManifestLines: () =>
    new Promise((resolve) =>
      // simulate network
      setTimeout(() => resolve([
        { lineId: 1, dockingId: 4021, sku: 'CRYO-CELL-42', description: '', qty: 1, declaredMassKg: 1840.5, hazardClass: 'CRYO' },
      ]), Math.random() * 60)
    ),
}));

it('groups hazardous cargo on docked vessels', async () => {
  const state: any = { dockings: [{ dockingId: 4021, statusCode: 'DOCKED' }] };
  render(<AppContext.Provider value={state}><HazardSummary /></AppContext.Provider>);
  // wait for the fetch
  await act(() => new Promise((r) => setTimeout(r, 50)));
  expect(screen.getByText('CRYO-CELL-42')).toBeInTheDocument();
});
