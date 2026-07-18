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
 * Also generates the home/launcher MFE (port 3015, ADR-058) and regenerates:
 *   docker-compose.games.yaml   (one service per game + home, ports 3005-3015)
 *   scripts/register-games.sh   (registers every game + the home, with the
 *                                root catalog rule — ADR-054/055/057/058)
 *   scripts/home.sh             (composes the home into the empty shell)
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

// The home/launcher MFE (ADR-058): one MFE that renders the menu and provides
// the 'main' + 'info' slots the games compose into. Generated from the same
// template as the games, but with a single GameMenu capability.
const HOME = {
  id: 'home', port: 3015, emoji: '🧸', title: 'ABC Kids',
  desc: 'ABC Kids — the home launcher; pick a game to play!', color: '#5e35b1',
  tags: ['kids', 'launcher', 'home', 'shell'],
};

// The catalog the home tiles render — a snapshot of every registered game.
// register-games.sh embeds this in the root route props, so the registry
// "returns all MFEs" on the root action with no daemon/registry code (ADR-058).
const CATALOG = [
  { id: 'flappy', title: 'Flappy', emoji: '🐤', color: '#0277bd' },
  { id: 'hockey', title: 'Hockey', emoji: '🏒', color: '#37474f' },
  { id: 'multiplication-quiz', title: 'Multiplication Quiz', emoji: '✖️', color: '#6a1b9a' },
  ...GAMES.map((g) => ({ id: g.id, title: g.title, emoji: g.emoji, color: g.color })),
];

const SKIP = new Set(['node_modules', 'dist', 'package-lock.json', '.turbo']);
// The game Dockerfile is NOT copied from the template — games build FROM the
// shared dependency pack (abc-kids-game-base) instead; see gameDockerfile().
const SKIP_FILES = new Set(['Dockerfile']);
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
    if (SKIP.has(entry) || SKIP_FILES.has(entry)) continue;
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

// Remote entry — exposes domain capabilities AND the ADR-056 presentation
// handle so a host-side provider composes the MFE through the sealed port
// (handles.imperative.mount(element, props) → unmount), bound to PlayGame.
const remoteEntry = () => `/**
 * Remote Entry Point — domain capabilities + the ADR-056 presentation handle.
 * Generated by scripts/generate-games.mjs — do not edit by hand.
 */
import { createImperativeHandle } from '@seans-mfe-tool/runtime';
import { mfe, mfeReady } from './platform/base-mfe/bootstrap';
import { PlayGame } from './features/PlayGame/PlayGame.tsx';
import { ShowCover } from './features/ShowCover/ShowCover.tsx';
import { GetGameInfo } from './features/GetGameInfo/GetGameInfo.tsx';

export { PlayGame, ShowCover, GetGameInfo };
export { mfe, mfeReady };

/** Multi-capability MFE (PlayGame, ShowCover, GetGameInfo): the host-side
 *  provider selects one per mount via handles.imperative.mount(el,
 *  { capability, props }); PlayGame is the default. */
export const handles = {
  imperative: createImperativeHandle(mfe, {
    framework: 'react',
    mfeReady,
    defaultCapability: 'PlayGame',
  }),
};

export { default } from './App.tsx';
`;

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

// ── Docker: shared dependency pack + per-game build ──────────
// One dependency pack, many independently deployable features: the games are
// structurally identical, so npm install runs ONCE (abc-kids-game-base) and
// every game image builds FROM it. Test-only tooling (jest, eslint,
// supertest, testing-library, serve) stays in each game's package.json for
// local dev but never enters an image build.

const BASE_DEV_DEP_ALLOWLIST = [
  '@rspack/cli',
  '@rspack/core',
  'typescript',
  '@types/react',
  '@types/react-dom',
  '@types/node',
];

function gameBasePackageJson() {
  const template = JSON.parse(readFileSync(join(TEMPLATE, 'package.json'), 'utf8'));
  const devDependencies = {};
  for (const name of BASE_DEV_DEP_ALLOWLIST) {
    if (template.devDependencies?.[name]) devDependencies[name] = template.devDependencies[name];
  }
  return JSON.stringify({
    name: 'abc-kids-game-base',
    version: '1.0.0',
    private: true,
    description:
      'Shared dependency pack for the generated ABC Kids games — one npm install serves every game image. Generated by scripts/generate-games.mjs.',
    dependencies: template.dependencies,
    devDependencies,
    overrides: template.overrides,
    engines: template.engines,
  }, null, 2) + '\n';
}

