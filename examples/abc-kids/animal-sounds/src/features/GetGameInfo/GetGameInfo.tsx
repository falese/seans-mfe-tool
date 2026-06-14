import React from 'react';

export const gameInfo = {
  id: 'animal-sounds',
  title: 'Animal Sounds',
  emoji: '🐮',
  description: 'Animal Sounds — which animal makes that sound?',
  ageMin: 4,
  ageMax: 8,
  categories: ["animals","sounds"],
};

export const GetGameInfo: React.FC = () => (
  <pre style={{ fontFamily: 'monospace', fontSize: 12, background: '#f5f5f5', padding: 12, borderRadius: 8 }}>
    {JSON.stringify(gameInfo, null, 2)}
  </pre>
);

export default GetGameInfo;
