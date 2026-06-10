import React, { useState } from 'react';

const wrap: React.CSSProperties = { fontFamily: 'system-ui, sans-serif', textAlign: 'center',
  padding: 24, background: '#b71c1c', borderRadius: 16, color: '#fff',
  maxWidth: 480, margin: '0 auto' };
const btn: React.CSSProperties = { fontSize: 28, margin: 6, padding: '10px 16px', borderRadius: 12,
  border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.92)' };

const LETTERS = ['C', 'A', 'F', 'B', 'E', 'D'];

export const PlayGame: React.FC = () => {
  const [popped, setPopped] = useState<string[]>([]);
  const next = String.fromCharCode(65 + popped.length); // A, B, C…
  const pop = (letter: string) => {
    if (letter === next) setPopped((p) => [...p, letter]);
    else setPopped([]); // wrong order — balloons float back!
  };
  const won = popped.length === LETTERS.length;
  return (
    <div style={wrap}>
      <h2>🎈 Letter Pop</h2>
      <p>Pop the balloons in ABC order — next up: <strong>{won ? '—' : next}</strong></p>
      <div>
        {LETTERS.map((letter) => (
          <button key={letter} style={{ ...btn, visibility: popped.includes(letter) ? 'hidden' : 'visible' }}
            onClick={() => pop(letter)}>
            🎈{letter}
          </button>
        ))}
      </div>
      <h3>{won ? '🎉 You know your ABCs!' : popped.length === 0 ? 'Start with A!' : 'Great: ' + popped.join(' ')}</h3>
      {won && <button style={btn} onClick={() => setPopped([])}>Play again</button>}
    </div>
  );
};
export default PlayGame;
