import '@testing-library/jest-dom';
import { gameInfo } from './GetGameInfo';

describe('Rhythm Tap GetGameInfo', () => {
  it('exposes game metadata', () => {
    expect(gameInfo.id).toBe('rhythm-tap');
    expect(gameInfo.title).toBe('Rhythm Tap');
  });
});
