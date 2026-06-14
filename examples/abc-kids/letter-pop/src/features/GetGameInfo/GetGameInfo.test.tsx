import '@testing-library/jest-dom';
import { gameInfo } from './GetGameInfo';

describe('Letter Pop GetGameInfo', () => {
  it('exposes game metadata', () => {
    expect(gameInfo.id).toBe('letter-pop');
    expect(gameInfo.title).toBe('Letter Pop');
  });
});