const GAME_BASE_DOCKERFILE = `# abc-kids-game-base — the shared dependency pack
# Generated by scripts/generate-games.mjs — do not edit by hand.
#
# Every generated game image builds FROM this image: the dependency set is
# identical across games, so npm install runs once here instead of once per
# game (~10x less peak disk and build time for the fleet).
#
# Build AFTER the CLI image (which provides the pre-compiled runtime):
#   docker build -t abc-kids-game-base:latest ./game-base
# scripts/build-games.sh handles the full ordering.

FROM seans-mfe-tool-cli:latest AS cli-builder

FROM node:20-alpine
COPY --from=cli-builder /seans-mfe-tool /seans-mfe-tool
RUN chmod +x /seans-mfe-tool/bin/run.js && \\
    ln -sf /seans-mfe-tool/bin/run.js /usr/local/bin/seans-mfe-tool

WORKDIR /deps
COPY package.json ./
RUN npm install --no-audit --no-fund

# Runtime as a real directory inside the shared node_modules (same pattern as
# the hand-built MFE Dockerfiles): module resolution never leaves the pack.
RUN mkdir -p node_modules/@seans-mfe-tool && \\
    cp -r /seans-mfe-tool/dist/runtime node_modules/@seans-mfe-tool/runtime
`;

const gameDockerfile = (g) => `# abc-kids-${g.id} — generated by scripts/generate-games.mjs (do not edit by hand)
# Built FROM the shared dependency pack: one install, many independently
# deployable features. Build abc-kids-game-base:latest first
# (scripts/build-games.sh handles the order).

FROM abc-kids-game-base:latest AS builder
WORKDIR /app
COPY . .
# The dependency pack provides node_modules — nothing is installed here.
RUN rm -rf node_modules && ln -s /deps/node_modules /app/node_modules
RUN npm run build

# Unprivileged nginx (ADR-044): non-root user, port ${g.port} (>1024).
FROM nginxinc/nginx-unprivileged:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE ${g.port}
CMD ["nginx", "-g", "daemon off;"]
`;

// ── Home / launcher MFE templates (ADR-058) ──────────────────

const homeManifest = () => `name: abc-kids-home
version: 1.0.0
type: remote
language: typescript
framework: react
bundler: rspack
description: ABC Kids — the home launcher; pick a game to play!
owner: abc-kids-team
tags: [kids, launcher, home, shell]
category: launcher

endpoint: http://localhost:3015
remoteEntry: http://localhost:3015/remoteEntry.js
discovery: http://localhost:3015/.well-known/mfe-manifest.yaml

capabilities:
  - GameMenu:
      type: domain
      description: Render the ABC Kids home — a tile per registered game; selecting one drives the control plane

  - Load:
      type: platform
      lifecycle:
        before:
          - onLoadBegin:
              handler: onLoadBegin
              description: Log load lifecycle entry
        after:
          - onLoadComplete:
              handler: onLoadComplete
              description: Log load success and available components
        error:
          - onLoadError:
              handler: onLoadError
              contained: true
              description: Log load failure

  - Render:
      type: platform
      lifecycle:
        before:
          - onRenderBegin:
              handler: onRenderBegin
              description: Log render lifecycle entry
        after:
          - onRenderComplete:
              handler: onRenderComplete
              description: Log render success
        error:
          - onRenderError:
              handler: onRenderError
              contained: true
              description: Log render failure

providesSlots:
  - id: main
    description: Primary game region
  - id: info
    description: Contextual game information region

dependencies:
  runtime:
    react: ^18.2.0
    react-dom: ^18.2.0
  design-system:
    '@mui/material': ^5.14.0
    '@emotion/react': ^11.11.1
    '@emotion/styled': ^11.11.0
`;

