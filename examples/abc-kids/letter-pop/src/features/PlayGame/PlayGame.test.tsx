import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { PlayGame } from './PlayGame';

describe('Letter Pop PlayGame', () => {
  it('renders the game title', () => {
    render(<PlayGame />);
    expect(screen.getByText(/Letter Pop/)).toBeInTheDocument();
  });
});
