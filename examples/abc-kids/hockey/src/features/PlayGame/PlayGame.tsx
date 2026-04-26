import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Typography } from '@mui/material';

// ── constants ────────────────────────────────────────────────────────────────
const W = 600;
const H = 400;
const PADDLE_W = 14;
const PADDLE_H = 80;
const PUCK_R = 12;
const PLAYER_X = 28;
const AI_X = W - 28 - PADDLE_W;
const PADDLE_SPEED = 5;
const AI_SPEED = 3.5;
const PUCK_INIT_SPEED = 4;
const GOAL_W = 14;
const GOAL_H = 110;
const GOAL_Y = H / 2 - GOAL_H / 2;
const MAX_VY = 8;

interface GameState {
  playerY: number;
  aiY: number;
  puckX: number;
  puckY: number;
  puckVX: number;
  puckVY: number;
  playerScore: number;
  aiScore: number;
  keys: Set<string>;
  frameId: number;
}

// ── component ─────────────────────────────────────────────────────────────────
export const PlayGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = useRef<GameState>({
    playerY: H / 2 - PADDLE_H / 2,
    aiY: H / 2 - PADDLE_H / 2,
    puckX: W / 2,
    puckY: H / 2,
    puckVX: PUCK_INIT_SPEED,
    puckVY: 1.5,
    playerScore: 0,
    aiScore: 0,
    keys: new Set(),
    frameId: 0,
  });
  const [scores, setScores] = useState({ player: 0, ai: 0 });

  const resetPuck = useCallback((direction: 1 | -1) => {
    const s = state.current;
    s.puckX = W / 2;
    s.puckY = H / 2;
    s.puckVX = direction * PUCK_INIT_SPEED;
    s.puckVY = (Math.random() - 0.5) * 3;
  }, []);

  // ── draw helpers ────────────────────────────────────────────────────────────
  const drawRink = (ctx: CanvasRenderingContext2D) => {
    // ice surface
    ctx.fillStyle = '#E8F4FD';
    ctx.fillRect(0, 0, W, H);
    // boards (border)
    ctx.strokeStyle = '#4169E1';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, W - 4, H - 4);
    // centre line
    ctx.strokeStyle = '#B0C4DE';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(W / 2, 0);
    ctx.lineTo(W / 2, H);
    ctx.stroke();
    ctx.setLineDash([]);
    // centre circle
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 50, 0, Math.PI * 2);
    ctx.strokeStyle = '#B0C4DE';
    ctx.lineWidth = 2;
    ctx.stroke();
    // centre dot
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#B0C4DE';
    ctx.fill();
    // goals
    ctx.strokeStyle = '#FF4444';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, GOAL_Y, GOAL_W, GOAL_H);
    ctx.strokeRect(W - GOAL_W, GOAL_Y, GOAL_W, GOAL_H);
    // goal fill (light red)
    ctx.fillStyle = 'rgba(255, 68, 68, 0.1)';
    ctx.fillRect(0, GOAL_Y, GOAL_W, GOAL_H);
    ctx.fillRect(W - GOAL_W, GOAL_Y, GOAL_W, GOAL_H);
  };

  const drawPaddle = (ctx: CanvasRenderingContext2D, x: number, y: number, color: string) => {
    ctx.beginPath();
    // rounded rect via arc
    const r = 6;
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + PADDLE_W - r, y);
    ctx.arcTo(x + PADDLE_W, y, x + PADDLE_W, y + r, r);
    ctx.lineTo(x + PADDLE_W, y + PADDLE_H - r);
    ctx.arcTo(x + PADDLE_W, y + PADDLE_H, x + PADDLE_W - r, y + PADDLE_H, r);
    ctx.lineTo(x + r, y + PADDLE_H);
    ctx.arcTo(x, y + PADDLE_H, x, y + PADDLE_H - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  const drawPuck = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.beginPath();
    ctx.arc(x, y, PUCK_R, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a2e';
    ctx.fill();
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.stroke();
    // shine
    ctx.beginPath();
    ctx.arc(x - 3, y - 3, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fill();
  };

  // ── game loop ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const loop = () => {
      const s = state.current;

      // player input
      if (s.keys.has('ArrowUp') || s.keys.has('KeyW'))
        s.playerY = Math.max(0, s.playerY - PADDLE_SPEED);
      if (s.keys.has('ArrowDown') || s.keys.has('KeyS'))
        s.playerY = Math.min(H - PADDLE_H, s.playerY + PADDLE_SPEED);

      // AI tracks puck centre
      const aiCentre = s.aiY + PADDLE_H / 2;
      if (aiCentre < s.puckY - 4) s.aiY = Math.min(H - PADDLE_H, s.aiY + AI_SPEED);
      else if (aiCentre > s.puckY + 4) s.aiY = Math.max(0, s.aiY - AI_SPEED);

      // puck movement
      s.puckX += s.puckVX;
      s.puckY += s.puckVY;

      // top / bottom wall bounce
      if (s.puckY - PUCK_R <= 0) { s.puckVY = Math.abs(s.puckVY); s.puckY = PUCK_R; }
      if (s.puckY + PUCK_R >= H) { s.puckVY = -Math.abs(s.puckVY); s.puckY = H - PUCK_R; }

      // player paddle collision
      if (
        s.puckX - PUCK_R <= PLAYER_X + PADDLE_W &&
        s.puckX + PUCK_R >= PLAYER_X &&
        s.puckY >= s.playerY &&
        s.puckY <= s.playerY + PADDLE_H
      ) {
        s.puckVX = Math.abs(s.puckVX) * 1.05;
        s.puckVY += (s.puckY - (s.playerY + PADDLE_H / 2)) * 0.12;
        s.puckX = PLAYER_X + PADDLE_W + PUCK_R + 1;
      }

      // AI paddle collision
      if (
        s.puckX + PUCK_R >= AI_X &&
        s.puckX - PUCK_R <= AI_X + PADDLE_W &&
        s.puckY >= s.aiY &&
        s.puckY <= s.aiY + PADDLE_H
      ) {
        s.puckVX = -Math.abs(s.puckVX) * 1.05;
        s.puckVY += (s.puckY - (s.aiY + PADDLE_H / 2)) * 0.12;
        s.puckX = AI_X - PUCK_R - 1;
      }

      // clamp VY
      s.puckVY = Math.max(-MAX_VY, Math.min(MAX_VY, s.puckVY));

      // goal scoring — puck enters goal zone
      const inGoalY = s.puckY >= GOAL_Y && s.puckY <= GOAL_Y + GOAL_H;
      if (s.puckX - PUCK_R <= GOAL_W && inGoalY) {
        // AI scores (left goal)
        s.aiScore++;
        setScores({ player: s.playerScore, ai: s.aiScore });
        resetPuck(1);
      } else if (s.puckX + PUCK_R >= W - GOAL_W && inGoalY) {
        // Player scores (right goal)
        s.playerScore++;
        setScores({ player: s.playerScore, ai: s.aiScore });
        resetPuck(-1);
      } else if (s.puckX < -30 || s.puckX > W + 30) {
        // puck escaped — reset
        resetPuck(s.puckX > W / 2 ? -1 : 1);
      }

      // draw
      drawRink(ctx);
      drawPaddle(ctx, PLAYER_X, s.playerY, '#FFD700');
      drawPaddle(ctx, AI_X, s.aiY, '#FF6B6B');
      drawPuck(ctx, s.puckX, s.puckY);

      s.frameId = requestAnimationFrame(loop);
    };

    state.current.frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(state.current.frameId);
  }, [resetPuck]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      state.current.keys.add(e.code);
      if (['ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => state.current.keys.delete(e.code);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#0a0a2e',
        gap: 2,
        p: 2,
      }}
    >
      {/* scoreboard */}
      <Box sx={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <Typography sx={{ color: '#FFD700', fontSize: '2rem', fontWeight: 'bold' }}>
          YOU: {scores.player}
        </Typography>
        <Typography sx={{ color: '#aaa', fontSize: '1.2rem' }}>vs</Typography>
        <Typography sx={{ color: '#FF6B6B', fontSize: '2rem', fontWeight: 'bold' }}>
          AI: {scores.ai}
        </Typography>
      </Box>

      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{
          maxWidth: '100%',
          borderRadius: 16,
          border: '3px solid #4169E1',
          boxShadow: '0 0 40px rgba(65,105,225,0.4)',
        }}
      />

      <Typography sx={{ color: '#aaa', fontSize: '0.95rem', textAlign: 'center' }}>
        🏒 Arrow keys or WASD to move your paddle (gold) — score in the right goal!
      </Typography>
    </Box>
  );
};

export default PlayGame;
