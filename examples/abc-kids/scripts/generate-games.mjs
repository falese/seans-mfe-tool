#!/usr/bin/env node
/**
 * generate-games.mjs — stamps out ABC Kids game MFEs from the hockey
 * reference structure (the canonical layout produced by seans-mfe-tool
 * codegen: mfe-manifest.yaml, platform/base-mfe bootstrap + RemoteMFE
 * subclass, Module Federation rspack config, feature capabilities).
 *
 * PDR-001 (generate, don't hand-write): ten games stay structurally
 * identical because they come from one template + one table. Re-run after
 * changing a game definition — generated game directories are overwritten.
 *
 *   node scripts/generate-games.mjs
 *
 * Also regenerates:
 *   docker-compose.games.yaml   (one service per game, ports 3005-3014)
 *   scripts/register-games.sh   (registers all 12 games with the control
 *                                plane + resolution routes — ADR-054/055)
 */
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE = join(ROOT, 'hockey');

// ── The game table ───────────────────────────────────────────

const GAMES = [
  { id: 'counting-stars', port: 3005, emoji: '⭐', title: 'Counting Stars',
    desc: 'Counting Stars — tap exactly the right number of stars!', color: '#1a237e',
    tags: ['kids', 'game', 'counting', 'math'] },
  { id: 'letter-pop', port: 3006, emoji: '🎈', title: 'Letter Pop',
    desc: 'Letter Pop — pop the balloons in alphabetical order!', color: '#b71c1c',
    tags: ['kids', 'game', 'letters', 'alphabet'] },
  { id: 'shape-sorter', port: 3007, emoji: '🔷', title: 'Shape Sorter',
    desc: 'Shape Sorter — find the shape that matches the word!', color: '#004d40',
    tags: ['kids', 'game', 'shapes', 'logic'] },
  { id: 'color-mixer', port: 3008, emoji: '🎨', title: 'Color Mixer',
    desc: 'Color Mixer — mix two paints to make the target color!', color: '#4a148c',
    tags: ['kids', 'game', 'colors', 'art'] },
  { id: 'animal-sounds', port: 3009, emoji: '🐮', title: 'Animal Sounds',
    desc: 'Animal Sounds — which animal makes that sound?', color: '#33691e',
    tags: ['kids', 'game', 'animals', 'sounds'] },
  { id: 'memory-match', port: 3010, emoji: '🃏', title: 'Memory Match',
    desc: 'Memory Match — flip the cards and find every pair!', color: '#880e4f',
    tags: ['kids', 'game', 'memory', 'logic'] },
  { id: 'rocket-math', port: 3011, emoji: '🚀', title: 'Rocket Math',
    desc: 'Rocket Math — solve sums to fuel the rocket for launch!', color: '#0d47a1',
    tags: ['kids', 'game', 'math', 'addition'] },
  { id: 'word-builder', port: 3012, emoji: '🔤', title: 'Word Builder',
    desc: 'Word Builder — tap the letters in order to spell the word!', color: '#e65100',
    tags: ['kids', 'game', 'words', 'spelling'] },
  { id: 'rhythm-tap', port: 3013, emoji: '🥁', title: 'Rhythm Tap',
    desc: 'Rhythm Tap — watch the pattern, then drum it back!', color: '#263238',
    tags: ['kids', 'game', 'rhythm', 'memory'] },
  { id: 'maze-runner', port: 3014, emoji: '🌀', title: 'Maze Runner',
    desc: 'Maze Runner — steer through the maze to reach the flag!', color: '#1b5e20',
    tags: ['kids', 'game', 'maze', 'logic'] },
];

// Existing hand-built games, included in control-plane registration.
const EXISTING = [
  { id: 'flappy', port: 3001, scope: 'abc_kids_flappy', name: 'abc-kids-flappy' },
  { id: 'hockey', port: 3002, scope: 'abc_kids_hockey', name: 'abc-kids-hockey' },
];

const SKIP = new Set(['node_modules', 'dist', 'package-lock.json', '.turbo']);
const TEXT_EXT = /\.(ts|tsx|js|jsx|json|yaml|yml|md|html|conf|dockerignore)$|Dockerfile$/;

const compact = (id) => id.replace(/-/g, '');
const underscore = (id) => id.replace(/-/g, '_');

