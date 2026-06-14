import React, { useState } from 'react';

const wrap: React.CSSProperties = { fontFamily: 'system-ui, sans-serif', textAlign: 'center',
  padding: 24, background: '#004d40', borderRadius: 16, color: '#fff',
  maxWidth: 480, margin: '0 auto' };
const btn: React.CSSProperties = { fontSize: 28, margin: 6, padding: '10px 16px', borderRadius: 12,
  border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.92)' };

const ROUNDS = [
  { name: 'circle', pick: '🔵', options: ['🔵', '🔺', '🟩', '⭐'] },
  { name: 'triangle', pick: '🔺', options: ['🟩', '🔺', '🔵', '⭐'] },
  { name: 'square', pick: '🟩', options: ['⭐', '🔵', '🟩', '🔺'] },
  { name: 'star', pick: '⭐', options: ['🔺', '⭐', '🟩', '🔵'] },
];

export const PlayGame: React.FC = () => {
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [msg, setMsg] = useState('Find the shape!');
  const current = ROUNDS[round % ROUNDS.length];
  const choose = (shape: string) => {
    if (shape === current.pick) {
      setScore((s) => s + 1);
      setMsg('🎉 Yes! That is a ' + current.name + '!');
    } else {
      setMsg('Try again!');
    }
    setRound((r) => r + 1);
  };
  return (
    <div style={wrap}>
      <h2>🔷 Shape Sorter</h2>
      <p>Which one is the <strong>{current.name}</strong>?</p>
      <div>
        {current.options.map((shape, i) => (
          <button key={i} style={btn} onClick={() => choose(shape)}>{shape}</button>
        ))}
      </div>
      <h3>{msg} (score: {score})</h3>
    </div>
  );
};
export default PlayGame;
