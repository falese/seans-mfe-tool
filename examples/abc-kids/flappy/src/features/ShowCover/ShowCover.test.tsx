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
  it('renders the game title', () => {
    renderWithTheme(<ShowCover />);
    expect(screen.getByText('Flappy Bird')).toBeInTheDocument();
  });

  it('renders the age chip', () => {
    renderWithTheme(<ShowCover />);
    expect(screen.getByText('Ages 4–10')).toBeInTheDocument();
  });
});
