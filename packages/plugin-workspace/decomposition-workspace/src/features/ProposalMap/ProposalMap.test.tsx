/**
 * ProposalMap Feature Tests
 */

import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { ProposalMap } from './ProposalMap';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('ProposalMap', () => {
  it('renders without crashing', () => {
    renderWithTheme(<ProposalMap />);
    expect(screen.getByText('ProposalMap')).toBeInTheDocument();
  });

  // TODO: Add more tests based on capability inputs/outputs
});
