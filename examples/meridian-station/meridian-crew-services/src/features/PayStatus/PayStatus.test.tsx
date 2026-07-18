/**
 * PayStatus Feature Tests
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

const queryMock = jest.fn();
jest.mock('../../platform/bff/bff', () => ({
  query: (...args: unknown[]) => queryMock(...args),
}));

import { PayStatus } from './PayStatus';

describe('PayStatus', () => {
  beforeEach(() =>
    queryMock.mockReset().mockResolvedValue({
      payroll: [
        { payrollId: 'PAY-1', crewRef: 'CRW-0042', grossCents: 720000, status: 'PAID' },
        { payrollId: 'PAY-2', crewRef: 'CRW-0045', grossCents: 720000, status: 'HELD' },
        { payrollId: 'PAY-3', crewRef: 'CRW-0047', grossCents: 610000, status: 'SCHEDULED' },
      ],
    })
  );

  it('lists only exceptions — held and scheduled, never paid', async () => {
    render(<PayStatus />);
    expect(await screen.findByText('CRW-0045')).toBeInTheDocument();
    expect(screen.getByText('CRW-0047')).toBeInTheDocument();
    expect(screen.queryByText('CRW-0042')).not.toBeInTheDocument();
  });
});
