/**
 * HomePage Feature Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { HomePage } from './HomePage';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('HomePage', () => {
  it('renders without crashing', () => {
    renderWithTheme(<HomePage />);
    expect(screen.getByText('HomePage')).toBeInTheDocument();
  });

  // TODO: Add more tests based on capability inputs/outputs
});
