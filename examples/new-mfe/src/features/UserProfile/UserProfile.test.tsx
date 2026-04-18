/**
 * UserProfile Feature Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { UserProfile } from './UserProfile';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('UserProfile', () => {
  it('renders without crashing', () => {
    renderWithTheme(<UserProfile />);
    expect(screen.getByText('UserProfile')).toBeInTheDocument();
  });

  // TODO: Add more tests based on capability inputs/outputs
});
