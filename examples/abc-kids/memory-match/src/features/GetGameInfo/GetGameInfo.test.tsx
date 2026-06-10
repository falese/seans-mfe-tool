import '@testing-library/jest-dom';
import { gameInfo } from './GetGameInfo';

describe('Memory Match GetGameInfo', () => {
  it('exposes game metadata', () => {
    expect(gameInfo.id).toBe('memory-match');
    expect(gameInfo.title).toBe('Memory Match');
  });
});