const homeRemoteEntry = () => `/**
 * Remote Entry Point — the home/launcher capability + the ADR-056 presentation
 * handle. Generated by scripts/generate-games.mjs — do not edit by hand.
 */
import { createImperativeHandle } from '@seans-mfe-tool/runtime';
import { mfe, mfeReady } from './platform/base-mfe/bootstrap';
import { GameMenu } from './features/GameMenu/GameMenu.tsx';

export { GameMenu };
export { mfe, mfeReady };

/** Single-capability launcher MFE. The host composes it via
 *  handles.imperative.mount(el, { capability: 'GameMenu', props }). */
export const handles = {
  imperative: createImperativeHandle(mfe, {
    framework: 'react',
    mfeReady,
    defaultCapability: 'GameMenu',
  }),
};

export { default } from './App.tsx';
`;

const gameMenu = () => `import React, { useCallback } from 'react';
import { mfe } from '../../platform/base-mfe/bootstrap';
import { slotContract } from '../../slots';

/**
 * GameMenu — the ABC Kids home (ADR-058). Renders a tile per registered game in
 * its own menu region, and contributes the 'main' and 'info' regions to the
 * host as slots (provideSlot) so selected games compose alongside the menu.
 * A tile drives the control plane via the inherited BaseMFE platform capability
 * updateControlPlaneState (ADR-057) — no direct knowledge of any game.
 */
interface Game {
  id: string;
  title: string;
  emoji?: string;
  color?: string;
}

interface GameMenuProps {
  /** Catalog injected by the registry root rule (ADR-058). */
  games?: Game[];
  /** Host callback to contribute or release a slot element (ADR-058). */
  provideSlot?: (slotId: string, element: HTMLElement | null) => void;
}

// Narrow view of the MFE's inherited platform capability — avoids importing the
// full Context type into example feature code.
type ControlPlane = {
  updateControlPlaneState(ctx: {
    requestId: string;
    timestamp: Date;
    inputs: { stateKey: string };
  }): Promise<unknown>;
};

function dispatch(verb: 'play' | 'show', id: string): void {
  const cp = mfe as unknown as ControlPlane;
  void cp.updateControlPlaneState({
    requestId: verb + '-' + id + '-' + Date.now(),
    timestamp: new Date(),
    inputs: { stateKey: 'abc.' + verb + '.' + id },
  });
}

export const GameMenu: React.FC<GameMenuProps> = ({ games = [], provideSlot }) => {
  // Register the two contributed regions through the manifest-backed slot
  // contract (ADR-067, generated src/slots.tsx): assertDeclared runs on every
  // bind, so a region id not in the manifest's providesSlots fails fast instead
  // of silently registering an address the registry rules never validate. This
  // replaces the raw provideSlot('main', ref) magic string with the contract —
  // declaration and behavior share one source (the manifest).
  const registerMain = useCallback(
    (el: HTMLElement | null) => slotContract.register(provideSlot, 'main', el),
    [provideSlot]
  );
  const registerInfo = useCallback(
    (el: HTMLElement | null) => slotContract.register(provideSlot, 'info', el),
    [provideSlot]
  );

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(220px, 280px) 1fr minmax(220px, 300px)',
        gap: 16,
        minHeight: '90vh',
        padding: 16,
        boxSizing: 'border-box',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        background: '#f6f4fb',
      }}
    >
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <header>
          <h1 style={{ margin: '4px 0', fontSize: 28 }}>🧸 ABC Kids</h1>
          <p style={{ margin: 0, color: '#666' }}>Pick a game to play</p>
        </header>
        <div style={{ display: 'grid', gap: 10 }} role="list">
          {games.map((g) => (
            <div
              key={g.id}
              role="listitem"
              onClick={() => dispatch('play', g.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 14px',
                borderRadius: 14,
                cursor: 'pointer',
                color: '#fff',
                background: g.color || '#5e35b1',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              }}
            >
              <span style={{ fontSize: 26 }}>{g.emoji || '🎮'}</span>
              <span style={{ flex: 1, fontWeight: 600 }}>{g.title}</span>
              <button
                aria-label={'About ' + g.title}
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch('show', g.id);
                }}
                style={{
                  border: 'none',
                  borderRadius: '50%',
                  width: 26,
                  height: 26,
                  cursor: 'pointer',
                  background: 'rgba(255,255,255,0.25)',
                  color: '#fff',
                }}
              >
                {'\\u2139'}
              </button>
            </div>
          ))}
          {games.length === 0 && (
            <p style={{ color: '#999' }}>No games registered yet — run ./scripts/register-games.sh</p>
          )}
        </div>
      </nav>

      {/* Contributed to the host as slot 'main' — the selected game mounts here. */}
      <section
        ref={registerMain}
        aria-label="game"
        style={{
          borderRadius: 16,
          background: '#fff',
          boxShadow: 'inset 0 0 0 1px #e6e1f2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#bbb',
        }}
      >
        Select a game from the menu
      </section>

      {/* Contributed to the host as slot 'info' — cover / game info mounts here. */}
      <aside
        ref={registerInfo}
        aria-label="info"
        style={{
          borderRadius: 16,
          background: '#fff',
          boxShadow: 'inset 0 0 0 1px #e6e1f2',
          padding: 12,
          color: '#bbb',
        }}
      >
        Tap the info button on a game for details
      </aside>
    </div>
  );
};

export default GameMenu;
`;

