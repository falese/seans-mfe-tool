/**
 * IconView Feature Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { IconView } from './IconView';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('IconView', () => {
  it('renders without crashing', () => {
    renderWithTheme(<IconView />);
    expect(screen.getByText('IconView')).toBeInTheDocument();
  });

  // TODO: Add more tests based on capability inputs/outputs
});
