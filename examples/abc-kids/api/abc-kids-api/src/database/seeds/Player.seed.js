// Developer-owned. The generator seeds "Sample string 1" placeholders — with
// an invalid date in createdAt — because it cannot know the domain. These are
// the ABC Kids fleet's players.
const ModelSeed = [
  { id: 1, displayName: 'Ada',   avatar: '🦊', createdAt: new Date('2026-02-01T09:00:00Z') },
  { id: 2, displayName: 'Grace', avatar: '🐙', createdAt: new Date('2026-02-03T10:30:00Z') },
  { id: 3, displayName: 'Alan',  avatar: '🐢', createdAt: new Date('2026-02-06T14:15:00Z') },
  { id: 4, displayName: 'Katherine', avatar: '🦉', createdAt: new Date('2026-02-11T08:45:00Z') },
  { id: 5, displayName: 'Linus', avatar: '🐧', createdAt: new Date('2026-02-19T16:20:00Z') },
];

module.exports = ModelSeed;
