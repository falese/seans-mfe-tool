import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ShowCover } from './ShowCover';

describe('Maze Runner ShowCover', () => {
  it('renders title and description', () => {
    render(<ShowCover />);
    expect(screen.getByText('Maze Runner')).toBeInTheDocument();
  });
});
