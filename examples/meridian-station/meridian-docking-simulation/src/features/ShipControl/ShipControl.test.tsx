/**
 * ShipControl Feature Tests
 */

import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ShipControl } from './ShipControl';

describe('ShipControl', () => {
  it('renders without crashing', () => {
    render(<ShipControl />);
    expect(screen.getByText('ShipControl')).toBeInTheDocument();
  });

  // TODO: Add more tests based on capability inputs/outputs
});
