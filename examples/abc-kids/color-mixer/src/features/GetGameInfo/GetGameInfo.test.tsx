import '@testing-library/jest-dom';
import { gameInfo } from './GetGameInfo';

describe('Color Mixer GetGameInfo', () => {
  it('exposes game metadata', () => {
    expect(gameInfo.id).toBe('color-mixer');
    expect(gameInfo.title).toBe('Color Mixer');
  });
});
