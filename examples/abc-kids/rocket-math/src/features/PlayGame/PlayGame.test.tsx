import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { PlayGame } from './PlayGame';

describe('Rocket Math PlayGame', () => {
  it('renders the game title', () => {
    render(<PlayGame />);
    expect(screen.getByText(/Rocket Math/)).toBeInTheDocument();
  });
});
