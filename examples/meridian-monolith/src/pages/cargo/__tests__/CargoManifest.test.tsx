import React from 'react';
import { render, screen } from '@testing-library/react';
import CargoManifest from '../CargoManifest';

jest.mock('../../../api/client', () => ({
  getManifestLines: jest.fn().mockResolvedValue([
    { lineId: 1, dockingId: 1, sku: 'SKU-1', description: 'thing', qty: 1, declaredMassKg: 10, hazardClass: 'NONE' },
  ]),
  getValuations: jest.fn().mockResolvedValue([
    { manifestLineRef: 'DCK-000001/1', declaredValueCents: 100, insuranceClass: 'STANDARD' },
  ]),
  getDockings: jest.fn().mockResolvedValue([]),
}));

describe('CargoManifest', () => {
  it('renders', async () => {
    render(<CargoManifest />);
    expect(screen.getByText('📦 Cargo Manifest')).toBeInTheDocument();
    expect(await screen.findByText('SKU-1')).toBeInTheDocument();
  });
});
