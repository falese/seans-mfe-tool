/**
 * CatalogView Feature Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CatalogView } from './CatalogView';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('CatalogView', () => {
  it('renders without crashing', () => {
    renderWithTheme(<CatalogView />);
    expect(screen.getByText('CatalogView')).toBeInTheDocument();
  });

  // TODO: Add more tests based on capability inputs/outputs
});
