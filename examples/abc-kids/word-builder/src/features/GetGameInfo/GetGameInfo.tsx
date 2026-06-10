import React from 'react';

export const gameInfo = {
  id: 'word-builder',
  title: 'Word Builder',
  emoji: '🔤',
  description: 'Word Builder — tap the letters in order to spell the word!',
  ageMin: 4,
  ageMax: 8,
  categories: ["words","spelling"],
};

export const GetGameInfo: React.FC = () => (
  <pre style={{ fontFamily: 'monospace', fontSize: 12, background: '#f5f5f5', padding: 12, borderRadius: 8 }}>
    {JSON.stringify(gameInfo, null, 2)}
  </pre>
);

export default GetGameInfo;
