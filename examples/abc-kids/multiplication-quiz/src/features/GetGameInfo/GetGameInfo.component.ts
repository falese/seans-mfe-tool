/**
 * GetGameInfo Feature Component (Angular standalone)
 * Return game metadata including title, age range, and description
 * Generated from mfe-manifest.yaml capability definition
 */
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'getgameinfo-component',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    :host { display: block; font-family: 'Segoe UI', sans-serif; }

    .info {
      background: linear-gradient(135deg, #1a0050 0%, #2d0080 100%);
      color: #fff;
      padding: 24px;
      border-radius: 12px;
      min-height: 260px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .header {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .header .pets { font-size: 40px; line-height: 1; }
    .header h2 {
      margin: 0;
      font-size: 22px;
      font-weight: 800;
      color: #FFD700;
    }

    .desc { margin: 0; font-size: 15px; line-height: 1.5; color: #d7ccff; }

    .meta {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 8px 16px;
      font-size: 14px;
    }
    .meta dt { color: #9c8fd6; font-weight: bold; }
    .meta dd { margin: 0; color: #fff; }

    .tags { display: flex; flex-wrap: wrap; gap: 6px; }
    .tag {
      background: rgba(255, 215, 0, 0.15);
      border: 1px solid rgba(255, 215, 0, 0.35);
      color: #FFD700;
      font-size: 12px;
      font-weight: bold;
      padding: 3px 10px;
      border-radius: 999px;
    }
  `],
  template: `
    <div class="info">
      <div class="header">
        <span class="pets">🐱🐶</span>
        <h2>{{ title }}</h2>
      </div>

      <p class="desc">{{ description }}</p>

      <dl class="meta">
        <dt>Ages</dt><dd>{{ ageRange }}</dd>
        <dt>Category</dt><dd>{{ category }}</dd>
        <dt>Skill</dt><dd>{{ skill }}</dd>
        <dt>Questions</dt><dd>{{ questionCount }} per round</dd>
      </dl>

      <div class="tags">
        <span class="tag" *ngFor="let t of tags">{{ t }}</span>
      </div>
    </div>
  `,
})
export class GetGameInfoComponent {
  @Input() title = 'Multiplication Quiz';
  @Input() description =
    'A cat and a dog take turns asking multiplication questions. Answer correctly, build your streak, and beat your best score across the times tables from 1 to 12.';
  @Input() ageRange = '6–10';
  @Input() category = 'Math · Games';
  @Input() skill = 'Times tables (1–12)';
  @Input() questionCount = 8;
  @Input() tags: string[] = ['kids', 'math', 'multiplication', 'quiz'];
}

export default GetGameInfoComponent;
