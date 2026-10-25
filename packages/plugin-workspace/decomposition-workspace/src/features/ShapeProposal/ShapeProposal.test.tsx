/**
 * ShapeProposal Feature Tests
 */

import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { ShapeProposal } from './ShapeProposal';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('ShapeProposal', () => {
  it('renders without crashing', () => {
    renderWithTheme(<ShapeProposal />);
    expect(screen.getByText('ShapeProposal')).toBeInTheDocument();
  });

  // TODO: Add more tests based on capability inputs/outputs
});
