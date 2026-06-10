import React from 'react';

export const gameInfo = {
  id: 'letter-pop',
  title: 'Letter Pop',
  emoji: '🎈',
  description: 'Letter Pop — pop the balloons in alphabetical order!',
  ageMin: 4,
  ageMax: 8,
  categories: ["letters","alphabet"],
};

export const GetGameInfo: React.FC = () => (
  <pre style={{ fontFamily: 'monospace', fontSize: 12, background: '#f5f5f5', padding: 12, borderRadius: 8 }}>
    {JSON.stringify(gameInfo, null, 2)}
  </pre>
);

export default GetGameInfo;
