import '@testing-library/jest-dom';
/**
 * ShowCover Feature Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { ShowCover } from './ShowCover';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('ShowCover', () => {
  it('renders without crashing', () => {
    renderWithTheme(<ShowCover />);
    expect(screen.getByText(/Ice Hockey/)).toBeInTheDocument();
  });

  // TODO: Add more tests based on capability inputs/outputs
});
