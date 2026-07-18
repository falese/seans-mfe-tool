/**
 * CrewRoster Feature Tests
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

const queryMock = jest.fn();
jest.mock('../../platform/bff/bff', () => ({
  query: (...args: unknown[]) => queryMock(...args),
}));

import { CrewRoster } from './CrewRoster';

const DATA = {
  crew: [
    { crewId: 42, crewMemberName: 'Imani Okafor', section: 'OPERATIONS', dutyStatus: 'ON_DUTY' },
    { crewId: 45, crewMemberName: 'Dmitri Volkov', section: 'OPERATIONS', dutyStatus: 'ON_DUTY' },
  ],
  certifications: [
    { crewId: 42, certificationCode: 'DOCKING_CONTROL', status: 'VALID' },
    { crewId: 45, certificationCode: 'EVA', status: 'EXPIRED' },
  ],
  payroll: [
    { crewRef: 'CRW-0042', grossCents: 720000, status: 'PAID' },
    { crewRef: 'CRW-0045', grossCents: 720000, status: 'HELD' },
  ],
};

describe('CrewRoster', () => {
  beforeEach(() => queryMock.mockReset().mockResolvedValue(DATA));

  it('joins StationOS crew with ledger payroll via the CRW ref', async () => {
    render(<CrewRoster />);
    expect(await screen.findByText('Imani Okafor')).toBeInTheDocument();
    expect(screen.getByText(/₢ 7,200\.00 · PAID/)).toBeInTheDocument();
    expect(screen.getByText(/₢ 7,200\.00 · HELD/)).toBeInTheDocument();
  });

  it('shows certifications with their status', async () => {
    render(<CrewRoster />);
    expect(await screen.findByText('DOCKING_CONTROL')).toBeInTheDocument();
    expect(screen.getByText('EVA')).toBeInTheDocument();
  });
});
