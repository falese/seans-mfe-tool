/**
 * ShowCover Feature Component (Angular standalone)
 * Show the multiplication quiz cover card with cat and dog art
 * Generated from mfe-manifest.yaml capability definition
 */
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'showcover-component',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    :host { display: block; font-family: 'Segoe UI', sans-serif; }

    .cover {
      position: relative;
      overflow: hidden;
      background: linear-gradient(135deg, #1a0050 0%, #2d0080 100%);
      color: #fff;
      padding: 28px 24px;
      border-radius: 12px;
      min-height: 260px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 14px;
      text-align: center;
    }

    /* faint floating operator symbols in the background */
    .op {
      position: absolute;
      color: rgba(255, 215, 0, 0.10);
      font-weight: bold;
      user-select: none;
      pointer-events: none;
    }
    .op.a { top: 12px;  left: 18px;  font-size: 40px; transform: rotate(-15deg); }
    .op.b { bottom: 18px; right: 22px; font-size: 64px; transform: rotate(12deg); }
    .op.c { top: 40%;    right: 12px;  font-size: 28px; transform: rotate(8deg); }
    .op.d { bottom: 30%; left: 14px;  font-size: 32px; transform: rotate(-10deg); }

    .cast {
      display: flex;
      align-items: center;
      gap: 10px;
      z-index: 1;
    }
    .cast .pet {
      font-size: 64px;
      line-height: 1;
      filter: drop-shadow(0 6px 14px rgba(0,0,0,0.5));
      animation: float 2.4s ease-in-out infinite;
    }
    .cast .pet.dog { animation-delay: 1.2s; }
    .cast .vs {
      font-size: 34px;
      font-weight: bold;
      color: #FFD700;
      text-shadow: 0 2px 6px rgba(0,0,0,0.4);
    }
    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50%      { transform: translateY(-10px); }
    }

    .title {
      z-index: 1;
      font-size: 30px;
      font-weight: 800;
      letter-spacing: 0.5px;
      margin: 0;
      background: linear-gradient(90deg, #FFD700, #ffe94d);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .tagline {
      z-index: 1;
      font-size: 15px;
      color: #d7ccff;
      max-width: 300px;
      margin: 0;
    }
    .badge {
      z-index: 1;
      margin-top: 4px;
      background: rgba(255, 215, 0, 0.15);
      border: 1px solid rgba(255, 215, 0, 0.4);
      color: #FFD700;
      font-size: 13px;
      font-weight: bold;
      padding: 5px 14px;
      border-radius: 999px;
    }
  `],
  template: `
    <div class="cover">
      <span class="op a">+</span>
      <span class="op b">&times;</span>
      <span class="op c">=</span>
      <span class="op d">&minus;</span>

      <div class="cast">
        <span class="pet cat">🐱</span>
        <span class="vs">&times;</span>
        <span class="pet dog">🐶</span>
      </div>

      <h2 class="title">{{ title }}</h2>
      <p class="tagline">{{ tagline }}</p>
      <span class="badge">{{ ageRange }} · {{ questionCount }} questions</span>
    </div>
  `,
})
export class ShowCoverComponent {
  @Input() title = 'Multiplication Quiz';
  @Input() tagline = 'A cat and a dog take turns asking times-table questions — how high can your streak go?';
  @Input() ageRange = 'Ages 6–10';
  @Input() questionCount = 8;
}

export default ShowCoverComponent;
