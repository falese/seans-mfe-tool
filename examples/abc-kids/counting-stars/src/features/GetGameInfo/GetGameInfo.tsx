import React from 'react';

export const gameInfo = {
  id: 'counting-stars',
  title: 'Counting Stars',
  emoji: '⭐',
  description: 'Counting Stars — tap exactly the right number of stars!',
  ageMin: 4,
  ageMax: 8,
  categories: ["counting","math"],
};

export const GetGameInfo: React.FC = () => (
  <pre style={{ fontFamily: 'monospace', fontSize: 12, background: '#f5f5f5', padding: 12, borderRadius: 8 }}>
    {JSON.stringify(gameInfo, null, 2)}
  </pre>
);

export default GetGameInfo;
