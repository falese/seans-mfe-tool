import React, { useState } from 'react';

const wrap: React.CSSProperties = { fontFamily: 'system-ui, sans-serif', textAlign: 'center',
  padding: 24, background: '#0d47a1', borderRadius: 16, color: '#fff',
  maxWidth: 480, margin: '0 auto' };
const btn: React.CSSProperties = { fontSize: 28, margin: 6, padding: '10px 16px', borderRadius: 12,
  border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.92)' };

const SUMS = [
  { q: '2 + 3', a: 5, options: [4, 5, 6] },
  { q: '1 + 4', a: 5, options: [5, 3, 7] },
  { q: '3 + 3', a: 6, options: [5, 6, 8] },
  { q: '4 + 2', a: 6, options: [7, 4, 6] },
  { q: '2 + 2', a: 4, options: [4, 5, 3] },
];

export const PlayGame: React.FC = () => {
  const [fuel, setFuel] = useState(0);
  const [round, setRound] = useState(0);
  const [msg, setMsg] = useState('Fuel the rocket with right answers!');
  const current = SUMS[round % SUMS.length];
  const launched = fuel >= 5;
  const answer = (n: number) => {
    if (n === current.a) { setFuel((f) => f + 1); setMsg('⛽ +1 fuel!'); }
    else setMsg('Not quite — try the next one!');
    setRound((r) => r + 1);
  };
  return (
    <div style={wrap}>
      <h2>🚀 Rocket Math</h2>
      {launched ? (
        <div>
          <div style={{ fontSize: 64 }}>🚀💨</div>
          <h3>🎉 LIFT OFF!</h3>
          <button style={btn} onClick={() => { setFuel(0); setMsg('Again!'); }}>New launch</button>
        </div>
      ) : (
        <div>
          <p>What is <strong>{current.q}</strong>?</p>
          <div>{current.options.map((n) => <button key={n} style={btn} onClick={() => answer(n)}>{n}</button>)}</div>
          <h3>{msg}</h3>
          <p>Fuel: {'🟦'.repeat(fuel)}{'⬜'.repeat(5 - fuel)}</p>
        </div>
      )}
    </div>
  );
};
export default PlayGame;