const gameMenuTest = () => `import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('../../platform/base-mfe/bootstrap', () => ({
  mfe: { updateControlPlaneState: jest.fn().mockResolvedValue(undefined) },
  mfeReady: Promise.resolve(),
}));

import { GameMenu } from './GameMenu';

describe('GameMenu (ABC Kids home)', () => {
  it('renders a tile per game from the injected catalog', () => {
    render(<GameMenu games={[{ id: 'flappy', title: 'Flappy', emoji: '🐤' }]} />);
    expect(screen.getByText('Flappy')).toBeInTheDocument();
  });

  it('contributes the main and info slots to the host on mount (ADR-058)', () => {
    const provided: string[] = [];
    render(<GameMenu games={[]} provideSlot={(id) => provided.push(id)} />);
    expect(provided).toEqual(expect.arrayContaining(['main', 'info']));
  });

  it('releases the main and info slots on unmount', () => {
    const calls: Array<[string, HTMLElement | null]> = [];
    const { unmount } = render(
      <GameMenu games={[]} provideSlot={(id, element) => calls.push([id, element])} />
    );
    unmount();
    expect(calls).toEqual(
      expect.arrayContaining([
        ['main', null],
        ['info', null],
      ])
    );
  });
});
`;

// Standalone entry — overwrites the copied hockey index.tsx, which
// `remote:generate` skips (it only owns the platform/remote files). Without
// this the home would still import the three game features and fail to build.
const homeIndex = () => `/**
 * Standalone entry — renders the GameMenu home with a sample catalog so the MFE
 * can run in isolation (npm run dev). In the shell, the daemon supplies the
 * catalog and the host provides the slots. Generated — do not edit by hand.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { GameMenu } from './features/GameMenu/GameMenu';

const sample = [
  { id: 'flappy', title: 'Flappy', emoji: '🐤', color: '#0277bd' },
  { id: 'hockey', title: 'Hockey', emoji: '🏒', color: '#37474f' },
  { id: 'rocket-math', title: 'Rocket Math', emoji: '🚀', color: '#0d47a1' },
];

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element not found');
}
createRoot(container).render(
  <React.StrictMode>
    <GameMenu games={sample} />
  </React.StrictMode>
);
`;

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

  // Overwrite the copied remote.tsx with the handle-exposing entry (ADR-056).
  writeFileSync(join(dest, 'src', 'remote.tsx'), remoteEntry());

  writeFileSync(join(dest, 'Dockerfile'), gameDockerfile(game));

  writeFileSync(join(dest, 'README.md'),
    '# abc-kids-' + game.id + ' ' + game.emoji + '\n\n' + game.desc + '\n\n' +
    'Generated by `scripts/generate-games.mjs` from the hockey reference structure\n' +
    '(seans-mfe-tool codegen layout). Port ' + game.port + '. Docker image builds\n' +
    'FROM the shared dependency pack (`game-base/`). Do not edit generated\n' +
    'boilerplate by hand — change the generator and re-run.\n');
  console.log('generated ' + game.id + ' (port ' + game.port + ')');
}

