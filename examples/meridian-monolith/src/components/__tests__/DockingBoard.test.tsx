import React from 'react';
import { render, screen, within } from '@testing-library/react';
import DockingBoard from '../DockingBoard';
import { AppContext, AppState } from '../../store/AppContext';

function renderWith(state: Partial<AppState>) {
  const value: AppState = {
    berths: [], dockings: [], charges: [], modules: [], telemetry: [],
    loading: false, error: null, lastUpdated: null, refresh: async () => {},
    ...state,
  };
  return render(<AppContext.Provider value={value}><DockingBoard /></AppContext.Provider>);
}

describe('DockingBoard', () => {
  it('shows a row per berth with the docked vessel', () => {
    renderWith({
      berths: [
        { berthId: 'b1', berthClass: 'medium_freight', occupiedFlag: 1, maxMassKg: 1, currentDockingId: 4021 },
        { berthId: 'b2', berthClass: 'light_personnel', occupiedFlag: 0, maxMassKg: 1, currentDockingId: null },
      ],
      dockings: [{ dockingId: 4021, berthId: 'b1', vesselRegistryNo: 'VR-1', etaUtc: '2026-07-17T00:00:00Z', statusCode: 'DOCKED' }],
    });
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(within(rows[1]).getByText('VR-1')).toBeInTheDocument();
    expect(within(rows[1]).getByText('medium freight')).toBeInTheDocument();
    expect(within(rows[2]).getByText('FREE')).toBeInTheDocument();
  });

  it('totals pending and disputed charges for the current docking', () => {
    renderWith({
      berths: [{ berthId: 'b1', berthClass: 'x', occupiedFlag: 1, maxMassKg: 1, currentDockingId: 4021 }],
      dockings: [{ dockingId: 4021, berthId: 'b1', vesselRegistryNo: 'VR-1', etaUtc: '', statusCode: 'DOCKED' }],
      charges: [
        { dockingRef: 'DCK-004021', chargeType: 'FEE', amountCents: 100000, status: 'PENDING' },
        { dockingRef: 'DCK-004021', chargeType: 'TARIFF', amountCents: 50000, status: 'DISPUTED' },
        { dockingRef: 'DCK-004021', chargeType: 'OLD', amountCents: 999999, status: 'PAID' },
      ],
    });
    expect(screen.getByText('₢ 1,500.00')).toBeInTheDocument();
    expect(screen.getByText('DISPUTED')).toBeInTheDocument();
  });

  it('shows the error instead of the table', () => {
    renderWith({ error: 'Network Error' });
    expect(screen.getByText(/Docking board unavailable: Network Error/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