function transform(content, game) {
  return content
    .replaceAll('abc-kids-hockey', 'abc-kids-' + game.id)
    .replaceAll('abc_kids_hockey', 'abc_kids_' + underscore(game.id))
    .replaceAll('abckidshockey', 'abckids' + compact(game.id))
    .replaceAll('localhost:3002', 'localhost:' + game.port)
    .replaceAll('3002', String(game.port))
    .replaceAll('Ice Hockey — move your paddle, score goals against the AI!', game.desc)
    .replaceAll('Play the Ice Hockey game on an HTML5 Canvas', 'Play the ' + game.title + ' game')
    .replaceAll('the Ice Hockey game', 'the ' + game.title + ' game')
    .replaceAll('Ice Hockey', game.title)
    .replaceAll('"hockey",\n    "arcade"', game.tags.slice(2).map((t) => '"' + t + '"').join(',\n    '))
    .replaceAll('[kids, game, hockey, arcade]', '[' + game.tags.join(', ') + ']')
    .replaceAll('hockey', game.id); // residual mentions (comments, README)
}

function copyTree(src, dest, game) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    if (SKIP.has(entry)) continue;
    const from = join(src, entry);
    const to = join(dest, entry);
    if (statSync(from).isDirectory()) {
      copyTree(from, to, game);
    } else if (TEXT_EXT.test(entry)) {
      writeFileSync(to, transform(readFileSync(from, 'utf8'), game));
    } else {
      cpSync(from, to);
    }
  }
}

// ── Shared feature templates ─────────────────────────────────

const showCover = (g) => `import React from 'react';

export const ShowCover: React.FC = () => (
  <div style={{ maxWidth: 340, margin: '0 auto', borderRadius: 16, overflow: 'hidden',
    background: '${g.color}', color: '#fff', textAlign: 'center', padding: 24,
    fontFamily: 'system-ui, sans-serif' }}>
    <div style={{ fontSize: 72 }}>${g.emoji}</div>
    <h2 style={{ margin: '8px 0' }}>${g.title}</h2>
    <p style={{ opacity: 0.85 }}>${g.desc}</p>
    <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: '4px 12px', fontSize: 13 }}>
      ages 4-8
    </span>
  </div>
);

export default ShowCover;
`;

const getGameInfo = (g) => `import React from 'react';

export const gameInfo = {
  id: '${g.id}',
  title: '${g.title}',
  emoji: '${g.emoji}',
  description: '${g.desc.replace(/'/g, "\\'")}',
  ageMin: 4,
  ageMax: 8,
  categories: ${JSON.stringify(g.tags.slice(2))},
};

export const GetGameInfo: React.FC = () => (
  <pre style={{ fontFamily: 'monospace', fontSize: 12, background: '#f5f5f5', padding: 12, borderRadius: 8 }}>
    {JSON.stringify(gameInfo, null, 2)}
  </pre>
);

export default GetGameInfo;
`;

const featureIndex = (name) => `export { ${name}, default } from './${name}';\n`;

const playGameTest = (g) => `import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { PlayGame } from './PlayGame';

describe('${g.title} PlayGame', () => {
  it('renders the game title', () => {
    render(<PlayGame />);
    expect(screen.getByText(/${g.title}/)).toBeInTheDocument();
  });
});
`;

const coverTest = (g) => `import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ShowCover } from './ShowCover';

describe('${g.title} ShowCover', () => {
  it('renders title and description', () => {
    render(<ShowCover />);
    expect(screen.getByText('${g.title}')).toBeInTheDocument();
  });
});
`;

const infoTest = (g) => `import '@testing-library/jest-dom';
import { gameInfo } from './GetGameInfo';

describe('${g.title} GetGameInfo', () => {
  it('exposes game metadata', () => {
    expect(gameInfo.id).toBe('${g.id}');
    expect(gameInfo.title).toBe('${g.title}');
  });
});
`;

// ── Per-game PlayGame components ─────────────────────────────
// No backticks / template literals inside component bodies — these strings
// are embedded by the generator.

const header = (g) => `import React, { useState } from 'react';

const wrap: React.CSSProperties = { fontFamily: 'system-ui, sans-serif', textAlign: 'center',
  padding: 24, background: '${g.color}', borderRadius: 16, color: '#fff',
  maxWidth: 480, margin: '0 auto' };
const btn: React.CSSProperties = { fontSize: 28, margin: 6, padding: '10px 16px', borderRadius: 12,
  border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.92)' };
`;

