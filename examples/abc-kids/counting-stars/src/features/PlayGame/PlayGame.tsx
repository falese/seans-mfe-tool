import React, { useState } from 'react';

const wrap: React.CSSProperties = { fontFamily: 'system-ui, sans-serif', textAlign: 'center',
  padding: 24, background: '#1a237e', borderRadius: 16, color: '#fff',
  maxWidth: 480, margin: '0 auto' };
const btn: React.CSSProperties = { fontSize: 28, margin: 6, padding: '10px 16px', borderRadius: 12,
  border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.92)' };

export const PlayGame: React.FC = () => {
  const target = 7;
  const [picked, setPicked] = useState<number[]>([]);
  const toggle = (i: number) =>
    setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
  const won = picked.length === target;
  return (
    <div style={wrap}>
      <h2>⭐ Counting Stars</h2>
      <p>Tap exactly {target} stars!</p>
      <div>
        {Array.from({ length: 10 }, (_, i) => (
          <button key={i} style={{ ...btn, opacity: picked.includes(i) ? 1 : 0.35 }} onClick={() => toggle(i)}>
            ⭐
          </button>
        ))}
      </div>
      <h3>{won ? '🎉 Perfect! That is ' + target + '!' : 'Counted: ' + picked.length}</h3>
      {won && <button style={btn} onClick={() => setPicked([])}>Play again</button>}
    </div>
  );
};
export default PlayGame;
