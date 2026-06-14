import '@testing-library/jest-dom';
import { gameInfo } from './GetGameInfo';

describe('Counting Stars GetGameInfo', () => {
  it('exposes game metadata', () => {
    expect(gameInfo.id).toBe('counting-stars');
    expect(gameInfo.title).toBe('Counting Stars');
  });
});