// ── Generate the home / launcher MFE (ADR-058) ───────────────
// Mirrors packages/codegen/templates/base-mfe/slots.tsx.ejs for the home's
// manifest (providesSlots: main, info) — the DATA layer of ADR-067. Keep in
// lock-step with the codegen template; GameMenu imports slotContract from it.
const homeSlots = () => `/**
 * Slot contract for abc-kids-home — GENERATED from mfe-manifest \`providesSlots\`.
 * Do not edit: regenerate after changing the manifest.
 *
 * Three-layer split (ADR-067): this file is the DATA layer — the manifest
 * mirrored into code and bound to the framework-free contract logic in
 * @seans-mfe-tool/runtime. Matching and the declare-before-register guard
 * live there, once; the DeclaredSlot below is thin sugar with no logic of
 * its own. Ids are assigned names, never positions (ADR-066); renaming one
 * is a manifest diff — a contract change, not an incidental string edit.
 */
import React, { useCallback } from 'react';
import { createSlotContract } from '@seans-mfe-tool/runtime';
import type { ProvidedSlotDeclaration } from '@seans-mfe-tool/runtime';

/** The manifest's providesSlots section, mirrored into code. */
export const PROVIDED_SLOTS: readonly ProvidedSlotDeclaration[] = [
  { id: "main", description: "Primary game region" },
  { id: "info", description: "Contextual game information region" },
] as const;

/** This MFE's slot contract: matching + declare-before-register guard. */
export const slotContract = createSlotContract(PROVIDED_SLOTS);

export interface DeclaredSlotProps {
  /** The slot id to register — must match a manifest declaration. */
  id: string;
  /**
   * The host-supplied registration callback (ADR-058), delivered to this MFE
   * through its render props by the LayoutManager adaptor. Optional so the
   * component renders inert in standalone/dev mode — undeclared ids still
   * fail fast either way.
   */
  provideSlot?: (slotId: string, element: HTMLElement | null) => void;
  className?: string;
  children?: React.ReactNode;
}

/**
 * A named region this MFE contributes to the host layout. Registration rides
 * a stable ref callback; re-registration on remount is safe because the host
 * re-binds the address's desired experience instead of destroying it (ADR-066).
 *
 * Keep in lock-step with packages/framework-react/src/runtime/DeclaredSlot.tsx:
 * this is the same component with the contract pre-bound instead of passed as
 * a prop (generated MFEs depend on the runtime package, not framework-react).
 * A change to ref-callback or registration semantics must land in both.
 */
export function DeclaredSlot({
  id,
  provideSlot,
  className,
  children,
}: DeclaredSlotProps): React.ReactElement {
  slotContract.assertDeclared(id);

  const register = useCallback(
    (element: HTMLElement | null) => slotContract.register(provideSlot, id, element),
    [id, provideSlot]
  );

  return (
    <div ref={register} className={className} data-declared-slot={id}>
      {children}
    </div>
  );
}
`;

// Same template as the games, but a single GameMenu capability. The manifest
// drives `seans-mfe-tool remote:generate` at build time (regenerates
// remote.tsx / mfe.ts / bootstrap); the GameMenu feature is preserved.
{
  const dest = join(ROOT, HOME.id);
  rmSync(dest, { recursive: true, force: true });
  copyTree(TEMPLATE, dest, HOME);

  const features = join(dest, 'src', 'features');
  rmSync(features, { recursive: true, force: true });
  const gmDir = join(features, 'GameMenu');
  mkdirSync(gmDir, { recursive: true });
  writeFileSync(join(gmDir, 'GameMenu.tsx'), gameMenu());
  writeFileSync(join(gmDir, 'index.ts'), featureIndex('GameMenu'));
  writeFileSync(join(gmDir, 'GameMenu.test.tsx'), gameMenuTest());

  writeFileSync(join(dest, 'mfe-manifest.yaml'), homeManifest());
  writeFileSync(join(dest, 'src', 'slots.tsx'), homeSlots());
  writeFileSync(join(dest, 'src', 'remote.tsx'), homeRemoteEntry());
  writeFileSync(join(dest, 'src', 'index.tsx'), homeIndex());
  writeFileSync(join(dest, 'Dockerfile'), gameDockerfile(HOME));
  writeFileSync(join(dest, 'README.md'), `# abc-kids-home 🧸

ABC Kids — the home launcher; pick a game to play!

The home/launcher MFE (ADR-058) renders the game catalog supplied by the
registry's \`abc.root\` rule. It is also the layout provider:

- \`mfe-manifest.yaml\` declares local slots \`main\` and \`info\`.
- Codegen mirrors those declarations into \`src/slots.tsx\`.
- \`GameMenu\` registers the regions through the generated \`slotContract\`.
- The host scopes them to \`abc-kids-home/main\` and
  \`abc-kids-home/info\` (ADR-068).

Selecting a tile drives the control plane through
\`updateControlPlaneState\` (ADR-057); the home knows state-key grammar, not
how the shell or target game is implemented.

This example is generated by \`scripts/generate-games.mjs\`; update the
generator when changing generated files.
`);
  console.log('generated home (port ' + HOME.port + ')');
}

