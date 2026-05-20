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
  it('renders without crashing', () => {
    renderWithTheme(<GetGameInfo />);
    expect(screen.getByText('GetGameInfo')).toBeInTheDocument();
  });

  // TODO: Add more tests based on capability inputs/outputs
});
