/**
 * AgentPane Feature Tests
 */

import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { AgentPane } from './AgentPane';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('AgentPane', () => {
  it('renders without crashing', () => {
    renderWithTheme(<AgentPane />);
    expect(screen.getByText('AgentPane')).toBeInTheDocument();
  });

  // TODO: Add more tests based on capability inputs/outputs
});