// ── Shared dependency pack ───────────────────────────────────

const baseDir = join(ROOT, 'game-base');
rmSync(baseDir, { recursive: true, force: true });
mkdirSync(baseDir, { recursive: true });
writeFileSync(join(baseDir, 'Dockerfile'), GAME_BASE_DOCKERFILE);
writeFileSync(join(baseDir, 'package.json'), gameBasePackageJson());
writeFileSync(join(baseDir, 'README.md'),
  '# abc-kids-game-base\n\nThe shared dependency pack: one `npm install` serving every generated\n' +
  'game image. Generated by `scripts/generate-games.mjs` — change the game\n' +
  'dependency set in the hockey template (the canonical structure) and re-run.\n');
console.log('generated game-base (shared dependency pack)');

// ── Fleet build script (ordered, disk-bounded) ───────────────

const buildScript = `#!/usr/bin/env bash
# Generated by scripts/generate-games.mjs — builds the whole ABC Kids fleet
# with bounded peak disk usage:
#   1. seans-mfe-tool-cli:latest   (pre-compiled runtime; SKIP_CLI=1 to skip)
#   2. abc-kids-game-base:latest   (shared dependency pack — ONE npm install)
#   3. every service, sequentially (COMPOSE_BAKE=false avoids 13 parallel
#      installs exhausting the Docker VM disk)
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ "\${SKIP_CLI:-0}" != "1" ]]; then
  echo "==> 1/3 seans-mfe-tool-cli:latest (set SKIP_CLI=1 if already fresh)"
  (cd ../.. && npm run build && npm run docker:build:cli)
fi

echo "==> 2/3 abc-kids-game-base:latest (shared dependency pack)"
docker build -t abc-kids-game-base:latest ./game-base

echo "==> 3/3 service images (sequential; one failure does not block the fleet)"
SERVICES=(
  abc-kids-shell
  abc-kids-flappy
  abc-kids-hockey
  abc-kids-multiplication-quiz
  abc-kids-home
${GAMES.map((g) => '  abc-kids-' + g.id).join('\n')}
)
FAILED=()
BUILT=()
for svc in "\${SERVICES[@]}"; do
  echo "--- \$svc"
  if COMPOSE_BAKE=false docker compose -f docker-compose.yaml -f docker-compose.games.yaml build "\$svc"; then
    BUILT+=("\$svc")
  else
    echo "!!! \$svc build failed — continuing with the rest of the fleet"
    FAILED+=("\$svc")
  fi
done

echo "==> starting everything that built"
if [[ \${#BUILT[@]} -gt 0 ]]; then
  docker compose -f docker-compose.yaml -f docker-compose.games.yaml up -d --no-build "\${BUILT[@]}"
fi

if [[ \${#FAILED[@]} -gt 0 ]]; then
  echo ""
  echo "==> done WITH FAILURES — these services did not build/start:"
  printf '    %s\\n' "\${FAILED[@]}"
  exit 1
fi
echo "==> done — full fleet built and started"
`;
writeFileSync(join(ROOT, 'scripts', 'build-games.sh'), buildScript, { mode: 0o755 });

