import '@testing-library/jest-dom';
import { gameInfo } from './GetGameInfo';

describe('Rocket Math GetGameInfo', () => {
  it('exposes game metadata', () => {
    expect(gameInfo.id).toBe('rocket-math');
    expect(gameInfo.title).toBe('Rocket Math');
  });
});
