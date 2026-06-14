import React from 'react';

export const gameInfo = {
  id: 'rocket-math',
  title: 'Rocket Math',
  emoji: '🚀',
  description: 'Rocket Math — solve sums to fuel the rocket for launch!',
  ageMin: 4,
  ageMax: 8,
  categories: ["math","addition"],
};

export const GetGameInfo: React.FC = () => (
  <pre style={{ fontFamily: 'monospace', fontSize: 12, background: '#f5f5f5', padding: 12, borderRadius: 8 }}>
    {JSON.stringify(gameInfo, null, 2)}
  </pre>
);

export default GetGameInfo;
