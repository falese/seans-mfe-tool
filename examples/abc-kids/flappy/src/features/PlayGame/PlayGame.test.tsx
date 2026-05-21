/**
 * PlayGame Feature Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { PlayGame } from './PlayGame';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('PlayGame', () => {
  it('renders without crashing', () => {
    renderWithTheme(<PlayGame />);
    expect(screen.getByText('PlayGame')).toBeInTheDocument();
  });

  // TODO: Add more tests based on capability inputs/outputs
});
