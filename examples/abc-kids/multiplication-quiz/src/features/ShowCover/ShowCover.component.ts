/**
 * ShowCover Feature Component (Angular standalone)
 * Show the multiplication quiz cover card with cat and dog art
 * Generated from mfe-manifest.yaml capability definition
 */
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'showcover-component',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="cover-card">
      <div class="cover-characters">
        <span class="cover-emoji cat">&#128049;</span>
        <span class="cover-emoji multiply">&#10006;</span>
        <span class="cover-emoji dog">&#128054;</span>
      </div>
      <h2 class="cover-title">Multiplication Quiz</h2>
      <p class="cover-desc">
        Whiskers the Cat and Barkley the Dog challenge you to a math showdown!
      </p>
      <div class="cover-badges">
        <span class="badge">&#127775; Math</span>
        <span class="badge">&#128218; Ages 5-10</span>
        <span class="badge">&#127942; 10 Rounds</span>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .cover-card {
      font-family: 'Fredoka One', 'Comic Sans MS', cursive;
      text-align: center;
      padding: 24px 16px;
      color: #fff;
    }
    .cover-characters {
      font-size: 48px;
      margin-bottom: 12px;
    }
    .cover-emoji { margin: 0 4px; }
    .cover-emoji.multiply { font-size: 32px; vertical-align: middle; color: #FFD700; }
    .cover-title {
      font-size: 24px;
      color: #FFD700;
      margin: 8px 0;
    }
    .cover-desc {
      font-size: 14px;
      color: #aad4ff;
      max-width: 300px;
      margin: 0 auto 12px;
      line-height: 1.4;
    }
    .cover-badges {
      display: flex;
      justify-content: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .badge {
      font-size: 12px;
      padding: 4px 10px;
      border-radius: 12px;
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.2);
    }
  `],
})
export class ShowCoverComponent {}

export default ShowCoverComponent;
