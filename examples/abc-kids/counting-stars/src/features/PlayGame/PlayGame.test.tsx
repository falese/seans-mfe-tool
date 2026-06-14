import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { PlayGame } from './PlayGame';

describe('Counting Stars PlayGame', () => {
  it('renders the game title', () => {
    render(<PlayGame />);
    expect(screen.getByText(/Counting Stars/)).toBeInTheDocument();
  });
});
