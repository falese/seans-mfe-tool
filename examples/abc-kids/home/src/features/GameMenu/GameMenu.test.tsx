import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('../../platform/base-mfe/bootstrap', () => ({
  mfe: { updateControlPlaneState: jest.fn().mockResolvedValue(undefined) },
  mfeReady: Promise.resolve(),
}));

import { GameMenu } from './GameMenu';

describe('GameMenu (ABC Kids home)', () => {
  it('renders a tile per game from the injected catalog', () => {
    render(<GameMenu games={[{ id: 'flappy', title: 'Flappy', emoji: '🐤' }]} />);
    expect(screen.getByText('Flappy')).toBeInTheDocument();
  });

  it('contributes the main and info slots to the host on mount (ADR-058)', () => {
    const provided: string[] = [];
    render(<GameMenu games={[]} provideSlot={(id) => provided.push(id)} />);
    expect(provided).toEqual(expect.arrayContaining(['main', 'info']));
  });
});
