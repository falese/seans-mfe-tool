import React, { useState } from 'react';

const wrap: React.CSSProperties = { fontFamily: 'system-ui, sans-serif', textAlign: 'center',
  padding: 24, background: '#1b5e20', borderRadius: 16, color: '#fff',
  maxWidth: 480, margin: '0 auto' };
const btn: React.CSSProperties = { fontSize: 28, margin: 6, padding: '10px 16px', borderRadius: 12,
  border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.92)' };

// 0 = path, 1 = wall; start top-left, flag bottom-right.
const MAZE = [
  [0, 0, 1, 0, 0],
  [1, 0, 1, 0, 1],
  [0, 0, 0, 0, 0],
  [0, 1, 1, 1, 0],
  [0, 0, 0, 1, 0],
];

export const PlayGame: React.FC = () => {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const move = (dx: number, dy: number) => {
    const x = pos.x + dx, y = pos.y + dy;
    if (x < 0 || y < 0 || x > 4 || y > 4 || MAZE[y][x] === 1) return;
    setPos({ x, y });
  };
  const won = pos.x === 4 && pos.y === 4;
  return (
    <div style={wrap}>
      <h2>🌀 Maze Runner</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 44px)', gap: 2, justifyContent: 'center' }}>
        {MAZE.flatMap((row, y) => row.map((cell, x) => (
          <div key={x + '-' + y} style={{ width: 44, height: 44, borderRadius: 6, fontSize: 26, lineHeight: '44px',
            background: cell === 1 ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.9)' }}>
            {pos.x === x && pos.y === y ? '🐭' : x === 4 && y === 4 ? '🚩' : ''}
          </div>
        )))}
      </div>
      <div style={{ marginTop: 10 }}>
        <button style={btn} onClick={() => move(0, -1)}>⬆️</button>
        <div>
          <button style={btn} onClick={() => move(-1, 0)}>⬅️</button>
          <button style={btn} onClick={() => move(0, 1)}>⬇️</button>
          <button style={btn} onClick={() => move(1, 0)}>➡️</button>
        </div>
      </div>
      <h3>{won ? '🎉 You reached the flag!' : 'Find the way to the flag!'}</h3>
      {won && <button style={btn} onClick={() => setPos({ x: 0, y: 0 })}>Run it again</button>}
    </div>
  );
};
export default PlayGame;
