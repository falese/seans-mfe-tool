import React from 'react';

export const gameInfo = {
  id: 'rhythm-tap',
  title: 'Rhythm Tap',
  emoji: '🥁',
  description: 'Rhythm Tap — watch the pattern, then drum it back!',
  ageMin: 4,
  ageMax: 8,
  categories: ["rhythm","memory"],
};

export const GetGameInfo: React.FC = () => (
  <pre style={{ fontFamily: 'monospace', fontSize: 12, background: '#f5f5f5', padding: 12, borderRadius: 8 }}>
    {JSON.stringify(gameInfo, null, 2)}
  </pre>
);

export default GetGameInfo;
