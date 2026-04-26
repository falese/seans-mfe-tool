import React, { useEffect, useRef } from 'react';

const LandscapeCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const ctx = canvas.getContext('2d')!;

    const clouds = [
      { x: canvas.width * 0.10, y: canvas.height * 0.18, r: 28, speed: 0.18 },
      { x: canvas.width * 0.40, y: canvas.height * 0.12, r: 22, speed: 0.12 },
      { x: canvas.width * 0.70, y: canvas.height * 0.22, r: 34, speed: 0.15 },
      { x: canvas.width * 0.90, y: canvas.height * 0.10, r: 20, speed: 0.10 },
    ];

    const hills = [
      { color: '#6bc46b', yBase: 0.72, amp: 0.14, freq: 0.9,  phase: 0,   speed: 0.25 },
      { color: '#5cb85c', yBase: 0.78, amp: 0.11, freq: 1.4,  phase: 200, speed: 0.40 },
      { color: '#4cae4c', yBase: 0.85, amp: 0.08, freq: 2.0,  phase: 500, speed: 0.60 },
    ];

    const animals = [
      { type: 'cat' as const, x: canvas.width * 0.2,  speed: 0.8,  label: 'Cat', color: '#f5a623', w: 38, h: 30 },
      { type: 'dog' as const, x: canvas.width * 0.6,  speed: 1.2,  label: 'Dog', color: '#a0522d', w: 44, h: 32 },
    ];

    const bird = { x: canvas.width * 0.85, y: canvas.height * 0.25, speed: 1.5 };

    let t = 0;

    function getHillY(xPos: number): number {
      const h = hills[2];
      const W = canvas.width, H = canvas.height;
      return H * h.yBase
        + Math.sin((xPos + h.phase) * h.freq * 0.006) * H * h.amp
        + Math.sin((xPos + h.phase * 0.5) * h.freq * 0.012) * H * h.amp * 0.4;
    }

    function drawCloud(cx: number, cy: number, r: number) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      const blobs: [number, number, number][] = [
        [0, 0, r], [-r * 0.6, r * 0.2, r * 0.7], [r * 0.6, r * 0.2, r * 0.7],
        [-r * 1.1, r * 0.5, r * 0.55], [r * 1.1, r * 0.5, r * 0.55],
      ];
      blobs.forEach(([dx, dy, br]) => {
        ctx.beginPath(); ctx.arc(cx + dx, cy + dy, br, 0, Math.PI * 2); ctx.fill();
      });
    }

    function drawHills() {
      const W = canvas.width, H = canvas.height;
      hills.forEach(hill => {
        const scroll = (t * hill.speed) % (W * 2);
        ctx.beginPath();
        ctx.moveTo(-scroll, H);
        for (let x = -scroll; x <= W + scroll + 60; x += 4) {
          const y = H * hill.yBase
            + Math.sin((x + hill.phase) * hill.freq * 0.006) * H * hill.amp
            + Math.sin((x + hill.phase * 0.5) * hill.freq * 0.012) * H * hill.amp * 0.4;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(W + scroll + 60, H); ctx.lineTo(-scroll, H); ctx.closePath();
        ctx.fillStyle = hill.color; ctx.fill();
      });
    }

    function drawAnimal(a: typeof animals[0], bodyY: number) {
      const { x, w, h, color, label, type } = a;
      const H = canvas.height;
      ctx.save();

      ctx.fillStyle = color;
      ctx.beginPath();
      (ctx as CanvasRenderingContext2D & { roundRect: Function }).roundRect(x - w / 2, bodyY - h, w, h * 0.65, 8);
      ctx.fill();

      ctx.beginPath(); ctx.arc(x + w * 0.27, bodyY - h * 0.8, h * 0.33, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x + w * 0.38, bodyY - h * 0.88, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(x + w * 0.39, bodyY - h * 0.88, 2, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = color;
      if (type === 'cat') {
        ctx.beginPath(); ctx.moveTo(x+w*0.12, bodyY-h*1.02); ctx.lineTo(x+w*0.21, bodyY-h*1.2); ctx.lineTo(x+w*0.3, bodyY-h*1.02); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x+w*0.35, bodyY-h*1.02); ctx.lineTo(x+w*0.44, bodyY-h*1.22); ctx.lineTo(x+w*0.53, bodyY-h*1.02); ctx.fill();
      } else {
        ctx.fillStyle = '#c07040';
        ctx.beginPath(); ctx.ellipse(x+w*0.17, bodyY-h*1.02, 7, 9, -0.3, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.ellipse(x+w*0.44, bodyY-h*1.0, 7, 9, 0.3, 0, Math.PI*2); ctx.fill();
      }

      ctx.strokeStyle = color; ctx.lineWidth = 6; ctx.lineCap = 'round';
      const offsets = [-14, -6, 6, 14];
      offsets.forEach((ox, i) => {
        const legAnim = Math.sin(t * 0.08 * a.speed * 4 + i * Math.PI / 2) * 6;
        ctx.beginPath(); ctx.moveTo(x + ox, bodyY - h * 0.3); ctx.lineTo(x + ox, bodyY + legAnim); ctx.stroke();
      });

      if (type === 'cat') {
        const tailY = Math.sin(t * 0.06) * 10;
        ctx.beginPath();
        ctx.moveTo(x - w/2 + 4, bodyY - h * 0.4);
        ctx.bezierCurveTo(x - w, bodyY - h * 0.4, x - w * 1.1, bodyY - h + tailY, x - w * 0.95, bodyY - h * 0.7 + tailY);
        ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.stroke();
      }

      ctx.fillStyle = '#fff8dc';
      (ctx as CanvasRenderingContext2D & { roundRect: Function }).roundRect(x - 16, bodyY - h * 1.5, 32, 18, 4);
      ctx.fill();
      ctx.fillStyle = '#333';
      ctx.font = 'bold 11px "Fredoka One", cursive';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, bodyY - h * 1.38);
      ctx.restore();
    }

    function drawBird(bx: number, by: number) {
      const flap = Math.sin(t * 0.18) * 12;
      ctx.save();
      ctx.fillStyle = '#FF6B6B';
      ctx.beginPath(); ctx.ellipse(bx, by, 14, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff4444';
      ctx.beginPath(); ctx.ellipse(bx - 4, by - flap, 10, 5, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(bx + 8, by - 3, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(bx + 9, by - 3, 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FFA500';
      ctx.beginPath(); ctx.moveTo(bx + 14, by); ctx.lineTo(bx + 22, by + 2); ctx.lineTo(bx + 14, by + 5); ctx.fill();
      ctx.restore();
    }

    function loop() {
      t++;
      const W = canvas.width, H = canvas.height;

      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#87CEEB'); sky.addColorStop(1, '#c9e8f5');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

      clouds.forEach(c => {
        c.x -= c.speed;
        if (c.x + c.r * 2 < 0) c.x = W + c.r * 2;
        drawCloud(c.x, c.y, c.r);
      });

      drawHills();

      animals.forEach(a => {
        a.x += a.speed;
        if (a.x - a.w > W) a.x = -a.w;
        drawAnimal(a, getHillY(a.x));
      });

      bird.x -= bird.speed;
      bird.y += Math.sin(t * 0.025) * 0.6;
      if (bird.x < -30) bird.x = W + 30;
      drawBird(bird.x, bird.y);

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  );
};

export default LandscapeCanvas;
