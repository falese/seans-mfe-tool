import '@testing-library/jest-dom';
import { gameInfo } from './GetGameInfo';

describe('Animal Sounds GetGameInfo', () => {
  it('exposes game metadata', () => {
    expect(gameInfo.id).toBe('animal-sounds');
    expect(gameInfo.title).toBe('Animal Sounds');
  });
});
