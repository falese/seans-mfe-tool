/**
 * ApproveProposal Feature Tests
 */

import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { ApproveProposal } from './ApproveProposal';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('ApproveProposal', () => {
  it('renders without crashing', () => {
    renderWithTheme(<ApproveProposal />);
    expect(screen.getByText('ApproveProposal')).toBeInTheDocument();
  });

  // TODO: Add more tests based on capability inputs/outputs
});
