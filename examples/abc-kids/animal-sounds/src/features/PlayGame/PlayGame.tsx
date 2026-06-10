import React, { useState } from 'react';

const wrap: React.CSSProperties = { fontFamily: 'system-ui, sans-serif', textAlign: 'center',
  padding: 24, background: '#33691e', borderRadius: 16, color: '#fff',
  maxWidth: 480, margin: '0 auto' };
const btn: React.CSSProperties = { fontSize: 28, margin: 6, padding: '10px 16px', borderRadius: 12,
  border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.92)' };

const ROUNDS = [
  { sound: 'Moo!', animal: '🐮', options: ['🐮', '🐱', '🐶', '🦆'] },
  { sound: 'Woof!', animal: '🐶', options: ['🐷', '🐶', '🐮', '🐱'] },
  { sound: 'Quack!', animal: '🦆', options: ['🦆', '🐑', '🐱', '🐷'] },
  { sound: 'Meow!', animal: '🐱', options: ['🐶', '🐮', '🐱', '🦆'] },
];

export const PlayGame: React.FC = () => {
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [msg, setMsg] = useState('Listen…');
  const current = ROUNDS[round % ROUNDS.length];
  const choose = (animal: string) => {
    if (animal === current.animal) { setScore((s) => s + 1); setMsg('🎉 Right!'); }
    else setMsg('Not that one!');
    setRound((r) => r + 1);
  };
  return (
    <div style={wrap}>
      <h2>🐮 Animal Sounds</h2>
      <p>Who says <strong>{current.sound}</strong></p>
      <div>{current.options.map((a, i) => <button key={i} style={btn} onClick={() => choose(a)}>{a}</button>)}</div>
      <h3>{msg} (score: {score})</h3>
    </div>
  );
};
export default PlayGame;