// ── docker-compose overlay ───────────────────────────────────

const compose = ['# Generated by scripts/generate-games.mjs — do not edit by hand.',
  '# Usage: docker compose -f docker-compose.yaml -f docker-compose.games.yaml up -d',
  'services:',
  // Home / launcher MFE (ADR-058), port 3015.
  '  abc-kids-home:',
  '    build: ./home',
  '    ports:',
  '      - "3015:3015"',
  '    healthcheck:',
  '      test: ["CMD", "curl", "-fsS", "http://localhost:3015/remoteEntry.js"]',
  '      interval: 10s',
  '      timeout: 3s',
  '      retries: 12',
  ''];
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
  '# with the control-plane registry (ADR-054/ADR-055). Each game is multi-',
  '# capability (ADR-056): three routes map state to a capability in the main',
  '# slot — abc.play.<game> -> PlayGame, abc.show.<game> -> ShowCover,',
  '# abc.info.<game> -> GetGameInfo. The registration does NOT pin',
  '# moduleFederation.component, so the resolved capability per route drives',
  '# which component the LayoutManager mounts.',
  'set -euo pipefail',
  'REGISTRY=${REGISTRY:-http://localhost:4000}',
  ''];
// The Angular quiz is a hand-built MFE (not in GAMES); it registers with the
// same slot/route grammar so the shell composes it identically (ADR-067 parity).
const QUIZ = {
  id: 'multiplication-quiz', port: 3003, scope: 'abc_kids_multiplication_quiz',
  name: 'abc-kids-multiplication-quiz', module: './Component',
  comment: '# abc-kids-multiplication-quiz — the Angular MFE (with a mock GraphQL BFF, ADR-052). Same slot/route grammar as the React games; the shell composes it identically.',
  echoSuffix: ' (Angular — PlayGame/ShowCover/GetGameInfo)',
};
const registered = [...all.slice(0, 2), QUIZ, ...all.slice(2)];
for (const m of registered) {
  if (m.comment) reg.push(m.comment);
  reg.push(
    'curl -fsS -X POST "$REGISTRY/mfes" -H "Content-Type: application/json" -d \'' + JSON.stringify({
      registration: {
        name: m.name, version: '1.0.0', type: 'remote',
        baseUrl: 'http://localhost:' + m.port,
        capabilities: ['load', 'render'],
        contentType: 'module-federation',
        remoteEntryUrl: 'http://localhost:' + m.port + '/remoteEntry.js',
        // No pinned `component`: the daemon synthesizes the experience as
        // `moduleFederation.component || capability`, so omitting it lets each
        // route's resolved capability select the mounted component (ADR-056).
        moduleFederation: { scope: m.scope, module: m.module || './App' },
      },
      // Provided addresses are scoped by the stable home MFE id (ADR-068).
      routes: [
        { when: { stateKey: 'abc.play.' + m.id }, resolve: { capability: 'PlayGame', props: { slot: 'abc-kids-home/main' } } },
        { when: { stateKey: 'abc.show.' + m.id }, resolve: { capability: 'ShowCover', props: { slot: 'abc-kids-home/info' } } },
        { when: { stateKey: 'abc.info.' + m.id }, resolve: { capability: 'GetGameInfo', props: { slot: 'abc-kids-home/info' } } },
      ],
    }) + '\' && echo " registered ' + m.name + (m.echoSuffix || ' (PlayGame/ShowCover/GetGameInfo)') + '"'
  );
}

// Home / launcher MFE (ADR-058): the root rule (when stateKey abc.root) resolves
// GameMenu and embeds the full catalog in the resolution props — so the registry
// "returns all MFEs" with NO daemon/registry code, only a rule. The home renders
// a tile per game and provides the 'main' + 'info' slots the games mount into.
reg.push('',
  '# Home / launcher MFE — root rule returns the full game catalog (ADR-058).',
  'curl -fsS -X POST "$REGISTRY/mfes" -H "Content-Type: application/json" -d \'' + JSON.stringify({
    registration: {
      name: 'abc-kids-home', version: '1.0.0', type: 'remote',
      baseUrl: 'http://localhost:' + HOME.port,
      capabilities: ['load', 'render'],
      contentType: 'module-federation',
      remoteEntryUrl: 'http://localhost:' + HOME.port + '/remoteEntry.js',
      moduleFederation: { scope: 'abc_kids_home', module: './App' },
    },
    routes: [
      { when: { stateKey: 'abc.root' }, resolve: { capability: 'GameMenu', props: { slot: 'root', games: CATALOG } } },
    ],
  }) + '\' && echo " registered abc-kids-home (GameMenu — root rule returns ' + CATALOG.length + ' games)"');

