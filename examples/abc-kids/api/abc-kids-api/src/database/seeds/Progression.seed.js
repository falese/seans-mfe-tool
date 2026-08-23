// Developer-owned. One row per player+game actually played.
const ModelSeed = [
  { playerId: '1', gameId: 'flappy',              level: 3, starsEarned: 7,  lastPlayedAt: new Date('2026-03-04T12:00:00Z') },
  { playerId: '1', gameId: 'multiplication-quiz', level: 5, starsEarned: 12, lastPlayedAt: new Date('2026-03-02T12:00:00Z') },
  { playerId: '2', gameId: 'flappy',              level: 6, starsEarned: 15, lastPlayedAt: new Date('2026-03-02T12:00:00Z') },
  { playerId: '3', gameId: 'hockey',              level: 4, starsEarned: 9,  lastPlayedAt: new Date('2026-03-03T12:00:00Z') },
  { playerId: '4', gameId: 'multiplication-quiz', level: 8, starsEarned: 21, lastPlayedAt: new Date('2026-03-07T12:00:00Z') },
];

module.exports = ModelSeed;
