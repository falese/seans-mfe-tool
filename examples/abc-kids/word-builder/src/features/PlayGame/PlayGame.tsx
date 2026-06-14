import React, { useState } from 'react';

const wrap: React.CSSProperties = { fontFamily: 'system-ui, sans-serif', textAlign: 'center',
  padding: 24, background: '#e65100', borderRadius: 16, color: '#fff',
  maxWidth: 480, margin: '0 auto' };
const btn: React.CSSProperties = { fontSize: 28, margin: 6, padding: '10px 16px', borderRadius: 12,
  border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.92)' };

const WORDS = [
  { word: 'CAT', pool: ['T', 'C', 'A'] },
  { word: 'DOG', pool: ['G', 'D', 'O'] },
  { word: 'SUN', pool: ['N', 'S', 'U'] },
];

export const PlayGame: React.FC = () => {
  const [round, setRound] = useState(0);
  const [built, setBuilt] = useState('');
  const current = WORDS[round % WORDS.length];
  const tap = (letter: string) => {
    if (current.word[built.length] === letter) setBuilt(built + letter);
    else setBuilt('');
  };
  const won = built === current.word;
  return (
    <div style={wrap}>
      <h2>🔤 Word Builder</h2>
      <p>Spell: <strong>{current.word}</strong></p>
      <div style={{ fontSize: 36, minHeight: 48, letterSpacing: 8 }}>{built || '_'.repeat(current.word.length)}</div>
      <div>{current.pool.map((l, i) => <button key={i} style={btn} onClick={() => tap(l)}>{l}</button>)}</div>
      <h3>{won ? '🎉 You spelled ' + current.word + '!' : 'Tap the letters in order!'}</h3>
      {won && <button style={btn} onClick={() => { setRound((r) => r + 1); setBuilt(''); }}>Next word</button>}
    </div>
  );
};
export default PlayGame;
