import '@testing-library/jest-dom';
/**
 * GetGameInfo Feature Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { GetGameInfo } from './GetGameInfo';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('GetGameInfo', () => {
  it('renders the game title', () => {
    renderWithTheme(<GetGameInfo />);
    expect(screen.getByText('Flappy Bird')).toBeInTheDocument();
  });

  it('renders age rating', () => {
    renderWithTheme(<GetGameInfo />);
    expect(screen.getByText(/Ages 4/)).toBeInTheDocument();
  });
});
