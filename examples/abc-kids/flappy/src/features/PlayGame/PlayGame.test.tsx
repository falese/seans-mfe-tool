import '@testing-library/jest-dom';
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
  it('renders the canvas game area', () => {
    const { container } = renderWithTheme(<PlayGame />);
    expect(container.querySelector('canvas')).toBeInTheDocument();
  });
});
