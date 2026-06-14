import React, { useState } from 'react';

const wrap: React.CSSProperties = { fontFamily: 'system-ui, sans-serif', textAlign: 'center',
  padding: 24, background: '#880e4f', borderRadius: 16, color: '#fff',
  maxWidth: 480, margin: '0 auto' };
const btn: React.CSSProperties = { fontSize: 28, margin: 6, padding: '10px 16px', borderRadius: 12,
  border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.92)' };

const DECK = ['🍎', '🍌', '🚗', '🐟', '🍎', '🍌', '🚗', '🐟'];

export const PlayGame: React.FC = () => {
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const flip = (i: number) => {
    if (flipped.includes(i) || matched.includes(i) || flipped.length === 2) return;
    const now = [...flipped, i];
    setFlipped(now);
    if (now.length === 2) {
      if (DECK[now[0]] === DECK[now[1]]) { setMatched((m) => [...m, ...now]); setFlipped([]); }
      else setTimeout(() => setFlipped([]), 700);
    }
  };
  const won = matched.length === DECK.length;
  return (
    <div style={wrap}>
      <h2>🃏 Memory Match</h2>
      <p>Find all the pairs!</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, maxWidth: 320, margin: '0 auto' }}>
        {DECK.map((card, i) => {
          const up = flipped.includes(i) || matched.includes(i);
          return <button key={i} style={btn} onClick={() => flip(i)}>{up ? card : '❓'}</button>;
        })}
      </div>
      <h3>{won ? '🎉 You found them all!' : 'Pairs: ' + matched.length / 2 + ' / 4'}</h3>
      {won && <button style={btn} onClick={() => { setMatched([]); setFlipped([]); }}>Play again</button>}
    </div>
  );
};
export default PlayGame;
