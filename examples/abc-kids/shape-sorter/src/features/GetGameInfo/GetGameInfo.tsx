import React from 'react';

export const gameInfo = {
  id: 'shape-sorter',
  title: 'Shape Sorter',
  emoji: '🔷',
  description: 'Shape Sorter — find the shape that matches the word!',
  ageMin: 4,
  ageMax: 8,
  categories: ["shapes","logic"],
};

export const GetGameInfo: React.FC = () => (
  <pre style={{ fontFamily: 'monospace', fontSize: 12, background: '#f5f5f5', padding: 12, borderRadius: 8 }}>
    {JSON.stringify(gameInfo, null, 2)}
  </pre>
);

export default GetGameInfo;
