import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ShowCover } from './ShowCover';

describe('Rhythm Tap ShowCover', () => {
  it('renders title and description', () => {
    render(<ShowCover />);
    expect(screen.getByText('Rhythm Tap')).toBeInTheDocument();
  });
});
