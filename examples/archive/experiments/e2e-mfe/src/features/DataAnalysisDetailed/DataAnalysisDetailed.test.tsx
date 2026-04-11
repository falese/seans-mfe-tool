/**
 * DataAnalysisDetailed Feature Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { DataAnalysisDetailed } from './DataAnalysisDetailed';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('DataAnalysisDetailed', () => {
  it('renders without crashing', () => {
    renderWithTheme(<DataAnalysisDetailed />);
    expect(screen.getByText('DataAnalysisDetailed')).toBeInTheDocument();
  });

  // TODO: Add more tests based on capability inputs/outputs
});
