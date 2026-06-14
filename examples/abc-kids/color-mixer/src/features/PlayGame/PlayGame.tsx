import React, { useState } from 'react';

const wrap: React.CSSProperties = { fontFamily: 'system-ui, sans-serif', textAlign: 'center',
  padding: 24, background: '#4a148c', borderRadius: 16, color: '#fff',
  maxWidth: 480, margin: '0 auto' };
const btn: React.CSSProperties = { fontSize: 28, margin: 6, padding: '10px 16px', borderRadius: 12,
  border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.92)' };

const MIXES: Record<string, string> = {
  'red+yellow': 'orange 🟠', 'red+blue': 'purple 🟣', 'blue+yellow': 'green 🟢',
};
const PRIMARIES = [{ name: 'red', dot: '🔴' }, { name: 'yellow', dot: '🟡' }, { name: 'blue', dot: '🔵' }];

export const PlayGame: React.FC = () => {
  const [chosen, setChosen] = useState<string[]>([]);
  const pick = (name: string) => {
    if (chosen.includes(name) || chosen.length === 2) return;
    setChosen((c) => [...c, name]);
  };
  const key = [...chosen].sort().reverse().join('+');
  const result = chosen.length === 2 ? MIXES[key] ?? MIXES[[...chosen].sort().join('+')] : null;
  return (
    <div style={wrap}>
      <h2>🎨 Color Mixer</h2>
      <p>Pick two paints to mix:</p>
      <div>
        {PRIMARIES.map((p) => (
          <button key={p.name} style={{ ...btn, outline: chosen.includes(p.name) ? '4px solid #fff' : 'none' }}
            onClick={() => pick(p.name)}>
            {p.dot} {p.name}
          </button>
        ))}
      </div>
      <h3>{result ? '🎨 You made ' + result + '!' : chosen.length === 1 ? 'Pick one more…' : 'What will you make?'}</h3>
      {chosen.length === 2 && <button style={btn} onClick={() => setChosen([])}>Mix again</button>}
    </div>
  );
};
export default PlayGame;
