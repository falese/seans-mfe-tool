import React from 'react';

export const gameInfo = {
  id: 'memory-match',
  title: 'Memory Match',
  emoji: '🃏',
  description: 'Memory Match — flip the cards and find every pair!',
  ageMin: 4,
  ageMax: 8,
  categories: ["memory","logic"],
};

export const GetGameInfo: React.FC = () => (
  <pre style={{ fontFamily: 'monospace', fontSize: 12, background: '#f5f5f5', padding: 12, borderRadius: 8 }}>
    {JSON.stringify(gameInfo, null, 2)}
  </pre>
);

export default GetGameInfo;
