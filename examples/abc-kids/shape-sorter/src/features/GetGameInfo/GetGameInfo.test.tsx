import '@testing-library/jest-dom';
import { gameInfo } from './GetGameInfo';

describe('Shape Sorter GetGameInfo', () => {
  it('exposes game metadata', () => {
    expect(gameInfo.id).toBe('shape-sorter');
    expect(gameInfo.title).toBe('Shape Sorter');
  });
});
