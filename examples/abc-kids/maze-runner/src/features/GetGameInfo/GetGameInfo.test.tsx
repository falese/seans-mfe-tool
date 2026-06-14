import '@testing-library/jest-dom';
import { gameInfo } from './GetGameInfo';

describe('Maze Runner GetGameInfo', () => {
  it('exposes game metadata', () => {
    expect(gameInfo.id).toBe('maze-runner');
    expect(gameInfo.title).toBe('Maze Runner');
  });
});
