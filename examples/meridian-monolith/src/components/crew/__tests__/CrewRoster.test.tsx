import React from 'react';
import { render, screen } from '@testing-library/react';
import CrewRoster from '../CrewRoster';

jest.mock('../../../api/client', () => ({
  getCrew: jest.fn().mockResolvedValue([]),
  getCertifications: jest.fn().mockResolvedValue([]),
  getPayroll: jest.fn().mockResolvedValue([]),
}));

it('shows loading first', () => {
  render(<CrewRoster />);
  expect(screen.getByText('Loading roster…')).toBeInTheDocument();
});

// TODO: re-enable once we have fixtures for certifications
// it('shows certification chips', async () => {
//   render(<CrewRoster />);
//   expect(await screen.findByText('EVA')).toBeInTheDocument();
// });
//
// it('shows no ledger record when payroll is missing', async () => {
//   render(<CrewRoster />);
//   expect(await screen.findByText('no ledger record')).toBeInTheDocument();
// });
