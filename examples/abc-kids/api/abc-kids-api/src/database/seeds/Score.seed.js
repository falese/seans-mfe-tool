// Developer-owned. Scores span several games on purpose: the /leaderboard
// aggregate is only interesting — and only demonstrates the BFF as a
// composition point rather than a passthrough — if no single game holds the
// whole picture.
const at = (d) => new Date(`2026-03-${d}T12:00:00Z`);

const ModelSeed = [
  { id: 1,  playerId: '1', gameId: 'flappy',              points: 420, achievedAt: at('01') },
  { id: 2,  playerId: '1', gameId: 'multiplication-quiz', points: 780, achievedAt: at('02') },
  { id: 3,  playerId: '1', gameId: 'hockey',              points: 260, achievedAt: at('04') },
  { id: 4,  playerId: '2', gameId: 'flappy',              points: 915, achievedAt: at('02') },
  { id: 5,  playerId: '2', gameId: 'multiplication-quiz', points: 640, achievedAt: at('05') },
  { id: 6,  playerId: '3', gameId: 'hockey',              points: 530, achievedAt: at('03') },
  { id: 7,  playerId: '3', gameId: 'flappy',              points: 180, achievedAt: at('06') },
  { id: 8,  playerId: '4', gameId: 'multiplication-quiz', points: 990, achievedAt: at('07') },
  { id: 9,  playerId: '4', gameId: 'flappy',              points: 610, achievedAt: at('08') },
  { id: 10, playerId: '5', gameId: 'hockey',              points: 340, achievedAt: at('09') },
];

module.exports = ModelSeed;