reg.push('',
  'echo "All ' + registered.length + ' games + home registered. Compose the home with:"',
  'echo "  ./scripts/home.sh"',
  'echo "...then pick a game in the UI, or drive it directly:"',
  'echo "  ./scripts/play.sh ' + all[2].id + '"', '');
writeFileSync(join(ROOT, 'scripts', 'register-games.sh'), reg.join('\n'), { mode: 0o755 });

// Kickoff helper: compose the home/launcher into the empty shell (ADR-058).
writeFileSync(join(ROOT, 'scripts', 'home.sh'), `#!/usr/bin/env bash
# Generated by scripts/generate-games.mjs.
# Composes the ABC Kids home into the empty shell: sends the root state change;
# the registry's root rule resolves the home MFE, which renders the menu and
# provides the 'main' + 'info' slots the games mount into (ADR-058).
set -euo pipefail
DAEMON=\${DAEMON:-http://localhost:3004}
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
ID="root-$(date +%s)"
MSG=$(printf '{"direction":"ACTION","kind":"ACTION","payload":{"id":"%s","componentId":"shell","actionType":"STATE_UPDATE","stateKey":"abc.root","data":{},"timestamp":"%s","context":{"sessionId":"demo","application":"web"}},"metadata":{"correlationId":"%s","acknowledged":false,"error":null}}' "$ID" "$NOW" "$ID")
curl -fsS -X POST "$DAEMON/graphql" -H 'Content-Type: application/json' \\
  --data "$(printf '{"query":"mutation($m:String!){sendMessage(message:$m)}","variables":{"m":%s}}' "$(printf '%s' "$MSG" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')")"
echo " -> home requested (abc.root)"
`, { mode: 0o755 });

// Kickoff helper: swap any game into the shell via one state change.
writeFileSync(join(ROOT, 'scripts', 'play.sh'), `#!/usr/bin/env bash
# Generated by scripts/generate-games.mjs.
# Usage: ./scripts/play.sh <game-id> [verb]   verb = play | show | info (default: play)
#   play -> PlayGame, show -> ShowCover, info -> GetGameInfo (ADR-056 multi-capability)
#   e.g. ./scripts/play.sh rocket-math        # PlayGame
#        ./scripts/play.sh rocket-math show   # ShowCover, same MFE + slot
set -euo pipefail
GAME="\${1:?usage: play.sh <game-id> [play|show|info]}"
VERB="\${2:-play}"
case "$VERB" in play|show|info) ;; *) echo "verb must be play|show|info (got: $VERB)" >&2; exit 2 ;; esac
DAEMON=\${DAEMON:-http://localhost:3004}
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
ID="$VERB-$GAME-$(date +%s)"
MSG=$(printf '{"direction":"ACTION","kind":"ACTION","payload":{"id":"%s","componentId":"app","actionType":"STATE_UPDATE","stateKey":"abc.%s.%s","data":{},"timestamp":"%s","context":{"sessionId":"demo","application":"web"}},"metadata":{"correlationId":"%s","acknowledged":false,"error":null}}' "$ID" "$VERB" "$GAME" "$NOW" "$ID")
curl -fsS -X POST "$DAEMON/graphql" -H 'Content-Type: application/json' \\
  --data "$(printf '{"query":"mutation($m:String!){sendMessage(message:$m)}","variables":{"m":%s}}' "$(printf '%s' "$MSG" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')")"
echo " -> $GAME $VERB requested"
`, { mode: 0o755 });

console.log('generated docker-compose.games.yaml, scripts/register-games.sh, scripts/play.sh');
