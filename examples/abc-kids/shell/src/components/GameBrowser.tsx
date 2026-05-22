import React, { useState } from 'react';
import {
  Box, Typography, Grid, Card, CardActionArea, Chip, TextField, InputAdornment,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import LandscapeCanvas from './LandscapeCanvas';
import { GameMeta } from '../App';

const GAMES: GameMeta[] = [
  {
    id: 'flappy',
    title: 'Flappy Bird',
    emoji: '🐦',
    coverBg: 'linear-gradient(135deg, #87CEEB 0%, #228B22 100%)',
    desc: 'Tap to flap — avoid the pipes and keep going!',
    ageMin: 4, ageMax: 10,
    categories: ['Fun'],
    color: '#FFD700',
  },
  {
    id: 'hockey',
    title: 'Ice Hockey',
    emoji: '🏒',
    coverBg: 'linear-gradient(135deg, #4169E1 0%, #87CEEB 100%)',
    desc: 'Move your paddle with arrow keys — score in the right goal!',
    ageMin: 5, ageMax: 12,
    categories: ['Fun'],
    color: '#00CFFF',
  },
];

const GRADES = ['All Ages', 'PreK', 'K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
const CATEGORIES = ['All', 'Holiday', 'Fun', 'Spelling', 'Art', 'Math'];

function gradeInRange(game: GameMeta, grade: string): boolean {
  if (grade === 'All Ages') return true;
  if (grade === 'PreK') return game.ageMin <= 5;
  if (grade === 'K') return game.ageMin <= 6 && game.ageMax >= 5;
  const n = parseInt(grade, 10);
  const minAge = n + 5, maxAge = n + 6;
  return game.ageMin <= maxAge && game.ageMax >= minAge;
}

function contextLabel(grade: string): string {
  if (grade === 'All Ages') return 'All games';
  if (grade === 'PreK') return 'Pre-K games';
  if (grade === 'K') return 'Kindergarten games';
  return `Grade ${grade} games`;
}

interface GameBrowserProps {
  onGameSelect: (game: GameMeta) => void;
}

const GameBrowser: React.FC<GameBrowserProps> = ({ onGameSelect }) => {
  const [grade, setGrade] = useState('All Ages');
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');

  const filtered = GAMES.filter(g =>
    gradeInRange(g, grade) &&
    (category === 'All' || g.categories.includes(category)) &&
    (g.title.toLowerCase().includes(search.toLowerCase()) ||
     g.desc.toLowerCase().includes(search.toLowerCase()))
  );

  const chipBase = {
    fontFamily: '"Fredoka One", cursive',
    fontSize: '0.95rem',
    cursor: 'pointer',
    borderRadius: '30px',
    px: 0.5,
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#1a0050', display: 'flex', flexDirection: 'column' }}>
      {/* Animated landscape strip */}
      <Box sx={{ height: 180, bgcolor: '#87CEEB', overflow: 'hidden', flexShrink: 0 }}>
        <LandscapeCanvas />
      </Box>

      {/* Top bar */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2.5, py: 1.5, bgcolor: '#1a0050' }}>
        <Typography variant="h5" sx={{ color: '#FFD700' }}>🎮 ABC Kids</Typography>
        <Typography variant="body1" sx={{ color: '#aad4ff' }}>{contextLabel(grade)}</Typography>
      </Box>

      {/* Grade selector */}
      <Box sx={{ px: 2.5, pb: 1 }}>
        <Typography variant="caption" sx={{ color: '#aaa', letterSpacing: 1, textTransform: 'uppercase', display: 'block', mb: 1 }}>
          Grade
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {GRADES.map(g => (
            <Chip
              key={g}
              label={g}
              onClick={() => setGrade(g)}
              variant={g === grade ? 'filled' : 'outlined'}
              sx={{
                ...chipBase,
                ...(g === grade
                  ? { bgcolor: '#FFD700', color: '#1a0050', borderColor: '#FFD700', '&:hover': { bgcolor: '#FFE040' } }
                  : { color: '#ddd', borderColor: 'rgba(255,255,255,0.25)', '&:hover': { borderColor: '#FFD700', color: '#FFD700' } }
                ),
              }}
            />
          ))}
        </Box>
      </Box>

      {/* Category chips */}
      <Box sx={{ px: 2.5, pb: 1.5 }}>
        <Typography variant="caption" sx={{ color: '#aaa', letterSpacing: 1, textTransform: 'uppercase', display: 'block', mb: 1 }}>
          Kind of game
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {CATEGORIES.map(c => (
            <Chip
              key={c}
              label={c}
              onClick={() => setCategory(c)}
              variant={c === category ? 'filled' : 'outlined'}
              sx={{
                ...chipBase,
                ...(c === category
                  ? { bgcolor: 'rgba(0,207,255,0.2)', color: '#00CFFF', borderColor: '#00CFFF' }
                  : { color: '#ccc', borderColor: 'rgba(255,255,255,0.2)', '&:hover': { borderColor: '#00CFFF', color: '#00CFFF' } }
                ),
              }}
            />
          ))}
        </Box>
      </Box>

      {/* Search */}
      <Box sx={{ px: 2.5, pb: 2 }}>
        <TextField
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search games..."
          size="small"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: '#888' }} />
              </InputAdornment>
            ),
          }}
          sx={{
            maxWidth: 400,
            '& .MuiOutlinedInput-root': {
              bgcolor: 'rgba(255,255,255,0.07)',
              borderRadius: 3,
              fontFamily: '"Fredoka One", cursive',
              '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
              '&:hover fieldset': { borderColor: '#FFD700' },
              '&.Mui-focused fieldset': { borderColor: '#FFD700' },
            },
            '& input': { color: '#fff', fontFamily: '"Fredoka One", cursive' },
          }}
        />
      </Box>

      {/* Game grid */}
      <Box sx={{ px: 2.5, pb: 5, flex: 1 }}>
        {filtered.length === 0 ? (
          <Typography sx={{ color: '#888', textAlign: 'center', pt: 8 }}>
            No games found — try a different filter!
          </Typography>
        ) : (
          <Grid container spacing={2.5}>
            {filtered.map(game => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={game.id}>
                <Card
                  sx={{
                    bgcolor: '#2d0080',
                    borderRadius: 4,
                    overflow: 'hidden',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'scale(1.04) translateY(-4px)',
                      boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                    },
                  }}
                >
                  <CardActionArea onClick={() => onGameSelect(game)}>
                    <Box
                      sx={{
                        height: 150,
                        background: game.coverBg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '5rem',
                      }}
                    >
                      {game.emoji}
                    </Box>
                    <Box sx={{ p: 2 }}>
                      <Typography variant="h6" sx={{ color: game.color, mb: 0.5 }}>
                        {game.title}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#ccc', mb: 1.5, lineHeight: 1.4 }}>
                        {game.desc}
                      </Typography>
                      <Chip
                        label={`Ages ${game.ageMin}–${game.ageMax}`}
                        size="small"
                        sx={{
                          bgcolor: 'rgba(255,215,0,0.15)',
                          color: '#FFD700',
                          border: '1px solid #FFD700',
                          fontFamily: '"Fredoka One", cursive',
                          fontSize: '0.78rem',
                        }}
                      />
                    </Box>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
    </Box>
  );
};

export default GameBrowser;
