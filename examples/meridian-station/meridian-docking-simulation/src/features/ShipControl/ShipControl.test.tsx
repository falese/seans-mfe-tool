/**
 * ShipControl Feature Tests
 */

import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { ShipControl } from './ShipControl';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('ShipControl', () => {
  it('renders without crashing', () => {
    renderWithTheme(<ShipControl />);
    expect(screen.getByText('ShipControl')).toBeInTheDocument();
  });

  // TODO: Add more tests based on capability inputs/outputs
});
