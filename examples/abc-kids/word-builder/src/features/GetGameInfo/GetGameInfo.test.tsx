import '@testing-library/jest-dom';
import { gameInfo } from './GetGameInfo';

describe('Word Builder GetGameInfo', () => {
  it('exposes game metadata', () => {
    expect(gameInfo.id).toBe('word-builder');
    expect(gameInfo.title).toBe('Word Builder');
  });
});
