import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Typography } from '@mui/material';

// ── constants ────────────────────────────────────────────────────────────────
const W = 480;
const H = 640;
const BIRD_X = 100;
const BIRD_R = 22;
const GRAVITY = 0.45;
const JUMP_VEL = -9;
const PIPE_W = 60;
const GAP = 170;
const PIPE_SPEED = 3;
const PIPE_INTERVAL_MS = 1400;

interface Pipe {
  x: number;
  gapY: number;
  passed: boolean;
}

interface GameState {
  birdY: number;
  birdVY: number;
  pipes: Pipe[];
  score: number;
  alive: boolean;
  lastPipeMs: number;
  frameId: number;
}

// ── component ─────────────────────────────────────────────────────────────────
export const PlayGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = useRef<GameState>({
    birdY: H / 2,
    birdVY: 0,
    pipes: [],
    score: 0,
    alive: true,
    lastPipeMs: 0,
    frameId: 0,
  });
  const [score, setScore] = useState(0);
  const [dead, setDead] = useState(false);

  const reset = useCallback(() => {
    const s = state.current;
    s.birdY = H / 2;
    s.birdVY = 0;
    s.pipes = [];
    s.score = 0;
    s.alive = true;
    s.lastPipeMs = performance.now();
    setScore(0);
    setDead(false);
  }, []);

  const jump = useCallback(() => {
    if (!state.current.alive) { reset(); return; }
    state.current.birdVY = JUMP_VEL;
  }, [reset]);

  // ── draw helpers ────────────────────────────────────────────────────────────
  const drawBackground = (ctx: CanvasRenderingContext2D) => {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#87CEEB');
    grad.addColorStop(0.75, '#E0F7FA');
    grad.addColorStop(1, '#E0F7FA');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    // ground
    ctx.fillStyle = '#8BC34A';
    ctx.fillRect(0, H - 40, W, 40);
    ctx.fillStyle = '#6D4C41';
    ctx.fillRect(0, H - 48, W, 8);
  };

  const drawPipe = (ctx: CanvasRenderingContext2D, p: Pipe) => {
    const topH = p.gapY - GAP / 2;
    const botY = p.gapY + GAP / 2;
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(p.x, 0, PIPE_W, topH);
    ctx.fillStyle = '#388E3C';
    ctx.fillRect(p.x - 5, topH - 28, PIPE_W + 10, 28);
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(p.x, botY, PIPE_W, H - botY);
    ctx.fillStyle = '#388E3C';
    ctx.fillRect(p.x - 5, botY, PIPE_W + 10, 28);
  };

  const drawBird = (ctx: CanvasRenderingContext2D, y: number) => {
    // body
    ctx.beginPath();
    ctx.arc(BIRD_X, y, BIRD_R, 0, Math.PI * 2);
    ctx.fillStyle = '#FFD700';
    ctx.fill();
    ctx.strokeStyle = '#FF8C00';
    ctx.lineWidth = 3;
    ctx.stroke();
    // eye white
    ctx.beginPath();
    ctx.arc(BIRD_X + 8, y - 7, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    // pupil
    ctx.beginPath();
    ctx.arc(BIRD_X + 10, y - 7, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#222';
    ctx.fill();
    // beak
    ctx.beginPath();
    ctx.moveTo(BIRD_X + BIRD_R, y);
    ctx.lineTo(BIRD_X + BIRD_R + 12, y - 4);
    ctx.lineTo(BIRD_X + BIRD_R + 12, y + 4);
    ctx.closePath();
    ctx.fillStyle = '#FF8C00';
    ctx.fill();
  };

  const hitsPipe = (birdY: number, pipes: Pipe[]) => {
    if (birdY + BIRD_R >= H - 40 || birdY - BIRD_R <= 0) return true;
    for (const p of pipes) {
      if (
        BIRD_X + BIRD_R > p.x &&
        BIRD_X - BIRD_R < p.x + PIPE_W &&
        (birdY - BIRD_R < p.gapY - GAP / 2 || birdY + BIRD_R > p.gapY + GAP / 2)
      ) return true;
    }
    return false;
  };

  // ── game loop ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    state.current.lastPipeMs = performance.now();

    const loop = (now: number) => {
      const s = state.current;
      if (!s.alive) return;

      if (now - s.lastPipeMs > PIPE_INTERVAL_MS) {
        const minGapY = 160;
        const maxGapY = H - 40 - 160;
        s.pipes.push({ x: W, gapY: minGapY + Math.random() * (maxGapY - minGapY), passed: false });
        s.lastPipeMs = now;
      }

      s.birdVY += GRAVITY;
      s.birdY += s.birdVY;

      for (const p of s.pipes) {
        p.x -= PIPE_SPEED;
        if (!p.passed && p.x + PIPE_W < BIRD_X) {
          p.passed = true;
          s.score++;
          setScore(s.score);
        }
      }
      s.pipes = s.pipes.filter(p => p.x + PIPE_W > 0);

      if (hitsPipe(s.birdY, s.pipes)) {
        s.alive = false;
        setDead(true);
        return;
      }

      drawBackground(ctx);
      s.pipes.forEach(p => drawPipe(ctx, p));
      drawBird(ctx, s.birdY);

      // score HUD
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(W / 2 - 52, 10, 104, 48);
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 34px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(s.score), W / 2, 47);

      s.frameId = requestAnimationFrame(loop);
    };

    state.current.frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(state.current.frameId);
  }, [dead]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Space') { e.preventDefault(); jump(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [jump]);

  return (
    <Box
      onClick={jump}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#000',
        userSelect: 'none',
        gap: 2,
        cursor: 'pointer',
      }}
    >
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{ maxHeight: '80vh', maxWidth: '100%', borderRadius: 16 }}
      />
      {dead ? (
        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{ color: '#FF6B6B', fontSize: '2rem', fontWeight: 'bold' }}>
            Oops! Score: {score}
          </Typography>
          <Typography sx={{ color: '#FFD700', fontSize: '1.1rem', mt: 1 }}>
            Tap or press Space to try again — mistakes are OK! 🐦
          </Typography>
        </Box>
      ) : (
        <Typography sx={{ color: '#FFD700', fontSize: '1rem' }}>
          Tap or press Space to flap!
        </Typography>
      )}
    </Box>
  );
};

export default PlayGame;
