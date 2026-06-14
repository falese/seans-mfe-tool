import React, { useState } from 'react';

const wrap: React.CSSProperties = { fontFamily: 'system-ui, sans-serif', textAlign: 'center',
  padding: 24, background: '#263238', borderRadius: 16, color: '#fff',
  maxWidth: 480, margin: '0 auto' };
const btn: React.CSSProperties = { fontSize: 28, margin: 6, padding: '10px 16px', borderRadius: 12,
  border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.92)' };

const PATTERN = ['🔴', '🟡', '🔴', '🔵'];
const PADS = ['🔴', '🟡', '🔵'];

export const PlayGame: React.FC = () => {
  const [taps, setTaps] = useState<string[]>([]);
  const tap = (pad: string) => {
    if (PATTERN[taps.length] === pad) setTaps((t) => [...t, pad]);
    else setTaps([]);
  };
  const won = taps.length === PATTERN.length;
  return (
    <div style={wrap}>
      <h2>🥁 Rhythm Tap</h2>
      <p>Drum this pattern: <strong>{PATTERN.join(' ')}</strong></p>
      <div>{PADS.map((pad) => <button key={pad} style={btn} onClick={() => tap(pad)}>🥁{pad}</button>)}</div>
      <h3>{won ? '🎉 You got the rhythm!' : 'So far: ' + (taps.join(' ') || '—')}</h3>
      {won && <button style={btn} onClick={() => setTaps([])}>Play again</button>}
    </div>
  );
};
export default PlayGame;