const PLAY_GAMES = {
  'counting-stars': (g) => header(g) + `
export const PlayGame: React.FC = () => {
  const target = 7;
  const [picked, setPicked] = useState<number[]>([]);
  const toggle = (i: number) =>
    setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
  const won = picked.length === target;
  return (
    <div style={wrap}>
      <h2>${g.emoji} ${g.title}</h2>
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
`,

  'letter-pop': (g) => header(g) + `
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
      <h2>${g.emoji} ${g.title}</h2>
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
`,

  'shape-sorter': (g) => header(g) + `
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
      <h2>${g.emoji} ${g.title}</h2>
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
`,

  'color-mixer': (g) => header(g) + `
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
      <h2>${g.emoji} ${g.title}</h2>
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
`,

  'animal-sounds': (g) => header(g) + `
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
      <h2>${g.emoji} ${g.title}</h2>
      <p>Who says <strong>{current.sound}</strong></p>
      <div>{current.options.map((a, i) => <button key={i} style={btn} onClick={() => choose(a)}>{a}</button>)}</div>
      <h3>{msg} (score: {score})</h3>
    </div>
  );
};
export default PlayGame;
`,

  'memory-match': (g) => header(g) + `
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
      <h2>${g.emoji} ${g.title}</h2>
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
`,

  'rocket-math': (g) => header(g) + `
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
      <h2>${g.emoji} ${g.title}</h2>
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
`,

  'word-builder': (g) => header(g) + `
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
      <h2>${g.emoji} ${g.title}</h2>
      <p>Spell: <strong>{current.word}</strong></p>
      <div style={{ fontSize: 36, minHeight: 48, letterSpacing: 8 }}>{built || '_'.repeat(current.word.length)}</div>
      <div>{current.pool.map((l, i) => <button key={i} style={btn} onClick={() => tap(l)}>{l}</button>)}</div>
      <h3>{won ? '🎉 You spelled ' + current.word + '!' : 'Tap the letters in order!'}</h3>
      {won && <button style={btn} onClick={() => { setRound((r) => r + 1); setBuilt(''); }}>Next word</button>}
    </div>
  );
};
export default PlayGame;
`,

  'rhythm-tap': (g) => header(g) + `
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
      <h2>${g.emoji} ${g.title}</h2>
      <p>Drum this pattern: <strong>{PATTERN.join(' ')}</strong></p>
      <div>{PADS.map((pad) => <button key={pad} style={btn} onClick={() => tap(pad)}>🥁{pad}</button>)}</div>
      <h3>{won ? '🎉 You got the rhythm!' : 'So far: ' + (taps.join(' ') || '—')}</h3>
      {won && <button style={btn} onClick={() => setTaps([])}>Play again</button>}
    </div>
  );
};
export default PlayGame;
`,

  'maze-runner': (g) => header(g) + `
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
      <h2>${g.emoji} ${g.title}</h2>
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
`,
};

// ── Generate the games ───────────────────────────────────────

for (const game of GAMES) {
  const dest = join(ROOT, game.id);
  rmSync(dest, { recursive: true, force: true });
  copyTree(TEMPLATE, dest, game);

  const features = join(dest, 'src', 'features');
  rmSync(features, { recursive: true, force: true });
  for (const [name, content] of [
    ['PlayGame', PLAY_GAMES[game.id](game)],
    ['ShowCover', showCover(game)],
    ['GetGameInfo', getGameInfo(game)],
  ]) {
    const dir = join(features, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, name + '.tsx'), content);
    writeFileSync(join(dir, 'index.ts'), featureIndex(name));
  }
  writeFileSync(join(features, 'PlayGame', 'PlayGame.test.tsx'), playGameTest(game));
  writeFileSync(join(features, 'ShowCover', 'ShowCover.test.tsx'), coverTest(game));
  writeFileSync(join(features, 'GetGameInfo', 'GetGameInfo.test.tsx'), infoTest(game));

  writeFileSync(join(dest, 'README.md'),
    '# abc-kids-' + game.id + ' ' + game.emoji + '\n\n' + game.desc + '\n\n' +
    'Generated by `scripts/generate-games.mjs` from the hockey reference structure\n' +
    '(seans-mfe-tool codegen layout). Port ' + game.port + '. Do not edit generated\n' +
    'boilerplate by hand — change the generator and re-run.\n');
  console.log('generated ' + game.id + ' (port ' + game.port + ')');
}

