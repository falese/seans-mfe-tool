/**
 * A generated controller must reference a model that exists.
 *
 * The model name was derived from the PATH (`/leaderboard` -> `Leaderboard`)
 * while the model itself is generated from the SCHEMA
 * (`components.schemas.LeaderboardEntry` -> `LeaderboardEntry.model.js`). When
 * those disagree the controller is emitted anyway and fails at runtime with
 * "Cannot read properties of undefined (reading 'findAll')".
 *
 * It stayed invisible because the reference spec is a pet store, where `/pets`
 * and `Pet` happen to coincide. A realistic spec — the ABC Kids fleet's — has a
 * `/leaderboard` endpoint returning `LeaderboardEntry`, and every request to it
 * 500s.
 */

const { NameGenerator } = require('../NameGenerator');

const abcKidsSchemas = {
  Player: {}, NewPlayer: {}, Score: {}, NewScore: {},
  LeaderboardEntry: {}, Progression: {},
};

const petstoreSchemas = { Pet: {}, NewPet: {}, PetList: {} };

describe('NameGenerator.resolveModelName', () => {
  it('prefers an exact schema match', () => {
    expect(NameGenerator.resolveModelName('/players', abcKidsSchemas)).toBe('Player');
    expect(NameGenerator.resolveModelName('/scores', abcKidsSchemas)).toBe('Score');
    expect(NameGenerator.resolveModelName('/progression', abcKidsSchemas)).toBe('Progression');
  });

  it('falls back to a schema that extends the path-derived name', () => {
    // The defect: no `Leaderboard` schema exists, only `LeaderboardEntry`.
    expect(NameGenerator.resolveModelName('/leaderboard', abcKidsSchemas)).toBe('LeaderboardEntry');
  });

  it('leaves the pet store unchanged', () => {
    // Exact match must win over the `NewPet` / `PetList` candidates.
    expect(NameGenerator.resolveModelName('/pets', petstoreSchemas)).toBe('Pet');
  });

  it('never selects a request-body schema as the persisted model', () => {
    expect(NameGenerator.resolveModelName('/players', { NewPlayer: {} })).toBe('Player');
  });

  it('falls back to the path derivation when nothing matches', () => {
    expect(NameGenerator.resolveModelName('/widgets', abcKidsSchemas)).toBe('Widget');
    expect(NameGenerator.resolveModelName('/widgets', undefined)).toBe('Widget');
  });
});
