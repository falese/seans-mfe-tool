/**
 * DockingSimulation Feature Tests
 */

import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { DockingSimulation } from './DockingSimulation';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('DockingSimulation', () => {
  it('renders without crashing', () => {
    renderWithTheme(<DockingSimulation />);
    expect(screen.getByText('DockingSimulation')).toBeInTheDocument();
  });

  // TODO: Add more tests based on capability inputs/outputs
});