// ── docker-compose overlay ───────────────────────────────────

const compose = ['# Generated by scripts/generate-games.mjs — do not edit by hand.',
  '# Usage: docker compose -f docker-compose.yaml -f docker-compose.games.yaml up -d',
  'services:'];
for (const game of GAMES) {
  compose.push(
    '  abc-kids-' + game.id + ':',
    '    build: ./' + game.id,
    '    ports:',
    '      - "' + game.port + ':' + game.port + '"',
    '    healthcheck:',
    '      test: ["CMD", "curl", "-fsS", "http://localhost:' + game.port + '/remoteEntry.js"]',
    '      interval: 10s',
    '      timeout: 3s',
    '      retries: 12',
    ''
  );
}
writeFileSync(join(ROOT, 'docker-compose.games.yaml'), compose.join('\n'));

// ── Control-plane registration script (ADR-054 / ADR-055) ───

const all = [
  ...EXISTING,
  ...GAMES.map((g) => ({ id: g.id, port: g.port, scope: 'abc_kids_' + underscore(g.id), name: 'abc-kids-' + g.id })),
];
const reg = ['#!/usr/bin/env bash',
  '# Generated by scripts/generate-games.mjs — registers every ABC Kids game',
  '# with the control-plane registry (ADR-054/ADR-055). Each game gets a',
  '# resolution route: stateKey abc.play.<game> -> PlayGame in the main slot.',
  'set -euo pipefail',
  'REGISTRY=${REGISTRY:-http://localhost:4000}',
  ''];
for (const m of all) {
  reg.push(
    'curl -fsS -X POST "$REGISTRY/mfes" -H "Content-Type: application/json" -d \'' + JSON.stringify({
      registration: {
        name: m.name, version: '1.0.0', type: 'remote',
        baseUrl: 'http://localhost:' + m.port,
        capabilities: ['load', 'render'],
        contentType: 'module-federation',
        remoteEntryUrl: 'http://localhost:' + m.port + '/remoteEntry.js',
        moduleFederation: { scope: m.scope, module: './App', component: 'PlayGame' },
      },
      routes: [{ when: { stateKey: 'abc.play.' + m.id }, resolve: { capability: 'PlayGame', props: { slot: 'main' } } }],
    }) + '\' && echo " registered ' + m.name + '"'
  );
}
reg.push('', 'echo "All ' + all.length + ' games registered. Compose any of them with e.g.:"',
  'echo "  ./scripts/play.sh ' + all[2].id + '"', '');
writeFileSync(join(ROOT, 'scripts', 'register-games.sh'), reg.join('\n'), { mode: 0o755 });

// Kickoff helper: swap any game into the shell via one state change.
writeFileSync(join(ROOT, 'scripts', 'play.sh'), `#!/usr/bin/env bash
# Generated by scripts/generate-games.mjs.
# Usage: ./scripts/play.sh <game-id>   e.g. ./scripts/play.sh rocket-math
set -euo pipefail
GAME="\${1:?usage: play.sh <game-id>}"
DAEMON=\${DAEMON:-http://localhost:3004}
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
ID="play-$GAME-$(date +%s)"
MSG=$(printf '{"direction":"ACTION","kind":"ACTION","payload":{"id":"%s","componentId":"app","actionType":"STATE_UPDATE","stateKey":"abc.play.%s","data":{},"timestamp":"%s","context":{"sessionId":"demo","application":"web"}},"metadata":{"correlationId":"%s","acknowledged":false,"error":null}}' "$ID" "$GAME" "$NOW" "$ID")
curl -fsS -X POST "$DAEMON/graphql" -H 'Content-Type: application/json' \\
  --data "$(printf '{"query":"mutation($m:String!){sendMessage(message:$m)}","variables":{"m":%s}}' "$(printf '%s' "$MSG" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')")"
echo " -> $GAME requested"
`, { mode: 0o755 });

console.log('generated docker-compose.games.yaml, scripts/register-games.sh, scripts/play.sh');
